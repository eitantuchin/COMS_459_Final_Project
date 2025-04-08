const AWS = require('aws-sdk');

async function runS3Checks(credentials) {
  const s3 = new AWS.S3({ ...credentials, region: 'us-east-1' });
  const ec2 = new AWS.EC2({ ...credentials, region: 'us-east-1' });
  const regionResponse = await ec2.describeRegions().promise();
  const regions = regionResponse.Regions.map(region => region.RegionName);

  const bucketsResponse = await s3.listBuckets().promise();
  const buckets = await Promise.all(
    bucketsResponse.Buckets.map(async bucket => {
      const location = await s3.getBucketLocation({ Bucket: bucket.Name }).promise();
      const region = location.LocationConstraint || 'us-east-1'; // Default to us-east-1 if empty
      return { ...bucket, Region: region };
    })
  );

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

  const addCheck = (name, passed, message, assetIds = []) => {
    checks.totalChecks++;
    if (passed) checks.totalPassed++;
    checks.details.push({ name, passed, message });
    if (!passed) {
      assetIds.forEach(id => {
        assetsAtRiskSet.add(id);
        const bucket = buckets.find(b => b.Name === id) || bucketDetails.find(b => b.Name === id);
        if (bucket && bucket.Region) {
          regionStats[bucket.Region].assetsAtRisk.add(id);
        }
      });
    }
  };

  const bucketsExist = buckets.length > 0;
  addCheck(
    'S3 Buckets Exist',
    bucketsExist,
    bucketsExist ? 'S3 buckets are present.' : 'No S3 buckets found.'
  );

  let bucketDetails = [];
  if (bucketsExist) {
    bucketDetails = await Promise.all(
      buckets.map(async bucket => {
        const [policy, acl, encryption, versioning, publicAccess, logging] = await Promise.all([
          s3.getBucketPolicy({ Bucket: bucket.Name }).promise().catch(() => null),
          s3.getBucketAcl({ Bucket: bucket.Name }).promise(),
          s3.getBucketEncryption({ Bucket: bucket.Name }).promise().catch(() => null),
          s3.getBucketVersioning({ Bucket: bucket.Name }).promise(),
          s3.getPublicAccessBlock({ Bucket: bucket.Name }).promise().catch(() => null),
          s3.getBucketLogging({ Bucket: bucket.Name }).promise(),
        ]);
        return {
          ...bucket,
          policy: policy?.Policy,
          acl: acl.Grants,
          encryption: encryption?.ServerSideEncryptionConfiguration,
          versioning: versioning.Status,
          publicAccess: publicAccess?.PublicAccessBlockConfiguration,
          logging: logging.BucketLoggingStatus,
        };
      })
    );

    const bucketsNoEncryption = bucketDetails.filter(d => !d.encryption);
    addCheck(
      'Server-Side Encryption',
      bucketsNoEncryption.length === 0,
      bucketsNoEncryption.length === 0
        ? 'All buckets have server-side encryption enabled.'
        : `Some buckets (${bucketsNoEncryption.map(d => `${d.Name} (${d.Region})`).join(', ')}) lack encryption.`,
      bucketsNoEncryption.map(d => d.Name)
    );

    const bucketsNoVersioning = bucketDetails.filter(d => d.versioning !== 'Enabled');
    addCheck(
      'Versioning Enabled',
      bucketsNoVersioning.length === 0,
      bucketsNoVersioning.length === 0
        ? 'All buckets have versioning enabled.'
        : `Some buckets (${bucketsNoVersioning.map(d => `${d.Name} (${d.Region})`).join(', ')}) lack versioning.`,
      bucketsNoVersioning.map(d => d.Name)
    );

    const bucketsNoPublicBlock = bucketDetails.filter(d => 
      !d.publicAccess || 
      !(d.publicAccess.BlockPublicAcls && d.publicAccess.IgnorePublicAcls && 
        d.publicAccess.BlockPublicPolicy && d.publicAccess.RestrictPublicBuckets)
    );
    addCheck(
      'Block Public Access',
      bucketsNoPublicBlock.length === 0,
      bucketsNoPublicBlock.length === 0
        ? 'All buckets block public access.'
        : `Some buckets (${bucketsNoPublicBlock.map(d => `${d.Name} (${d.Region})`).join(', ')}) do not fully block public access.`,
      bucketsNoPublicBlock.map(d => d.Name)
    );

    const bucketsPublicAcls = bucketDetails.filter(d => 
      d.acl.some(g => 
        (g.Grantee.URI === 'http://acs.amazonaws.com/groups/global/AllUsers' || 
         g.Grantee.URI === 'http://acs.amazonaws.com/groups/global/AuthenticatedUsers') && 
        g.Permission !== 'READ'
      )
    );
    addCheck(
      'No Public ACLs',
      bucketsPublicAcls.length === 0,
      bucketsPublicAcls.length === 0
        ? 'No buckets have public ACLs granting access.'
        : `Some buckets (${bucketsPublicAcls.map(d => `${d.Name} (${d.Region})`).join(', ')}) have public ACLs.`,
      bucketsPublicAcls.map(d => d.Name)
    );

    const bucketsNoPolicy = bucketDetails.filter(d => !d.policy);
    addCheck(
      'Bucket Policy Exists',
      bucketsNoPolicy.length === 0,
      bucketsNoPolicy.length === 0
        ? 'All buckets have a bucket policy.'
        : `Some buckets (${bucketsNoPolicy.map(d => `${d.Name} (${d.Region})`).join(', ')}) lack a bucket policy.`,
      bucketsNoPolicy.map(d => d.Name)
    );

    const bucketsAllowUnencrypted = bucketDetails.filter(d => 
      !d.policy || 
      !JSON.parse(d.policy).Statement.some(s => 
        s.Effect === 'Deny' && s.Condition?.Bool?.['aws:SecureTransport'] === 'false'
      )
    );
    addCheck(
      'Deny Unencrypted PUT',
      bucketsAllowUnencrypted.length === 0,
      bucketsAllowUnencrypted.length === 0
        ? 'All bucket policies deny unencrypted PUT operations.'
        : `Some buckets (${bucketsAllowUnencrypted.map(d => `${d.Name} (${d.Region})`).join(', ')}) allow unencrypted PUTs.`,
      bucketsAllowUnencrypted.map(d => d.Name)
    );

    const bucketsNoLogging = bucketDetails.filter(d => !d.logging?.LoggingEnabled);
    addCheck(
      'Logging Enabled',
      bucketsNoLogging.length === 0,
      bucketsNoLogging.length === 0
        ? 'All buckets have logging enabled.'
        : `Some buckets (${bucketsNoLogging.map(d => `${d.Name} (${d.Region})`).join(', ')}) lack logging.`,
      bucketsNoLogging.map(d => d.Name)
    );

    const lifecycleRules = await Promise.all(buckets.map(bucket => 
      s3.getBucketLifecycleConfiguration({ Bucket: bucket.Name }).promise().catch(() => null)
    ));
    const bucketsNoLifecycle = buckets.filter((_, i) => !lifecycleRules[i]?.Rules?.length);
    addCheck(
      'Lifecycle Rules',
      bucketsNoLifecycle.length === 0,
      bucketsNoLifecycle.length === 0
        ? 'All buckets have lifecycle rules.'
        : `Some buckets (${bucketsNoLifecycle.map(b => `${b.Name} (${b.Region})`).join(', ')}) lack lifecycle rules.`,
      bucketsNoLifecycle.map(b => b.Name)
    );

    const tags = await Promise.all(buckets.map(bucket => 
      s3.getBucketTagging({ Bucket: bucket.Name }).promise().catch(() => ({ TagSet: [] }))
    ));
    const bucketsNoTags = buckets.filter((_, i) => !tags[i].TagSet.length);
    addCheck(
      'Bucket Tagging',
      bucketsNoTags.length === 0,
      bucketsNoTags.length === 0
        ? 'All buckets are tagged.'
        : `Some buckets (${bucketsNoTags.map(b => `${b.Name} (${b.Region})`).join(', ')}) lack tags.`,
      bucketsNoTags.map(b => b.Name)
    );

    const bucketsNoSsl = bucketDetails.filter(d => 
      !d.policy || 
      !JSON.parse(d.policy).Statement.some(s => 
        s.Effect === 'Deny' && s.Condition?.Bool?.['aws:SecureTransport'] === 'false'
      )
    );
    addCheck(
      'Enforce SSL',
      bucketsNoSsl.length === 0,
      bucketsNoSsl.length === 0
        ? 'All buckets enforce SSL via policy.'
        : `Some buckets (${bucketsNoSsl.map(d => `${d.Name} (${d.Region})`).join(', ')}) do not enforce SSL.`,
      bucketsNoSsl.map(d => d.Name)
    );

    const bucketsPermissive = bucketDetails.filter(d => 
      d.policy && 
      JSON.parse(d.policy).Statement.some(s => 
        s.Effect === 'Allow' && s.Principal === '*' && !s.Condition
      )
    );
    addCheck(
      'No Overly Permissive Policies',
      bucketsPermissive.length === 0,
      bucketsPermissive.length === 0
        ? 'No buckets have overly permissive policies.'
        : `Some buckets (${bucketsPermissive.map(d => `${d.Name} (${d.Region})`).join(', ')}) have overly permissive policies.`,
      bucketsPermissive.map(d => d.Name)
    );

    const objectLocks = await Promise.all(buckets.map(bucket => 
      s3.getObjectLockConfiguration({ Bucket: bucket.Name }).promise().catch(() => null)
    ));
    const bucketsNoObjectLock = buckets.filter((_, i) => 
      !objectLocks[i]?.ObjectLockConfiguration?.ObjectLockEnabled === 'Enabled'
    );
    addCheck(
      'Object Lock Enabled',
      bucketsNoObjectLock.length === 0,
      bucketsNoObjectLock.length === 0
        ? 'All buckets have object lock enabled.'
        : `Some buckets (${bucketsNoObjectLock.map(b => `${b.Name} (${b.Region})`).join(', ')}) lack object lock.`,
      bucketsNoObjectLock.map(b => b.Name)
    );

    const bucketsNoKms = bucketDetails.filter(d => 
      !d.encryption?.Rules.some(r => r.ApplyServerSideEncryptionByDefault?.SSEAlgorithm === 'aws:kms')
    );
    addCheck(
      'KMS Encryption',
      bucketsNoKms.length === 0,
      bucketsNoKms.length === 0
        ? 'All buckets use KMS for default encryption.'
        : `Some buckets (${bucketsNoKms.map(d => `${d.Name} (${d.Region})`).join(', ')}) use AES-256 or no default encryption instead of KMS.`,
      bucketsNoKms.map(d => d.Name)
    );

    const publicObjects = await Promise.all(buckets.map(async bucket => {
      const objects = await s3.listObjectsV2({ Bucket: bucket.Name, MaxKeys: 10 }).promise();
      if (!objects.Contents.length) return true;
      const acls = await Promise.all(objects.Contents.map(obj => 
        s3.getObjectAcl({ Bucket: bucket.Name, Key: obj.Key }).promise()
      ));
      return !acls.some(acl => 
        acl.Grants.some(g => 
          g.Grantee.URI === 'http://acs.amazonaws.com/groups/global/AllUsers' && g.Permission === 'READ'
        )
      );
    }));
    const bucketsPublicObjects = buckets.filter((_, i) => !publicObjects[i]);
    addCheck(
      'No Public Objects',
      bucketsPublicObjects.length === 0,
      bucketsPublicObjects.length === 0
        ? 'No buckets have publicly readable objects (sampled).'
        : `Some buckets (${bucketsPublicObjects.map(b => `${b.Name} (${b.Region})`).join(', ')}) have publicly readable objects (sampled).`,
      bucketsPublicObjects.map(b => b.Name)
    );
  }

  // Calculate total assets per region
  regions.forEach(region => {
    regionStats[region].totalAssets = buckets.filter(b => b.Region === region).length;
  });

  return {
    ...checks,
    totalAssets: buckets.length,
    assetsAtRisk: assetsAtRiskSet.size,
    regionStats: Object.fromEntries(
      Object.entries(regionStats).map(([region, stats]) => [region, {
        totalAssets: stats.totalAssets,
        assetsAtRisk: stats.assetsAtRisk.size
      }])
    )
  };
}

module.exports = { runS3Checks };