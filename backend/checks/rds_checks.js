const AWS = require('aws-sdk');

async function runRdsChecks(credentials) {
  const rds = new AWS.RDS({ ...credentials, region: 'us-east-1' });
  const ec2 = new AWS.EC2({ ...credentials, region: 'us-east-1' });
  const regionResponse = await ec2.describeRegions().promise();
  const regions = regionResponse.Regions.map(region => region.RegionName);

  const rdsPromises = regions.map(region => {
    const regionalRds = new AWS.RDS({ ...credentials, region });
    return Promise.all([
      regionalRds.describeDBInstances().promise(),
      regionalRds.describeDBSnapshots().promise(),
      regionalRds.describeDBParameterGroups().promise(),
      regionalRds.describeDBSubnetGroups().promise(),
    ]).then(([instances, snapshots, paramGroups, subnetGroups]) => ({
      region,
      instances: instances.DBInstances,
      snapshots: snapshots.DBSnapshots,
      paramGroups: paramGroups.DBParameterGroups,
      subnetGroups: subnetGroups.DBSubnetGroups,
    }));
  });

  const rdsResponses = await Promise.all(rdsPromises);
  const allInstances = [];
  const allSnapshots = [];
  const allParamGroups = [];
  const allSubnetGroups = [];

  rdsResponses.forEach(response => {
    allInstances.push(...response.instances.map(instance => ({ ...instance, Region: response.region })));
    allSnapshots.push(...response.snapshots.map(snapshot => ({ ...snapshot, Region: response.region })));
    allParamGroups.push(...response.paramGroups.map(pg => ({ ...pg, Region: response.region })));
    allSubnetGroups.push(...response.subnetGroups.map(sg => ({ ...sg, Region: response.region })));
  });

  const checks = {
    totalChecks: 0,
    totalPassed: 0,
    details: [],
  };

  const assetsAtRiskSet = new Set();

  const addCheck = (name, passed, message, assetIds = []) => {
    checks.totalChecks++;
    if (passed) checks.totalPassed++;
    checks.details.push({ name, passed, message });
    if (!passed) assetIds.forEach(id => assetsAtRiskSet.add(id));
  };

  const instancesExist = allInstances.length > 0;
  addCheck(
    'RDS Instances Exist',
    instancesExist,
    instancesExist ? 'RDS instances are present.' : 'No RDS instances found.'
  );

  if (!instancesExist) {
    return { ...checks, totalAssets: allInstances.length + allSnapshots.length, assetsAtRisk: assetsAtRiskSet.size };
  }

  const instancesNotEncrypted = allInstances.filter(i => !i.StorageEncrypted);
  addCheck(
    'RDS Encryption',
    instancesNotEncrypted.length === 0,
    instancesNotEncrypted.length === 0
      ? 'All RDS instances are encrypted.'
      : `Some instances (${instancesNotEncrypted.map(i => `${i.DBInstanceIdentifier} (${i.Region})`).join(', ')}) lack encryption.`,
    instancesNotEncrypted.map(i => i.DBInstanceIdentifier)
  );

  const instancesNoBackups = allInstances.filter(i => i.BackupRetentionPeriod === 0);
  addCheck(
    'Automatic Backups',
    instancesNoBackups.length === 0,
    instancesNoBackups.length === 0
      ? 'All RDS instances have automatic backups enabled.'
      : `Some instances (${instancesNoBackups.map(i => `${i.DBInstanceIdentifier} (${i.Region})`).join(', ')}) lack backups.`,
    instancesNoBackups.map(i => i.DBInstanceIdentifier)
  );

  const instancesNotInVpc = allInstances.filter(i => !i.DBSubnetGroup?.VpcId);
  addCheck(
    'Instances in VPC',
    instancesNotInVpc.length === 0,
    instancesNotInVpc.length === 0
      ? 'All RDS instances are in a VPC.'
      : `Some instances (${instancesNotInVpc.map(i => `${i.DBInstanceIdentifier} (${i.Region})`).join(', ')}) are not in a VPC.`,
    instancesNotInVpc.map(i => i.DBInstanceIdentifier)
  );

  const instancesPublic = allInstances.filter(i => i.PubliclyAccessible);
  addCheck(
    'Not Publicly Accessible',
    instancesPublic.length === 0,
    instancesPublic.length === 0
      ? 'No RDS instances are publicly accessible.'
      : `Some instances (${instancesPublic.map(i => `${i.DBInstanceIdentifier} (${i.Region})`).join(', ')}) are publicly accessible.`,
    instancesPublic.map(i => i.DBInstanceIdentifier)
  );

  const instancesNoDeletion = allInstances.filter(i => !i.DeletionProtection);
  addCheck(
    'Deletion Protection',
    instancesNoDeletion.length === 0,
    instancesNoDeletion.length === 0
      ? 'All RDS instances have deletion protection.'
      : `Some instances (${instancesNoDeletion.map(i => `${i.DBInstanceIdentifier} (${i.Region})`).join(', ')}) lack deletion protection.`,
    instancesNoDeletion.map(i => i.DBInstanceIdentifier)
  );

  const instancesNoMultiAz = allInstances.filter(i => !i.MultiAZ);
  addCheck(
    'Multi-AZ Enabled',
    instancesNoMultiAz.length === 0,
    instancesNoMultiAz.length === 0
      ? 'All RDS instances have Multi-AZ enabled.'
      : `Some instances (${instancesNoMultiAz.map(i => `${i.DBInstanceIdentifier} (${i.Region})`).join(', ')}) lack Multi-AZ.`,
    instancesNoMultiAz.map(i => i.DBInstanceIdentifier)
  );

  const instancesNoMonitoring = allInstances.filter(i => !i.EnhancedMonitoringResourceArn);
  addCheck(
    'Enhanced Monitoring',
    instancesNoMonitoring.length === 0,
    instancesNoMonitoring.length === 0
      ? 'All RDS instances have enhanced monitoring enabled.'
      : `Some instances (${instancesNoMonitoring.map(i => `${i.DBInstanceIdentifier} (${i.Region})`).join(', ')}) lack enhanced monitoring.`,
    instancesNoMonitoring.map(i => i.DBInstanceIdentifier)
  );

  const instancesDefaultPg = allInstances.filter(i => 
    i.DBParameterGroups.some(pg => pg.DBParameterGroupName.startsWith('default.'))
  );
  addCheck(
    'Custom Parameter Groups',
    instancesDefaultPg.length === 0,
    instancesDefaultPg.length === 0
      ? 'All RDS instances use custom parameter groups.'
      : `Some instances (${instancesDefaultPg.map(i => `${i.DBInstanceIdentifier} (${i.Region})`).join(', ')}) use default parameter groups.`,
    instancesDefaultPg.map(i => i.DBInstanceIdentifier)
  );

  const snapshotsNotEncrypted = allSnapshots.filter(s => !s.Encrypted);
  addCheck(
    'Snapshots Encrypted',
    snapshotsNotEncrypted.length === 0,
    snapshotsNotEncrypted.length === 0
      ? 'All RDS snapshots are encrypted.'
      : `Some snapshots (${snapshotsNotEncrypted.map(s => `${s.DBSnapshotIdentifier} (${s.Region})`).join(', ')}) lack encryption.`,
    snapshotsNotEncrypted.map(s => s.DBSnapshotIdentifier)
  );

  const instancesNoIam = allInstances.filter(i => !i.IAMDatabaseAuthenticationEnabled);
  addCheck(
    'IAM Authentication',
    instancesNoIam.length === 0,
    instancesNoIam.length === 0
      ? 'All RDS instances have IAM database authentication enabled.'
      : `Some instances (${instancesNoIam.map(i => `${i.DBInstanceIdentifier} (${i.Region})`).join(', ')}) lack IAM auth.`,
    instancesNoIam.map(i => i.DBInstanceIdentifier)
  );

  const subnetGroupsSingleAz = allSubnetGroups.filter(sg => {
    const azs = new Set(sg.Subnets.map(subnet => subnet.SubnetAvailabilityZone));
    return azs.size < 2;
  });
  addCheck(
    'Subnet Groups Multi-AZ',
    subnetGroupsSingleAz.length === 0,
    subnetGroupsSingleAz.length === 0
      ? 'All DB subnet groups span multiple AZs.'
      : `Some subnet groups (${subnetGroupsSingleAz.map(sg => `${sg.DBSubnetGroupName} (${sg.Region})`).join(', ')}) do not span multiple AZs.`,
    subnetGroupsSingleAz.map(sg => sg.DBSubnetGroupName)
  );

  const instancesNoTags = allInstances.filter(i => !i.TagList?.length);
  addCheck(
    'RDS Tagging',
    instancesNoTags.length === 0,
    instancesNoTags.length === 0
      ? 'All RDS instances are tagged.'
      : `Some instances (${instancesNoTags.map(i => `${i.DBInstanceIdentifier} (${i.Region})`).join(', ')}) lack tags.`,
    instancesNoTags.map(i => i.DBInstanceIdentifier)
  );

  const instancesShortRetention = allInstances.filter(i => i.BackupRetentionPeriod < 7);
  addCheck(
    'Sufficient Backup Retention',
    instancesShortRetention.length === 0,
    instancesShortRetention.length === 0
      ? 'All RDS instances have a backup retention period of 7+ days.'
      : `Some instances (${instancesShortRetention.map(i => `${i.DBInstanceIdentifier} (${i.Region})`).join(', ')}) have short retention periods.`,
    instancesShortRetention.map(i => i.DBInstanceIdentifier)
  );

  const latestEngines = ['mysql8.0', 'postgres15', 'aurora-mysql8.0', 'aurora-postgresql15'];
  const instancesOldEngine = allInstances.filter(i => {
    const engineVersion = `${i.Engine}${i.EngineVersion.split('.')[0]}.${i.EngineVersion.split('.')[1]}`;
    return !latestEngines.some(latest => engineVersion.startsWith(latest));
  });
  addCheck(
    'Latest Engine Version',
    instancesOldEngine.length === 0,
    instancesOldEngine.length === 0
      ? 'All RDS instances use a recent engine version.'
      : `Some instances (${instancesOldEngine.map(i => `${i.DBInstanceIdentifier} (${i.Region})`).join(', ')}) use outdated engine versions.`,
    instancesOldEngine.map(i => i.DBInstanceIdentifier)
  );

  return {
    ...checks,
    totalAssets: allInstances.length + allSnapshots.length,
    assetsAtRisk: assetsAtRiskSet.size,
  };
}

module.exports = { runRdsChecks };