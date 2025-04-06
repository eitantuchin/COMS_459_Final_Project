const AWS = require('aws-sdk');

async function runElbChecks(credentials) {
  const elb = new AWS.ELB({ ...credentials, region: 'us-east-1' });
  const elbv2 = new AWS.ELBv2({ ...credentials, region: 'us-east-1' });
  const ec2 = new AWS.EC2({ ...credentials, region: 'us-east-1' });
  const regionResponse = await ec2.describeRegions().promise();
  const regions = regionResponse.Regions.map(region => region.RegionName);

  const elbPromises = regions.map(region => {
    const regionalElb = new AWS.ELB({ ...credentials, region });
    const regionalElbv2 = new AWS.ELBv2({ ...credentials, region });
    return Promise.all([
      regionalElb.describeLoadBalancers().promise().catch(() => ({ LoadBalancerDescriptions: [] })),
      regionalElbv2.describeLoadBalancers().promise().catch(() => ({ LoadBalancers: [] })),
    ]).then(([classicLbs, modernLbs]) => ({
      region,
      classicLbs: classicLbs.LoadBalancerDescriptions,
      modernLbs: modernLbs.LoadBalancers,
    }));
  });

  const elbResponses = await Promise.all(elbPromises);
  const allClassicLbs = [];
  const allModernLbs = [];
  elbResponses.forEach(response => {
    allClassicLbs.push(...response.classicLbs.map(lb => ({ ...lb, Region: response.region })));
    allModernLbs.push(...response.modernLbs.map(lb => ({ ...lb, Region: response.region })));
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

  const elbsExist = allClassicLbs.length > 0 || allModernLbs.length > 0;
  addCheck(
    'ELBs Exist',
    elbsExist,
    elbsExist ? 'Elastic Load Balancers are present.' : 'No ELBs found.'
  );

  if (!elbsExist) {
    return { ...checks, totalAssets: allClassicLbs.length + allModernLbs.length, assetsAtRisk: assetsAtRiskSet.size };
  }

  const classicLbDetails = await Promise.all(
    allClassicLbs.map(lb => {
      const regionalElb = new AWS.ELB({ ...credentials, region: lb.Region });
      return Promise.all([
        regionalElb.describeLoadBalancerAttributes({ LoadBalancerName: lb.LoadBalancerName }).promise(),
        regionalElb.describeTags({ LoadBalancerNames: [lb.LoadBalancerName] }).promise(),
      ]).then(([attributes, tags]) => ({
        ...lb,
        attributes: attributes.LoadBalancerAttributes,
        tags: tags.TagDescriptions[0]?.Tags || [],
      }));
    })
  );

  const modernLbDetails = await Promise.all(
    allModernLbs.map(lb => {
      const regionalElbv2 = new AWS.ELBv2({ ...credentials, region: lb.Region });
      return Promise.all([
        regionalElbv2.describeLoadBalancerAttributes({ LoadBalancerArn: lb.LoadBalancerArn }).promise(),
        regionalElbv2.describeTags({ ResourceArns: [lb.LoadBalancerArn] }).promise(),
      ]).then(([attributes, tags]) => ({
        ...lb,
        attributes: attributes.Attributes,
        tags: tags.TagDescriptions[0]?.Tags || [],
      }));
    })
  );

  const classicNoHttps = allClassicLbs.filter(lb => 
    !lb.ListenerDescriptions.some(l => l.Listener.Protocol === 'HTTPS')
  );
  addCheck(
    'HTTPS Listeners',
    classicNoHttps.length === 0,
    classicNoHttps.length === 0
      ? 'All ELBs use HTTPS listeners (or internal).'
      : `Some ELBs (${classicNoHttps.map(lb => `${lb.LoadBalancerName} (${lb.Region})`).join(', ')}) lack HTTPS listeners.`,
    classicNoHttps.map(lb => lb.LoadBalancerName)
  );

  const modernNoDeletion = modernLbDetails.filter(lb => 
    !lb.attributes.some(attr => attr.Key === 'deletion_protection.enabled' && attr.Value === 'true')
  );
  addCheck(
    'Deletion Protection',
    modernNoDeletion.length === 0,
    modernNoDeletion.length === 0
      ? 'All modern ELBs have deletion protection enabled.'
      : `Some modern ELBs (${modernNoDeletion.map(lb => `${lb.LoadBalancerName} (${lb.Region})`).join(', ')}) lack deletion protection.`,
    modernNoDeletion.map(lb => lb.LoadBalancerArn)
  );

  const classicNoVpc = allClassicLbs.filter(lb => !lb.VPCId);
  const modernNoVpc = allModernLbs.filter(lb => !lb.VpcId);
  addCheck(
    'ELBs in VPC',
    classicNoVpc.length === 0 && modernNoVpc.length === 0,
    classicNoVpc.length === 0 && modernNoVpc.length === 0
      ? 'All ELBs are in a VPC.'
      : `Some ELBs (Classic: ${classicNoVpc.map(lb => `${lb.LoadBalancerName} (${lb.Region})`).join(', ')}, Modern: ${modernNoVpc.map(lb => `${lb.LoadBalancerName} (${lb.Region})`).join(', ')}) are not in a VPC.`,
    [...classicNoVpc.map(lb => lb.LoadBalancerName), ...modernNoVpc.map(lb => lb.LoadBalancerArn)]
  );

  const classicNoSg = allClassicLbs.filter(lb => lb.Scheme === 'internet-facing' && lb.SecurityGroups.length === 0);
  const modernNoSg = allModernLbs.filter(lb => lb.Scheme === 'internet-facing' && lb.SecurityGroups.length === 0);
  addCheck(
    'Security Groups Assigned',
    classicNoSg.length === 0 && modernNoSg.length === 0,
    classicNoSg.length === 0 && modernNoSg.length === 0
      ? 'All internet-facing ELBs have security groups.'
      : `Some ELBs (Classic: ${classicNoSg.map(lb => `${lb.LoadBalancerName} (${lb.Region})`).join(', ')}, Modern: ${modernNoSg.map(lb => `${lb.LoadBalancerName} (${lb.Region})`).join(', ')}) lack security groups.`,
    [...classicNoSg.map(lb => lb.LoadBalancerName), ...modernNoSg.map(lb => lb.LoadBalancerArn)]
  );

  const classicNoLogging = classicLbDetails.filter(lb => !lb.attributes.AccessLog.Enabled);
  const modernNoLogging = modernLbDetails.filter(lb => 
    !lb.attributes.some(attr => attr.Key === 'access_logs.s3.enabled' && attr.Value === 'true')
  );
  addCheck(
    'Access Logging',
    classicNoLogging.length === 0 && modernNoLogging.length === 0,
    classicNoLogging.length === 0 && modernNoLogging.length === 0
      ? 'All ELBs have access logging enabled.'
      : `Some ELBs (Classic: ${classicNoLogging.map(lb => `${lb.LoadBalancerName} (${lb.Region})`).join(', ')}, Modern: ${modernNoLogging.map(lb => `${lb.LoadBalancerName} (${lb.Region})`).join(', ')}) lack access logging.`,
    [...classicNoLogging.map(lb => lb.LoadBalancerName), ...modernNoLogging.map(lb => lb.LoadBalancerArn)]
  );

  const classicNoTags = classicLbDetails.filter(lb => lb.tags.length === 0);
  const modernNoTags = modernLbDetails.filter(lb => lb.tags.length === 0);
  addCheck(
    'ELB Tagging',
    classicNoTags.length === 0 && modernNoTags.length === 0,
    classicNoTags.length === 0 && modernNoTags.length === 0
      ? 'All ELBs are tagged.'
      : `Some ELBs (Classic: ${classicNoTags.map(lb => `${lb.LoadBalancerName} (${lb.Region})`).join(', ')}, Modern: ${modernNoTags.map(lb => `${lb.LoadBalancerName} (${lb.Region})`).join(', ')}) lack tags.`,
    [...classicNoTags.map(lb => lb.LoadBalancerName), ...modernNoTags.map(lb => lb.LoadBalancerArn)]
  );

  const classicNoTls = allClassicLbs.filter(lb => 
    !lb.ListenerDescriptions.some(l => l.Listener.Protocol === 'HTTPS' && l.Listener.SSLCertificateId)
  );
  addCheck(
    'Modern TLS Policies (Classic)',
    classicNoTls.length === 0,
    classicNoTls.length === 0
      ? 'All Classic ELBs use HTTPS with certificates.'
      : `Some Classic ELBs (${classicNoTls.map(lb => `${lb.LoadBalancerName} (${lb.Region})`).join(', ')}) lack modern TLS.`,
    classicNoTls.map(lb => lb.LoadBalancerName)
  );

  const classicNoHealth = classicLbDetails.filter(lb => !lb.attributes.HealthCheck);
  addCheck(
    'Health Checks (Classic)',
    classicNoHealth.length === 0,
    classicNoHealth.length === 0
      ? 'All Classic ELBs have health checks configured.'
      : `Some Classic ELBs (${classicNoHealth.map(lb => `${lb.LoadBalancerName} (${lb.Region})`).join(', ')}) lack health checks.`,
    classicNoHealth.map(lb => lb.LoadBalancerName)
  );

  const modernNoWaf = modernLbDetails.filter(lb => 
    lb.Type === 'application' && !lb.attributes.some(attr => attr.Key === 'waf.enabled' || attr.Key === 'waf.fail_open')
  );
  addCheck(
    'WAF Integration (ALB)',
    modernNoWaf.length === 0,
    modernNoWaf.length === 0
      ? 'All Application Load Balancers have WAF integration.'
      : `Some ALBs (${modernNoWaf.map(lb => `${lb.LoadBalancerName} (${lb.Region})`).join(', ')}) lack WAF integration.`,
    modernNoWaf.map(lb => lb.LoadBalancerArn)
  );

  const classicNoCrossZone = classicLbDetails.filter(lb => !lb.attributes.CrossZoneLoadBalancing.Enabled);
  const modernNoCrossZone = modernLbDetails.filter(lb => 
    !lb.attributes.some(attr => attr.Key === 'load_balancing.cross_zone.enabled' && attr.Value === 'true')
  );
  addCheck(
    'Cross-Zone Load Balancing',
    classicNoCrossZone.length === 0 && modernNoCrossZone.length === 0,
    classicNoCrossZone.length === 0 && modernNoCrossZone.length === 0
      ? 'All ELBs have cross-zone load balancing enabled.'
      : `Some ELBs (Classic: ${classicNoCrossZone.map(lb => `${lb.LoadBalancerName} (${lb.Region})`).join(', ')}, Modern: ${modernNoCrossZone.map(lb => `${lb.LoadBalancerName} (${lb.Region})`).join(', ')}) lack cross-zone balancing.`,
    [...classicNoCrossZone.map(lb => lb.LoadBalancerName), ...modernNoCrossZone.map(lb => lb.LoadBalancerArn)]
  );

  const classicHighIdle = classicLbDetails.filter(lb => lb.attributes.ConnectionSettings.IdleTimeout > 4000);
  const modernHighIdle = modernLbDetails.filter(lb => 
    lb.attributes.some(attr => attr.Key === 'idle_timeout.timeout_seconds' && parseInt(attr.Value) > 4000)
  );
  addCheck(
    'Reasonable Idle Timeout',
    classicHighIdle.length === 0 && modernHighIdle.length === 0,
    classicHighIdle.length === 0 && modernHighIdle.length === 0
      ? 'All ELBs have an idle timeout of 4000 seconds or less.'
      : `Some ELBs (Classic: ${classicHighIdle.map(lb => `${lb.LoadBalancerName} (${lb.Region})`).join(', ')}, Modern: ${modernHighIdle.map(lb => `${lb.LoadBalancerName} (${lb.Region})`).join(', ')}) have excessive idle timeouts.`,
    [...classicHighIdle.map(lb => lb.LoadBalancerName), ...modernHighIdle.map(lb => lb.LoadBalancerArn)]
  );

  const classicSingleAz = allClassicLbs.filter(lb => new Set(lb.AvailabilityZones).size < 2);
  const modernSingleAz = allModernLbs.filter(lb => new Set(lb.AvailabilityZones.map(az => az.ZoneName)).size < 2);
  addCheck(
    'Multiple AZs',
    classicSingleAz.length === 0 && modernSingleAz.length === 0,
    classicSingleAz.length === 0 && modernSingleAz.length === 0
      ? 'All ELBs span multiple Availability Zones.'
      : `Some ELBs (Classic: ${classicSingleAz.map(lb => `${lb.LoadBalancerName} (${lb.Region})`).join(', ')}, Modern: ${modernSingleAz.map(lb => `${lb.LoadBalancerName} (${lb.Region})`).join(', ')}) do not span multiple AZs.`,
    [...classicSingleAz.map(lb => lb.LoadBalancerName), ...modernSingleAz.map(lb => lb.LoadBalancerArn)]
  );

  const classicNoDraining = classicLbDetails.filter(lb => !lb.attributes.ConnectionDraining.Enabled);
  addCheck(
    'Connection Draining (Classic)',
    classicNoDraining.length === 0,
    classicNoDraining.length === 0
      ? 'All Classic ELBs have connection draining enabled.'
      : `Some Classic ELBs (${classicNoDraining.map(lb => `${lb.LoadBalancerName} (${lb.Region})`).join(', ')}) lack connection draining.`,
    classicNoDraining.map(lb => lb.LoadBalancerName)
  );

  const classicNoDesc = classicLbDetails.filter(lb => !lb.tags.some(tag => tag.Key === 'Description') && lb.LoadBalancerName.length <= 3);
  const modernNoDesc = modernLbDetails.filter(lb => !lb.tags.some(tag => tag.Key === 'Description') && lb.LoadBalancerName.length <= 3);
  addCheck(
    'ELB Descriptions',
    classicNoDesc.length === 0 && modernNoDesc.length === 0,
    classicNoDesc.length === 0 && modernNoDesc.length === 0
      ? 'All ELBs have descriptions (via tags or meaningful names).'
      : `Some ELBs (Classic: ${classicNoDesc.map(lb => `${lb.LoadBalancerName} (${lb.Region})`).join(', ')}, Modern: ${modernNoDesc.map(lb => `${lb.LoadBalancerName} (${lb.Region})`).join(', ')}) lack descriptions.`,
    [...classicNoDesc.map(lb => lb.LoadBalancerName), ...modernNoDesc.map(lb => lb.LoadBalancerArn)]
  );

  return {
    ...checks,
    totalAssets: allClassicLbs.length + allModernLbs.length,
    assetsAtRisk: assetsAtRiskSet.size,
  };
}

module.exports = { runElbChecks };