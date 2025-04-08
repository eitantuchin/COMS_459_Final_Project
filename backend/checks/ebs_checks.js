const AWS = require('aws-sdk');

async function runEbsChecks(credentials) {
  const ec2 = new AWS.EC2({ ...credentials, region: 'us-east-1' });
  const regionResponse = await ec2.describeRegions().promise();
  const regions = regionResponse.Regions.map(region => region.RegionName);

  const ebsPromises = regions.map(region => {
    const regionalEc2 = new AWS.EC2({ ...credentials, region });
    return Promise.all([
      regionalEc2.describeVolumes().promise(),
      regionalEc2.describeSnapshots({ OwnerIds: ['self'] }).promise(),
    ]).then(([volumes, snapshots]) => ({
      region,
      volumes: volumes.Volumes,
      snapshots: snapshots.Snapshots,
    }));
  });

  const ebsResponses = await Promise.all(ebsPromises);
  const allVolumes = [];
  const allSnapshots = [];
  ebsResponses.forEach(response => {
    allVolumes.push(...response.volumes.map(volume => ({ ...volume, Region: response.region })));
    allSnapshots.push(...response.snapshots.map(snapshot => ({ ...snapshot, Region: response.region })));
  });

  const checks = {
    totalChecks: 0,
    totalPassed: 0,
    details: [],
  };

  // Track assets and risks per region
  const regionStats = {};
  regions.forEach(region => {
    regionStats[region] = {
      totalAssets: 0,
      assetsAtRisk: new Set(),
    };
  });

  const assetsAtRiskSet = new Set();

  const addCheck = (name, passed, message, assetIds = []) => {
    checks.totalChecks++;
    if (passed) checks.totalPassed++;
    checks.details.push({ name, passed, message });
    if (!passed) {
      assetIds.forEach(id => {
        assetsAtRiskSet.add(id);
        // Find the region for this asset and add to region-specific set
        const asset = allVolumes.find(v => v.VolumeId === id) || 
                      allSnapshots.find(s => s.SnapshotId === id);
        if (asset && asset.Region) {
          regionStats[asset.Region].assetsAtRisk.add(id);
        }
      });
    }
  };

  const volumesExist = allVolumes.length > 0;
  addCheck(
    'EBS Volumes Exist',
    volumesExist,
    volumesExist ? 'EBS volumes are present.' : 'No EBS volumes found.'
  );

  if (!volumesExist) {
    regions.forEach(region => {
      regionStats[region].totalAssets = allVolumes.filter(v => v.Region === region).length +
                                        allSnapshots.filter(s => s.Region === region).length;
    });
    return { 
      ...checks, 
      totalAssets: allVolumes.length + allSnapshots.length, 
      assetsAtRisk: assetsAtRiskSet.size,
      regionStats: Object.fromEntries(
        Object.entries(regionStats).map(([region, stats]) => [region, {
          totalAssets: stats.totalAssets,
          assetsAtRisk: stats.assetsAtRisk.size
        }])
      )
    };
  }

  const volumesNotEncrypted = allVolumes.filter(v => !v.Encrypted);
  addCheck(
    'EBS Encryption',
    volumesNotEncrypted.length === 0,
    volumesNotEncrypted.length === 0
      ? 'All EBS volumes are encrypted.'
      : `Some volumes (${volumesNotEncrypted.map(v => `${v.VolumeId} (${v.Region})`).join(', ')}) lack encryption.`,
    volumesNotEncrypted.map(v => v.VolumeId)
  );

  const volumesUnattached = allVolumes.filter(v => v.Attachments.length === 0);
  addCheck(
    'Volumes Attached',
    volumesUnattached.length === 0,
    volumesUnattached.length === 0
      ? 'All EBS volumes are attached to an instance.'
      : `Some volumes (${volumesUnattached.map(v => `${v.VolumeId} (${v.Region})`).join(', ')}) are unattached.`,
    volumesUnattached.map(v => v.VolumeId)
  );

  const volumesNoSnapshots = allVolumes.filter(v => !allSnapshots.some(s => s.VolumeId === v.VolumeId));
  addCheck(
    'Snapshots Exist',
    volumesNoSnapshots.length === 0,
    volumesNoSnapshots.length === 0
      ? 'All EBS volumes have at least one snapshot.'
      : `Some volumes (${volumesNoSnapshots.map(v => `${v.VolumeId} (${v.Region})`).join(', ')}) lack snapshots.`,
    volumesNoSnapshots.map(v => v.VolumeId)
  );

  const snapshotsNotEncrypted = allSnapshots.filter(s => !s.Encrypted);
  addCheck(
    'Snapshots Encrypted',
    snapshotsNotEncrypted.length === 0,
    snapshotsNotEncrypted.length === 0
      ? 'All EBS snapshots are encrypted.'
      : `Some snapshots (${snapshotsNotEncrypted.map(s => `${s.SnapshotId} (${s.Region})`).join(', ')}) lack encryption.`,
    snapshotsNotEncrypted.map(s => s.SnapshotId)
  );

  const volumesNoTags = allVolumes.filter(v => !v.Tags?.length);
  addCheck(
    'EBS Tagging',
    volumesNoTags.length === 0,
    volumesNoTags.length === 0
      ? 'All EBS volumes are tagged.'
      : `Some volumes (${volumesNoTags.map(v => `${v.VolumeId} (${v.Region})`).join(', ')}) lack tags.`,
    volumesNoTags.map(v => v.VolumeId)
  );

  const snapshotsNoTags = allSnapshots.filter(s => !s.Tags?.length);
  addCheck(
    'Snapshots Tagged',
    snapshotsNoTags.length === 0,
    snapshotsNoTags.length === 0
      ? 'All EBS snapshots are tagged.'
      : `Some snapshots (${snapshotsNoTags.map(s => `${s.SnapshotId} (${s.Region})`).join(', ')}) lack tags.`,
    snapshotsNoTags.map(s => s.SnapshotId)
  );

  const modernTypes = ['gp3', 'io2'];
  const volumesNotModern = allVolumes.filter(v => !modernTypes.includes(v.VolumeType));
  addCheck(
    'Modern Volume Types',
    volumesNotModern.length === 0,
    volumesNotModern.length === 0
      ? 'All EBS volumes use modern types (gp3 or io2).'
      : `Some volumes (${volumesNotModern.map(v => `${v.VolumeId} (${v.Region})`).join(', ')}) use outdated types.`,
    volumesNotModern.map(v => v.VolumeId)
  );

  const snapshotPermissions = await Promise.all(
    allSnapshots.map(snapshot => 
      new AWS.EC2({ ...credentials, region: snapshot.Region })
        .describeSnapshotAttribute({ Attribute: 'createVolumePermission', SnapshotId: snapshot.SnapshotId })
        .promise()
    )
  );
  const snapshotsPublic = allSnapshots.filter((s, i) => 
    snapshotPermissions[i].CreateVolumePermissions.some(p => p.Group === 'all')
  );
  addCheck(
    'Snapshots Private',
    snapshotsPublic.length === 0,
    snapshotsPublic.length === 0
      ? 'All EBS snapshots are private.'
      : `Some snapshots (${snapshotsPublic.map(s => `${s.SnapshotId} (${s.Region})`).join(', ')}) are public.`,
    snapshotsPublic.map(s => s.SnapshotId)
  );

  const volumesTooLarge = allVolumes.filter(v => v.Size > 16384);
  addCheck(
    'Reasonable Volume Size',
    volumesTooLarge.length === 0,
    volumesTooLarge.length === 0
      ? 'All EBS volumes are 16 TiB or smaller.'
      : `Some volumes (${volumesTooLarge.map(v => `${v.VolumeId} (${v.Region})`).join(', ')}) exceed 16 TiB.`,
    volumesTooLarge.map(v => v.VolumeId)
  );

  const volumesLowIops = allVolumes.filter(v => v.VolumeType === 'io2' && v.Iops < 3000);
  addCheck(
    'Sufficient IOPS',
    volumesLowIops.length === 0,
    volumesLowIops.length === 0
      ? 'All io2 EBS volumes have sufficient IOPS (>= 3000).'
      : `Some io2 volumes (${volumesLowIops.map(v => `${v.VolumeId} (${v.Region})`).join(', ')}) have low IOPS.`,
    volumesLowIops.map(v => v.VolumeId)
  );

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const volumesNoRecent = allVolumes.filter(v => 
    !allSnapshots.some(s => s.VolumeId === v.VolumeId && new Date(s.StartTime).getTime() > sevenDaysAgo)
  );
  addCheck(
    'Recent Snapshots',
    volumesNoRecent.length === 0,
    volumesNoRecent.length === 0
      ? 'All EBS volumes have a snapshot from the last 7 days.'
      : `Some volumes (${volumesNoRecent.map(v => `${v.VolumeId} (${v.Region})`).join(', ')}) lack recent snapshots.`,
    volumesNoRecent.map(v => v.VolumeId)
  );

  const volumesNotInVpc = allVolumes.filter(v => !v.Attachments.some(att => att.InstanceId));
  addCheck(
    'Volumes in VPC',
    volumesNotInVpc.length === 0,
    volumesNotInVpc.length === 0
      ? 'All EBS volumes are in a VPC (via attached instances).'
      : `Some volumes (${volumesNotInVpc.map(v => `${v.VolumeId} (${v.Region})`).join(', ')}) are not in a VPC.`,
    volumesNotInVpc.map(v => v.VolumeId)
  );

  const snapshotsNoDesc = allSnapshots.filter(s => !s.Description || s.Description.trim() === '');
  addCheck(
    'Snapshots Described',
    snapshotsNoDesc.length === 0,
    snapshotsNoDesc.length === 0
      ? 'All EBS snapshots have descriptions.'
      : `Some snapshots (${snapshotsNoDesc.map(s => `${s.SnapshotId} (${s.Region})`).join(', ')}) lack descriptions.`,
    snapshotsNoDesc.map(s => s.SnapshotId)
  );

  const volumesNoKms = allVolumes.filter(v => v.Encrypted && !v.KmsKeyId);
  addCheck(
    'KMS Encryption',
    volumesNoKms.length === 0,
    volumesNoKms.length === 0
      ? 'All EBS volumes use KMS encryption.'
      : `Some volumes (${volumesNoKms.map(v => `${v.VolumeId} (${v.Region})`).join(', ')}) use default AES-256 instead of KMS.`,
    volumesNoKms.map(v => v.VolumeId)
  );

  // Calculate total assets per region
  regions.forEach(region => {
    regionStats[region].totalAssets = allVolumes.filter(v => v.Region === region).length +
                                      allSnapshots.filter(s => s.Region === region).length;
  });

  return {
    ...checks,
    totalAssets: allVolumes.length + allSnapshots.length,
    assetsAtRisk: assetsAtRiskSet.size,
    regionStats: Object.fromEntries(
      Object.entries(regionStats).map(([region, stats]) => [region, {
        totalAssets: stats.totalAssets,
        assetsAtRisk: stats.assetsAtRisk.size
      }])
    )
  };
}

module.exports = { runEbsChecks };