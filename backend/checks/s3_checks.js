const AWS = require('aws-sdk');

// Function to run all S3 security checks
async function runS3Checks(credentials) {
  const s3 = new AWS.S3({ ...credentials, region: 'us-east-1' }); // S3 requires a region for some calls

  // Fetch all S3 buckets
  const bucketsResponse = await s3.listBuckets().promise();
  const buckets = bucketsResponse.Buckets;

  // Security Checks
  const checks = {
    totalChecks: 0,
    totalPassed: 0,
    details: [],
  };

  // Helper function to add check result
  const addCheck = (name, passed, message) => {
    checks.totalChecks++;
    if (passed) checks.totalPassed++;
    checks.details.push({ name, passed, message });
  };

  // 1. Check if there are any S3 buckets
  const bucketsExist = buckets.length > 0;
  addCheck(
    'S3 Buckets Exist',
    bucketsExist,
    bucketsExist
      ? 'S3 buckets are present.'
      : 'No S3 buckets found (no checks applicable if none exist).'
  );

  // If no buckets exist, skip remaining checks
  if (!bucketsExist) {
    return checks;
  }

  // Fetch additional bucket details concurrently
  const bucketDetails = await Promise.all(
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
        name: bucket.Name,
        policy: policy?.Policy,
        acl: acl.Grants,
        encryption: encryption?.ServerSideEncryptionConfiguration,
        versioning: versioning.Status,
        publicAccess: publicAccess?.PublicAccessBlockConfiguration,
        logging: logging.BucketLoggingStatus,
      };
    })
  );

  // 2. Check if all buckets have server-side encryption enabled
  const allEncrypted = bucketDetails.every(detail => detail.encryption);
  addCheck(
    'Server-Side Encryption',
    allEncrypted,
    allEncrypted
      ? 'All buckets have server-side encryption enabled.'
      : `Some buckets (${bucketDetails.filter(d => !d.encryption).map(d => d.name).join(', ')}) lack encryption.`
  );

  // 3. Check if all buckets have versioning enabled
  const allVersioned = bucketDetails.every(detail => detail.versioning === 'Enabled');
  addCheck(
    'Versioning Enabled',
    allVersioned,
    allVersioned
      ? 'All buckets have versioning enabled.'
      : `Some buckets (${bucketDetails.filter(d => d.versioning !== 'Enabled').map(d => d.name).join(', ')}) lack versioning.`
  );

  // 4. Check if all buckets block public access
  const allBlockPublic = bucketDetails.every(detail => 
    detail.publicAccess && 
    detail.publicAccess.BlockPublicAcls &&
    detail.publicAccess.IgnorePublicAcls &&
    detail.publicAccess.BlockPublicPolicy &&
    detail.publicAccess.RestrictPublicBuckets
  );
  addCheck(
    'Block Public Access',
    allBlockPublic,
    allBlockPublic
      ? 'All buckets block public access.'
      : `Some buckets (${bucketDetails.filter(d => !d.publicAccess || !d.publicAccess.BlockPublicAcls).map(d => d.name).join(', ')}) do not fully block public access.`
  );

  // 5. Check if no buckets have public ACLs granting access
  const noPublicAcls = bucketDetails.every(detail => 
    !detail.acl.some(grant => 
      (grant.Grantee.URI === 'http://acs.amazonaws.com/groups/global/AllUsers' || 
       grant.Grantee.URI === 'http://acs.amazonaws.com/groups/global/AuthenticatedUsers') && 
      grant.Permission !== 'READ'
    )
  );
  addCheck(
    'No Public ACLs',
    noPublicAcls,
    noPublicAcls
      ? 'No buckets have public ACLs granting access.'
      : 'Some buckets have public ACLs granting access.'
  );

  // 6. Check if all buckets have a bucket policy (for control)
  const allHavePolicy = bucketDetails.every(detail => detail.policy);
  addCheck(
    'Bucket Policy Exists',
    allHavePolicy,
    allHavePolicy
      ? 'All buckets have a bucket policy.'
      : `Some buckets (${bucketDetails.filter(d => !d.policy).map(d => d.name).join(', ')}) lack a bucket policy.`
  );

  // 7. Check if bucket policies deny unencrypted PUT operations
  const allDenyUnencrypted = bucketDetails.every(detail => 
    detail.policy && 
    JSON.parse(detail.policy).Statement.some(statement => 
      statement.Effect === 'Deny' && 
      statement.Condition?.Bool?.['aws:SecureTransport'] === 'false'
    )
  );
  addCheck(
    'Deny Unencrypted PUT',
    allDenyUnencrypted,
    allDenyUnencrypted
      ? 'All bucket policies deny unencrypted PUT operations.'
      : 'Some buckets allow unencrypted PUT operations.'
  );

  // 8. Check if all buckets have logging enabled
  const allLoggingEnabled = bucketDetails.every(detail => detail.logging?.LoggingEnabled);
  addCheck(
    'Logging Enabled',
    allLoggingEnabled,
    allLoggingEnabled
      ? 'All buckets have logging enabled.'
      : `Some buckets (${bucketDetails.filter(d => !d.logging?.LoggingEnabled).map(d => d.name).join(', ')}) lack logging.`
  );

  // 9. Check if buckets have lifecycle rules (for cost/security)
  const lifecycleRules = await Promise.all(buckets.map(bucket => 
    s3.getBucketLifecycleConfiguration({ Bucket: bucket.Name }).promise().catch(() => null)
  ));
  const allHaveLifecycle = lifecycleRules.every(rule => rule?.Rules?.length > 0);
  addCheck(
    'Lifecycle Rules',
    allHaveLifecycle,
    allHaveLifecycle
      ? 'All buckets have lifecycle rules.'
      : 'Some buckets lack lifecycle rules.'
  );

  // 10. Check if buckets have tags (for management)
  const tags = await Promise.all(buckets.map(bucket => 
    s3.getBucketTagging({ Bucket: bucket.Name }).promise().catch(() => ({ TagSet: [] }))
  ));
  const allTagged = tags.every(tag => tag.TagSet.length > 0);
  addCheck(
    'Bucket Tagging',
    allTagged,
    allTagged
      ? 'All buckets are tagged.'
      : 'Some buckets lack tags.'
  );

  // 11. Check if buckets enforce SSL (SecureTransport)
  const allEnforceSsl = bucketDetails.every(detail => 
    detail.policy && 
    JSON.parse(detail.policy).Statement.some(statement => 
      statement.Effect === 'Deny' && 
      statement.Condition?.Bool?.['aws:SecureTransport'] === 'false'
    )
  );
  addCheck(
    'Enforce SSL',
    allEnforceSsl,
    allEnforceSsl
      ? 'All buckets enforce SSL via policy.'
      : 'Some buckets do not enforce SSL.'
  );

  // 12. Check if buckets have no overly permissive policies (e.g., '*')
  const noOverlyPermissive = bucketDetails.every(detail => 
    !detail.policy || 
    !JSON.parse(detail.policy).Statement.some(statement => 
      statement.Effect === 'Allow' && 
      statement.Principal === '*' && 
      !statement.Condition
    )
  );
  addCheck(
    'No Overly Permissive Policies',
    noOverlyPermissive,
    noOverlyPermissive
      ? 'No buckets have overly permissive policies.'
      : 'Some buckets have overly permissive policies.'
  );

  // 13. Check if buckets have object lock enabled (for compliance)
  const objectLocks = await Promise.all(buckets.map(bucket => 
    s3.getObjectLockConfiguration({ Bucket: bucket.Name }).promise().catch(() => null)
  ));
  const allObjectLocked = objectLocks.every(lock => lock?.ObjectLockConfiguration?.ObjectLockEnabled === 'Enabled');
  addCheck(
    'Object Lock Enabled',
    allObjectLocked,
    allObjectLocked
      ? 'All buckets have object lock enabled.'
      : 'Some buckets lack object lock (optional for compliance).'
  );

  // 14. Check if buckets have default encryption with KMS (not AES-256)
  const allKmsEncrypted = bucketDetails.every(detail => 
    detail.encryption?.Rules.some(rule => 
      rule.ApplyServerSideEncryptionByDefault?.SSEAlgorithm === 'aws:kms'
    )
  );
  addCheck(
    'K ThreadPoolMS Encryption',
    allKmsEncrypted,
    allKmsEncrypted
      ? 'All buckets use KMS for default encryption.'
      : 'Some buckets use AES-256 or no default encryption instead of KMS.'
  );

  // 15. Check if buckets have no objects with public read access
  const publicObjects = await Promise.all(buckets.map(async bucket => {
    const objects = await s3.listObjectsV2({ Bucket: bucket.Name, MaxKeys: 10 }).promise();
    if (objects.Contents.length === 0) return true;
    const acls = await Promise.all(objects.Contents.map(obj => 
      s3.getObjectAcl({ Bucket: bucket.Name, Key: obj.Key }).promise()
    ));
    return !acls.some(acl => 
      acl.Grants.some(grant => 
        grant.Grantee.URI === 'http://acs.amazonaws.com/groups/global/AllUsers' && 
        grant.Permission === 'READ'
      )
    );
  }));
  const noPublicObjects = publicObjects.every(result => result);
  addCheck(
    'No Public Objects',
    noPublicObjects,
    noPublicObjects
      ? 'No buckets have publicly readable objects (sampled).'
      : 'Some buckets have publicly readable objects (sampled).'
  );

  return checks;
}

module.exports = { runS3Checks };