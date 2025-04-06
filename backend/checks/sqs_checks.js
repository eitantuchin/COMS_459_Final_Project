const AWS = require('aws-sdk');

async function runSqsChecks(credentials) {
  const sqs = new AWS.SQS({ ...credentials, region: 'us-east-1' });
  const ec2 = new AWS.EC2({ ...credentials, region: 'us-east-1' });
  const regionResponse = await ec2.describeRegions().promise();
  const regions = regionResponse.Regions.map(region => region.RegionName);

  const sqsPromises = regions.map(region => {
    const regionalSqs = new AWS.SQS({ ...credentials, region });
    return regionalSqs.listQueues().promise().then(response => ({
      region,
      queueUrls: response.QueueUrls || [],
    }));
  });

  const sqsResponses = await Promise.all(sqsPromises);
  const allQueueUrls = [];
  sqsResponses.forEach(response => {
    allQueueUrls.push(...response.queueUrls.map(url => ({ QueueUrl: url, Region: response.region })));
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

  const queuesExist = allQueueUrls.length > 0;
  addCheck(
    'SQS Queues Exist',
    queuesExist,
    queuesExist ? 'SQS queues are present.' : 'No SQS queues found.'
  );

  if (!queuesExist) {
    return { ...checks, totalAssets: allQueueUrls.length, assetsAtRisk: assetsAtRiskSet.size };
  }

  const queueDetails = await Promise.all(
    allQueueUrls.map(queue => {
      const regionalSqs = new AWS.SQS({ ...credentials, region: queue.Region });
      return Promise.all([
        regionalSqs.getQueueAttributes({ QueueUrl: queue.QueueUrl, AttributeNames: ['All'] }).promise(),
        regionalSqs.listQueueTags({ QueueUrl: queue.QueueUrl }).promise(),
      ]).then(([attributes, tags]) => ({
        ...queue,
        attributes: attributes.Attributes,
        tags: tags.Tags || {},
      }));
    })
  );

  const queuesNoEncryption = queueDetails.filter(q => q.attributes.SqsManagedSseEnabled !== 'true' && !q.attributes.KmsMasterKeyId);
  addCheck(
    'Queue Encryption',
    queuesNoEncryption.length === 0,
    queuesNoEncryption.length === 0
      ? 'All SQS queues are encrypted.'
      : `Some queues (${queuesNoEncryption.map(q => `${q.QueueUrl} (${q.Region})`).join(', ')}) lack encryption.`,
    queuesNoEncryption.map(q => q.QueueUrl)
  );

  const queuesHighTimeout = queueDetails.filter(q => parseInt(q.attributes.VisibilityTimeout) > 43200);
  addCheck(
    'Reasonable Visibility Timeout',
    queuesHighTimeout.length === 0,
    queuesHighTimeout.length === 0
      ? 'All SQS queues have a visibility timeout of 12 hours or less.'
      : `Some queues (${queuesHighTimeout.map(q => `${q.QueueUrl} (${q.Region})`).join(', ')}) have excessive timeouts.`,
    queuesHighTimeout.map(q => q.QueueUrl)
  );

  const queuesNoTags = queueDetails.filter(q => Object.keys(q.tags).length === 0);
  addCheck(
    'SQS Tagging',
    queuesNoTags.length === 0,
    queuesNoTags.length === 0
      ? 'All SQS queues are tagged.'
      : `Some queues (${queuesNoTags.map(q => `${q.QueueUrl} (${q.Region})`).join(', ')}) lack tags.`,
    queuesNoTags.map(q => q.QueueUrl)
  );

  const queuesPermissive = queueDetails.filter(q => 
    q.attributes.Policy && 
    JSON.parse(q.attributes.Policy).Statement.some(s => s.Effect === 'Allow' && s.Principal === '*' && !s.Condition)
  );
  addCheck(
    'Restrictive Access Policy',
    queuesPermissive.length === 0,
    queuesPermissive.length === 0
      ? 'All SQS queues have restrictive access policies.'
      : `Some queues (${queuesPermissive.map(q => `${q.QueueUrl} (${q.Region})`).join(', ')}) have overly permissive policies.`,
    queuesPermissive.map(q => q.QueueUrl)
  );

  const queuesNoDlq = queueDetails.filter(q => !q.attributes.RedrivePolicy);
  addCheck(
    'Dead-Letter Queue',
    queuesNoDlq.length === 0,
    queuesNoDlq.length === 0
      ? 'All SQS queues have a dead-letter queue configured.'
      : `Some queues (${queuesNoDlq.map(q => `${q.QueueUrl} (${q.Region})`).join(', ')}) lack a dead-letter queue.`,
    queuesNoDlq.map(q => q.QueueUrl)
  );

  const queuesLargeSize = queueDetails.filter(q => parseInt(q.attributes.MaximumMessageSize) > 262144);
  addCheck(
    'Reasonable Message Size',
    queuesLargeSize.length === 0,
    queuesLargeSize.length === 0
      ? 'All SQS queues have a maximum message size of 256 KB or less.'
      : `Some queues (${queuesLargeSize.map(q => `${q.QueueUrl} (${q.Region})`).join(', ')}) allow oversized messages.`,
    queuesLargeSize.map(q => q.QueueUrl)
  );

  const queuesHighDelay = queueDetails.filter(q => parseInt(q.attributes.DelaySeconds) > 900);
  addCheck(
    'Reasonable Delay',
    queuesHighDelay.length === 0,
    queuesHighDelay.length === 0
      ? 'All SQS queues have a delay of 15 minutes or less.'
      : `Some queues (${queuesHighDelay.map(q => `${q.QueueUrl} (${q.Region})`).join(', ')}) have excessive delays.`,
    queuesHighDelay.map(q => q.QueueUrl)
  );

  const queuesNoDeduplication = queueDetails.filter(q => 
    q.attributes.FifoQueue === 'true' && q.attributes.ContentBasedDeduplication !== 'true'
  );
  addCheck(
    'FIFO Deduplication',
    queuesNoDeduplication.length === 0,
    queuesNoDeduplication.length === 0
      ? 'All FIFO SQS queues have content-based deduplication enabled.'
      : `Some FIFO queues (${queuesNoDeduplication.map(q => `${q.QueueUrl} (${q.Region})`).join(', ')}) lack deduplication.`,
    queuesNoDeduplication.map(q => q.QueueUrl)
  );

  const queuesHighRetention = queueDetails.filter(q => parseInt(q.attributes.MessageRetentionPeriod) > 1209600);
  addCheck(
    'Reasonable Retention Period',
    queuesHighRetention.length === 0,
    queuesHighRetention.length === 0
      ? 'All SQS queues have a retention period of 14 days or less.'
      : `Some queues (${queuesHighRetention.map(q => `${q.QueueUrl} (${q.Region})`).join(', ')}) have excessive retention.`,
    queuesHighRetention.map(q => q.QueueUrl)
  );

  const queuesNotOwned = queueDetails.filter(q => q.attributes.QueueArn.split(':')[4] !== q.attributes.CreatedTimestamp.split(':')[4]);
  addCheck(
    'Queue Ownership',
    queuesNotOwned.length === 0,
    queuesNotOwned.length === 0
      ? 'All SQS queues are owned by the current account.'
      : `Some queues (${queuesNotOwned.map(q => `${q.QueueUrl} (${q.Region})`).join(', ')}) are owned by a different account.`,
    queuesNotOwned.map(q => q.QueueUrl)
  );

  const queuesNoMetrics = queueDetails.filter(q => !q.attributes.CreatedTimestamp);
  addCheck(
    'CloudWatch Metrics',
    queuesNoMetrics.length === 0,
    queuesNoMetrics.length === 0
      ? 'All SQS queues have CloudWatch metrics enabled (assumed via creation).'
      : `Some queues (${queuesNoMetrics.map(q => `${q.QueueUrl} (${q.Region})`).join(', ')}) may lack metrics.`,
    queuesNoMetrics.map(q => q.QueueUrl)
  );

  const queuesHighWait = queueDetails.filter(q => parseInt(q.attributes.ReceiveMessageWaitTimeSeconds) > 20);
  addCheck(
    'Reasonable Receive Wait Time',
    queuesHighWait.length === 0,
    queuesHighWait.length === 0
      ? 'All SQS queues have a receive wait time of 20 seconds or less.'
      : `Some queues (${queuesHighWait.map(q => `${q.QueueUrl} (${q.Region})`).join(', ')}) have excessive wait times.`,
    queuesHighWait.map(q => q.QueueUrl)
  );

  const queuesNoDesc = queueDetails.filter(q => 
    !Object.keys(q.tags).some(t => t === 'Description') && q.QueueUrl.split('/').pop().length <= 3
  );
  addCheck(
    'Queue Descriptions',
    queuesNoDesc.length === 0,
    queuesNoDesc.length === 0
      ? 'All SQS queues have descriptions (via tags or meaningful names).'
      : `Some queues (${queuesNoDesc.map(q => `${q.QueueUrl} (${q.Region})`).join(', ')}) lack descriptions.`,
    queuesNoDesc.map(q => q.QueueUrl)
  );

  const queuesNoKms = queueDetails.filter(q => !q.attributes.KmsMasterKeyId);
  addCheck(
    'KMS Encryption',
    queuesNoKms.length === 0,
    queuesNoKms.length === 0
      ? 'All SQS queues use KMS encryption.'
      : `Some queues (${queuesNoKms.map(q => `${q.QueueUrl} (${q.Region})`).join(', ')}) use SSE or no encryption instead of KMS.`,
    queuesNoKms.map(q => q.QueueUrl)
  );

  return {
    ...checks,
    totalAssets: allQueueUrls.length,
    assetsAtRisk: assetsAtRiskSet.size,
  };
}

module.exports = { runSqsChecks };