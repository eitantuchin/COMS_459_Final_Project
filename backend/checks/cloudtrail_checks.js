const AWS = require('aws-sdk');

async function runCloudTrailChecks(credentials) {
  const cloudtrail = new AWS.CloudTrail({ ...credentials, region: 'us-east-1' });
  const ec2 = new AWS.EC2({ ...credentials, region: 'us-east-1' });
  const regionResponse = await ec2.describeRegions().promise();
  const regions = regionResponse.Regions.map(region => region.RegionName);

  const trailPromises = regions.map(region => {
    const regionalCloudTrail = new AWS.CloudTrail({ ...credentials, region });
    return regionalCloudTrail.describeTrails().promise().then(response => ({
      region,
      trails: response.trailList,
    }));
  });

  const trailResponses = await Promise.all(trailPromises);
  const allTrails = [];
  trailResponses.forEach(response => {
    allTrails.push(...response.trails.map(trail => ({ ...trail, Region: response.region })));
  });

  const checks = {
    totalChecks: 0,
    totalPassed: 0,
    details: [],
  };

  const regionStats = {};
  regions.forEach(region => {
    regionStats[region] = { totalAssets: 0, assetsAtRisk: new Set() };
  });

  const assetsAtRiskSet = new Set();

  const addCheck = (name, passed, message, trailIds = []) => {
    checks.totalChecks++;
    if (passed) checks.totalPassed++;
    checks.details.push({ name, passed, message });
    if (!passed) {
      trailIds.forEach(id => {
        assetsAtRiskSet.add(id);
        const trail = allTrails.find(t => t.TrailARN === id) || trailDetails.find(t => t.TrailARN === id);
        if (trail && trail.Region) {
          regionStats[trail.Region].assetsAtRisk.add(id);
        }
      });
    }
  };

  const trailsExist = allTrails.length > 0;
  addCheck(
    'CloudTrail Trails Exist',
    trailsExist,
    trailsExist ? 'CloudTrail trails are present.' : 'No CloudTrail trails found (critical for auditing).'
  );

  let trailDetails = [];
  if (trailsExist) {
    trailDetails = await Promise.all(
      allTrails.map(trail => {
        const regionalCloudTrail = new AWS.CloudTrail({ ...credentials, region: trail.Region });
        return Promise.all([
          regionalCloudTrail.getTrailStatus({ Name: trail.Name }).promise(),
          regionalCloudTrail.listTags({ ResourceIdList: [trail.TrailARN] }).promise(),
        ]).then(([status, tags]) => ({
          ...trail,
          status,
          tags: tags.ResourceTagList[0]?.TagsList || [],
        }));
      })
    );

    const trailsNotLogging = trailDetails.filter(t => !t.status.IsLogging);
    addCheck(
      'Trails Enabled',
      trailsNotLogging.length === 0,
      trailsNotLogging.length === 0
        ? 'All CloudTrail trails are enabled.'
        : `Some trails (${trailsNotLogging.map(t => `${t.Name} (${t.Region})`).join(', ')}) are not logging.`,
      trailsNotLogging.map(t => t.TrailARN)
    );

    const trailsNotMultiRegion = trailDetails.filter(t => !t.IsMultiRegionTrail);
    addCheck(
      'Multi-Region Trails',
      trailsNotMultiRegion.length === 0,
      trailsNotMultiRegion.length === 0
        ? 'All CloudTrail trails are multi-region.'
        : `Some trails (${trailsNotMultiRegion.map(t => `${t.Name} (${t.Region})`).join(', ')}) are not multi-region.`,
      trailsNotMultiRegion.map(t => t.TrailARN)
    );

    const trailsNoGlobalEvents = trailDetails.filter(t => !t.IncludeGlobalServiceEvents);
    addCheck(
      'Global Service Events',
      trailsNoGlobalEvents.length === 0,
      trailsNoGlobalEvents.length === 0
        ? 'All CloudTrail trails log global service events.'
        : `Some trails (${trailsNoGlobalEvents.map(t => `${t.Name} (${t.Region})`).join(', ')}) do not log global service events.`,
      trailsNoGlobalEvents.map(t => t.TrailARN)
    );

    addCheck(
      'S3 Bucket Defined',
      trailDetails.every(trail => trail.S3BucketName),
      trailDetails.every(trail => trail.S3BucketName)
        ? 'All CloudTrail trails have an S3 bucket.'
        : `Some trails (${trailDetails.filter(t => !t.S3BucketName).map(t => `${t.Name} (${t.Region})`).join(', ')}) lack an S3 bucket.`,
      trailDetails.filter(t => !t.S3BucketName).map(t => t.TrailARN)
    );

    const trailsNoValidation = trailDetails.filter(t => !t.LogFileValidationEnabled);
    addCheck(
      'Log File Validation',
      trailsNoValidation.length === 0,
      trailsNoValidation.length === 0
        ? 'All CloudTrail trails have log file validation enabled.'
        : `Some trails (${trailsNoValidation.map(t => `${t.Name} (${t.Region})`).join(', ')}) lack log file validation.`,
      trailsNoValidation.map(t => t.TrailARN)
    );

    const trailsNoKms = trailDetails.filter(t => !t.KmsKeyId);
    addCheck(
      'KMS Encryption',
      trailsNoKms.length === 0,
      trailsNoKms.length === 0
        ? 'All CloudTrail trails use KMS encryption for logs.'
        : `Some trails (${trailsNoKms.map(t => `${t.Name} (${t.Region})`).join(', ')}) lack KMS encryption.`,
      trailsNoKms.map(t => t.TrailARN)
    );

    const trailsNoCloudWatch = trailDetails.filter(t => !t.CloudWatchLogsLogGroupArn);
    addCheck(
      'CloudWatch Logs Integration',
      trailsNoCloudWatch.length === 0,
      trailsNoCloudWatch.length === 0
        ? 'All CloudTrail trails are integrated with CloudWatch Logs.'
        : `Some trails (${trailsNoCloudWatch.map(t => `${t.Name} (${t.Region})`).join(', ')}) lack CloudWatch Logs integration.`,
      trailsNoCloudWatch.map(t => t.TrailARN)
    );

    const trailsNoTags = trailDetails.filter(t => t.tags.length === 0);
    addCheck(
      'CloudTrail Tagging',
      trailsNoTags.length === 0,
      trailsNoTags.length === 0
        ? 'All CloudTrail trails are tagged.'
        : `Some trails (${trailsNoTags.map(t => `${t.Name} (${t.Region})`).join(', ')}) lack tags.`,
      trailsNoTags.map(t => t.TrailARN)
    );

    const eventSelectors = await Promise.all(
      trailDetails.map(trail => 
        new AWS.CloudTrail({ ...credentials, region: trail.Region })
          .getEventSelectors({ TrailName: trail.Name })
          .promise()
      )
    );
    const trailsNoManagement = eventSelectors.map((selector, i) => ({
      trail: trailDetails[i],
      logsManagement: selector.EventSelectors?.some(es => es.ReadWriteType === 'All' || es.ReadWriteType === 'WriteOnly'),
    })).filter(t => !t.logsManagement);
    addCheck(
      'Log Management Events',
      trailsNoManagement.length === 0,
      trailsNoManagement.length === 0
        ? 'All CloudTrail trails log management events.'
        : `Some trails (${trailsNoManagement.map(t => `${t.trail.Name} (${t.trail.Region})`).join(', ')}) do not log management events.`,
      trailsNoManagement.map(t => t.trail.TrailARN)
    );

    const trailsNoDataEvents = eventSelectors.map((selector, i) => ({
      trail: trailDetails[i],
      logsData: selector.DataResources?.length > 0,
    })).filter(t => !t.logsData);
    addCheck(
      'Log Data Events',
      trailsNoDataEvents.length === 0,
      trailsNoDataEvents.length === 0
        ? 'All CloudTrail trails log data events.'
        : `Some trails (${trailsNoDataEvents.map(t => `${t.trail.Name} (${t.trail.Region})`).join(', ')}) do not log data events.`,
      trailsNoDataEvents.map(t => t.trail.TrailARN)
    );

    const s3 = new AWS.S3({ ...credentials, region: 'us-east-1' });
    const bucketLifecycles = await Promise.all(
      trailDetails.map(trail => 
        trail.S3BucketName 
          ? s3.getBucketLifecycleConfiguration({ Bucket: trail.S3BucketName }).promise().catch(() => null) 
          : null
      )
    );
    const trailsNoRetention = trailDetails.filter((trail, i) => !bucketLifecycles[i]?.Rules?.length);
    addCheck(
      'S3 Retention Policy',
      trailsNoRetention.length === 0,
      trailsNoRetention.length === 0
        ? 'All CloudTrail S3 buckets have a retention policy.'
        : `Some trails (${trailsNoRetention.map(t => `${t.Name} (${t.Region})`).join(', ')}) lack a retention policy.`,
      trailsNoRetention.map(t => t.TrailARN)
    );

    const trailsNoSns = trailDetails.filter(t => !t.SnsTopicARN);
    addCheck(
      'SNS Notifications',
      trailsNoSns.length === 0,
      trailsNoSns.length === 0
        ? 'All CloudTrail trails have SNS notifications configured.'
        : `Some trails (${trailsNoSns.map(t => `${t.Name} (${t.Region})`).join(', ')}) lack SNS notifications.`,
      trailsNoSns.map(t => t.TrailARN)
    );

    const bucketAcls = await Promise.all(
      trailDetails.map(trail => 
        trail.S3BucketName 
          ? s3.getBucketAcl({ Bucket: trail.S3BucketName }).promise() 
          : null
      )
    );
    const trailsPublicBuckets = trailDetails.filter((trail, i) => 
      bucketAcls[i]?.Grants.some(grant => 
        grant.Grantee.URI === 'http://acs.amazonaws.com/groups/global/AllUsers' || 
        grant.Grantee.URI === 'http://acs.amazonaws.com/groups/global/AuthenticatedUsers'
      )
    );
    addCheck(
      'Private S3 Buckets',
      trailsPublicBuckets.length === 0,
      trailsPublicBuckets.length === 0
        ? 'All CloudTrail S3 buckets are private.'
        : `Some trails (${trailsPublicBuckets.map(t => `${t.Name} (${t.Region})`).join(', ')}) have public S3 buckets.`,
      trailsPublicBuckets.map(t => t.TrailARN)
    );

    const trailsNoRecent = trailDetails.filter(t => {
      const latestDelivery = t.status.LatestDeliveryTime;
      return !latestDelivery || (Date.now() - new Date(latestDelivery).getTime()) >= 24 * 60 * 60 * 1000;
    });
    addCheck(
      'Recent Activity',
      trailsNoRecent.length === 0,
      trailsNoRecent.length === 0
        ? 'All CloudTrail trails have recent activity (last 24 hours).'
        : `Some trails (${trailsNoRecent.map(t => `${t.Name} (${t.Region})`).join(', ')}) have no recent activity.`,
      trailsNoRecent.map(t => t.TrailARN)
    );
  }

  // Calculate total assets per region
  regions.forEach(region => {
    regionStats[region].totalAssets = allTrails.filter(t => t.Region === region).length;
  });

  return {
    ...checks,
    totalAssets: allTrails.length,
    assetsAtRisk: assetsAtRiskSet.size,
    regionStats: Object.fromEntries(
      Object.entries(regionStats).map(([region, stats]) => [region, {
        totalAssets: stats.totalAssets,
        assetsAtRisk: stats.assetsAtRisk.size
      }])
    )
  };
}

module.exports = { runCloudTrailChecks };