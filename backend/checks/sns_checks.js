const AWS = require('aws-sdk');

async function runSnsChecks(credentials) {
  const sns = new AWS.SNS({ ...credentials, region: 'us-east-1' });
  const ec2 = new AWS.EC2({ ...credentials, region: 'us-east-1' });
  const regionResponse = await ec2.describeRegions().promise();
  const regions = regionResponse.Regions.map(region => region.RegionName);

  const snsPromises = regions.map(region => {
    const regionalSns = new AWS.SNS({ ...credentials, region });
    return regionalSns.listTopics().promise().then(response => ({
      region,
      topics: response.Topics,
    }));
  });

  const snsResponses = await Promise.all(snsPromises);
  const allTopics = [];
  snsResponses.forEach(response => {
    allTopics.push(...response.topics.map(topic => ({ ...topic, Region: response.region })));
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

  const topicsExist = allTopics.length > 0;
  addCheck(
    'SNS Topics Exist',
    topicsExist,
    topicsExist ? 'SNS topics are present.' : 'No SNS topics found.'
  );

  if (!topicsExist) {
    return { ...checks, totalAssets: allTopics.length, assetsAtRisk: assetsAtRiskSet.size };
  }

  const topicDetails = await Promise.all(
    allTopics.map(topic => {
      const regionalSns = new AWS.SNS({ ...credentials, region: topic.Region });
      return Promise.all([
        regionalSns.getTopicAttributes({ TopicArn: topic.TopicArn }).promise(),
        regionalSns.listSubscriptionsByTopic({ TopicArn: topic.TopicArn }).promise(),
        regionalSns.listTagsForResource({ ResourceArn: topic.TopicArn }).promise(),
      ]).then(([attributes, subscriptions, tags]) => ({
        ...topic,
        attributes: attributes.Attributes,
        subscriptions: subscriptions.Subscriptions,
        tags: tags.Tags,
      }));
    })
  );

  const topicsNoEncryption = topicDetails.filter(t => !t.attributes.KmsMasterKeyId);
  addCheck(
    'Topic Encryption',
    topicsNoEncryption.length === 0,
    topicsNoEncryption.length === 0
      ? 'All SNS topics are encrypted with KMS.'
      : `Some topics (${topicsNoEncryption.map(t => `${t.attributes.TopicArn} (${t.Region})`).join(', ')}) lack encryption.`,
    topicsNoEncryption.map(t => t.attributes.TopicArn)
  );

  const topicsNoSubs = topicDetails.filter(t => t.subscriptions.length === 0);
  addCheck(
    'Subscriptions Exist',
    topicsNoSubs.length === 0,
    topicsNoSubs.length === 0
      ? 'All SNS topics have at least one subscription.'
      : `Some topics (${topicsNoSubs.map(t => `${t.attributes.TopicArn} (${t.Region})`).join(', ')}) lack subscriptions.`,
    topicsNoSubs.map(t => t.attributes.TopicArn)
  );

  const topicsNoTags = topicDetails.filter(t => t.tags.length === 0);
  addCheck(
    'SNS Tagging',
    topicsNoTags.length === 0,
    topicsNoTags.length === 0
      ? 'All SNS topics are tagged.'
      : `Some topics (${topicsNoTags.map(t => `${t.attributes.TopicArn} (${t.Region})`).join(', ')}) lack tags.`,
    topicsNoTags.map(t => t.attributes.TopicArn)
  );

  const topicsNoDisplayName = topicDetails.filter(t => !t.attributes.DisplayName || t.attributes.DisplayName.trim() === '');
  addCheck(
    'Display Name Present',
    topicsNoDisplayName.length === 0,
    topicsNoDisplayName.length === 0
      ? 'All SNS topics have a display name.'
      : `Some topics (${topicsNoDisplayName.map(t => `${t.attributes.TopicArn} (${t.Region})`).join(', ')}) lack a display name.`,
    topicsNoDisplayName.map(t => t.attributes.TopicArn)
  );

  const topicsNoLogging = topicDetails.filter(t => 
    !t.attributes['DeliveryPolicy'] || !JSON.parse(t.attributes['DeliveryPolicy']).http?.successFeedbackRoleArn
  );
  addCheck(
    'Delivery Status Logging',
    topicsNoLogging.length === 0,
    topicsNoLogging.length === 0
      ? 'All SNS topics have delivery status logging enabled.'
      : `Some topics (${topicsNoLogging.map(t => `${t.attributes.TopicArn} (${t.Region})`).join(', ')}) lack delivery status logging.`,
    topicsNoLogging.map(t => t.attributes.TopicArn)
  );

  const topicsPermissive = topicDetails.filter(t => 
    t.attributes.Policy && 
    JSON.parse(t.attributes.Policy).Statement.some(s => s.Effect === 'Allow' && s.Principal === '*' && !s.Condition)
  );
  addCheck(
    'Restrictive Access Policy',
    topicsPermissive.length === 0,
    topicsPermissive.length === 0
      ? 'All SNS topics have restrictive access policies.'
      : `Some topics (${topicsPermissive.map(t => `${t.attributes.TopicArn} (${t.Region})`).join(', ')}) have overly permissive policies.`,
    topicsPermissive.map(t => t.attributes.TopicArn)
  );

  const topicsInsecureEndpoints = topicDetails.filter(t => 
    t.subscriptions.some(s => !['https', 'sqs', 'lambda', 'sms'].includes(s.Protocol))
  );
  addCheck(
    'Secure Endpoints',
    topicsInsecureEndpoints.length === 0,
    topicsInsecureEndpoints.length === 0
      ? 'All SNS subscriptions use secure endpoints.'
      : `Some topics (${topicsInsecureEndpoints.map(t => `${t.attributes.TopicArn} (${t.Region})`).join(', ')}) use insecure protocols.`,
    topicsInsecureEndpoints.map(t => t.attributes.TopicArn)
  );

  const topicsExcessiveSubs = topicDetails.filter(t => t.subscriptions.length > 100);
  addCheck(
    'Reasonable Subscription Count',
    topicsExcessiveSubs.length === 0,
    topicsExcessiveSubs.length === 0
      ? 'All SNS topics have 100 or fewer subscriptions.'
      : `Some topics (${topicsExcessiveSubs.map(t => `${t.attributes.TopicArn} (${t.Region})`).join(', ')}) have excessive subscriptions.`,
    topicsExcessiveSubs.map(t => t.attributes.TopicArn)
  );

  const topicsNotOwned = topicDetails.filter(t => t.attributes.Owner !== t.attributes.TopicArn.split(':')[4]);
  addCheck(
    'Topic Ownership',
    topicsNotOwned.length === 0,
    topicsNotOwned.length === 0
      ? 'All SNS topics are owned by the current account.'
      : `Some topics (${topicsNotOwned.map(t => `${t.attributes.TopicArn} (${t.Region})`).join(', ')}) are owned by a different account.`,
    topicsNotOwned.map(t => t.attributes.TopicArn)
  );

  const topicsPendingSubs = topicDetails.filter(t => 
    t.subscriptions.some(s => s.SubscriptionArn === 'PendingConfirmation')
  );
  addCheck(
    'Subscriptions Confirmed',
    topicsPendingSubs.length === 0,
    topicsPendingSubs.length === 0
      ? 'All SNS subscriptions are confirmed.'
      : `Some topics (${topicsPendingSubs.map(t => `${t.attributes.TopicArn} (${t.Region})`).join(', ')}) have pending subscriptions.`,
    topicsPendingSubs.map(t => t.attributes.TopicArn)
  );

  const topicsFifo = topicDetails.filter(t => t.attributes.FifoTopic === 'true');
  addCheck(
    'Non-FIFO Topics',
    topicsFifo.length === 0,
    topicsFifo.length === 0
      ? 'All SNS topics are non-FIFO (standard).'
      : `Some topics (${topicsFifo.map(t => `${t.attributes.TopicArn} (${t.Region})`).join(', ')}) are FIFO (ensure intentional).`,
    topicsFifo.map(t => t.attributes.TopicArn)
  );

  const topicsLargeSize = topicDetails.filter(t => 
    t.attributes['DeliveryPolicy'] && 
    JSON.parse(t.attributes['DeliveryPolicy']).http?.defaultHealthyRetryPolicy?.maxMessageSize > 256 * 1024
  );
  addCheck(
    'Reasonable Message Size',
    topicsLargeSize.length === 0,
    topicsLargeSize.length === 0
      ? 'All SNS topics have a reasonable message size limit (≤ 256 KB).'
      : `Some topics (${topicsLargeSize.map(t => `${t.attributes.TopicArn} (${t.Region})`).join(', ')}) allow excessive message sizes.`,
    topicsLargeSize.map(t => t.attributes.TopicArn)
  );

  const topicsNoMetrics = topicDetails.filter(t => !t.attributes.EffectiveDeliveryPolicy);
  addCheck(
    'CloudWatch Metrics',
    topicsNoMetrics.length === 0,
    topicsNoMetrics.length === 0
      ? 'All SNS topics have effective delivery policies (metrics assumed).'
      : `Some topics (${topicsNoMetrics.map(t => `${t.attributes.TopicArn} (${t.Region})`).join(', ')}) may lack CloudWatch metrics.`,
    topicsNoMetrics.map(t => t.attributes.TopicArn)
  );

  const topicsNoDesc = topicDetails.filter(t => 
    !t.tags.some(tag => tag.Key === 'Description') && t.attributes.TopicArn.split(':').pop().length <= 3
  );
  addCheck(
    'Topic Descriptions',
    topicsNoDesc.length === 0,
    topicsNoDesc.length === 0
      ? 'All SNS topics have descriptions (via tags or meaningful names).'
      : `Some topics (${topicsNoDesc.map(t => `${t.attributes.TopicArn} (${t.Region})`).join(', ')}) lack descriptions.`,
    topicsNoDesc.map(t => t.attributes.TopicArn)
  );

  return {
    ...checks,
    totalAssets: allTopics.length,
    assetsAtRisk: assetsAtRiskSet.size,
  };
}

module.exports = { runSnsChecks };