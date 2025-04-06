const AWS = require('aws-sdk');

// Function to run all EC2 security checks across all regions
async function runEc2Checks(credentials) {
  const ec2 = new AWS.EC2({ ...credentials, region: 'us-east-1' });
  const regionResponse = await ec2.describeRegions().promise();
  const regions = regionResponse.Regions.map(region => region.RegionName);

  const instancePromises = regions.map(region => {
    const regionalEc2 = new AWS.EC2({ ...credentials, region });
    return regionalEc2.describeInstances().promise();
  });
  const ec2Responses = await Promise.all(instancePromises);

  const allInstances = [];
  ec2Responses.forEach((ec2Response, index) => {
    const region = regions[index];
    ec2Response.Reservations.forEach(reservation => {
      reservation.Instances.forEach(instance => {
        allInstances.push({ ...instance, Region: region });
      });
    });
  });

  const checks = {
    totalChecks: 0,
    totalPassed: 0,
    details: [],
  };

  const assetsAtRiskSet = new Set(); // Track unique instance IDs at risk

  const addCheck = (name, passed, message, instanceIds = []) => {
    checks.totalChecks++;
    if (passed) checks.totalPassed++;
    checks.details.push({ name, passed, message });
    if (!passed) {
      instanceIds.forEach(id => assetsAtRiskSet.add(id));
    }
  };

  // Security Checks with assets at risk tracking
  // 1. Key Pair Check
  const instancesWithoutKeyPairs = allInstances.filter(i => !i.KeyName);
  addCheck(
    'EC2 Key Pair Check',
    instancesWithoutKeyPairs.length === 0,
    instancesWithoutKeyPairs.length === 0
      ? 'All instances have key pairs.'
      : `Some instances (${instancesWithoutKeyPairs.map(i => `${i.InstanceId} (${i.Region})`).join(', ')}) lack key pairs.`,
    instancesWithoutKeyPairs.map(i => i.InstanceId)
  );

  // 2. IMDSv2 Check
  const instancesWithoutImdsV2 = allInstances.filter(i => i.MetadataOptions?.HttpTokens !== 'required');
  addCheck(
    'IMDSv2 Enabled',
    instancesWithoutImdsV2.length === 0,
    instancesWithoutImdsV2.length === 0
      ? 'All instances use IMDSv2.'
      : `Some instances (${instancesWithoutImdsV2.map(i => i.InstanceId).join(', ')}) do not enforce IMDSv2.`,
    instancesWithoutImdsV2.map(i => i.InstanceId)
  );

  // 3. VPC Check
  const instancesNotInVpc = allInstances.filter(i => !i.VpcId);
  addCheck(
    'Instances in VPC',
    instancesNotInVpc.length === 0,
    instancesNotInVpc.length === 0
      ? 'All instances are in a VPC.'
      : `Some instances (${instancesNotInVpc.map(i => i.InstanceId).join(', ')}) are not in a VPC.`,
    instancesNotInVpc.map(i => i.InstanceId)
  );

  // 4. Public IP Check
  const instancesWithPublicIps = allInstances.filter(i => i.PublicIpAddress);
  addCheck(
    'No Public IPs',
    instancesWithPublicIps.length === 0,
    instancesWithPublicIps.length === 0
      ? 'No instances have public IPs.'
      : `Some instances (${instancesWithPublicIps.map(i => i.InstanceId).join(', ')}) have public IPs.`,
    instancesWithPublicIps.map(i => i.InstanceId)
  );

  // 5. Security Groups Check
  const instancesWithoutSg = allInstances.filter(i => !i.SecurityGroups?.length);
  addCheck(
    'Security Groups Attached',
    instancesWithoutSg.length === 0,
    instancesWithoutSg.length === 0
      ? 'All instances have security groups.'
      : `Some instances (${instancesWithoutSg.map(i => i.InstanceId).join(', ')}) lack security groups.`,
    instancesWithoutSg.map(i => i.InstanceId)
  );

  // 6. EBS Encryption Check
  const instancesWithoutEncryptedEbs = allInstances.filter(i =>
    i.BlockDeviceMappings.some(bdm => !bdm.Ebs?.Encrypted)
  );
  addCheck(
    'EBS Encryption',
    instancesWithoutEncryptedEbs.length === 0,
    instancesWithoutEncryptedEbs.length === 0
      ? 'All EBS volumes are encrypted.'
      : `Some instances (${instancesWithoutEncryptedEbs.map(i => i.InstanceId).join(', ')}) have unencrypted EBS volumes.`,
    instancesWithoutEncryptedEbs.map(i => i.InstanceId)
  );

  // 7. Running State Check
  const instancesNotRunning = allInstances.filter(i => i.State.Name !== 'running');
  addCheck(
    'Instances Running',
    instancesNotRunning.length === 0,
    instancesNotRunning.length === 0
      ? 'All instances are running.'
      : `Some instances (${instancesNotRunning.map(i => i.InstanceId).join(', ')}) are stopped or terminated.`,
    instancesNotRunning.map(i => i.InstanceId)
  );

  // 8. IAM Profile Check
  const instancesWithoutIam = allInstances.filter(i => !i.IamInstanceProfile);
  addCheck(
    'IAM Instance Profile',
    instancesWithoutIam.length === 0,
    instancesWithoutIam.length === 0
      ? 'All instances have IAM profiles.'
      : `Some instances (${instancesWithoutIam.map(i => i.InstanceId).join(', ')}) lack IAM profiles.`,
    instancesWithoutIam.map(i => i.InstanceId)
  );

  // 9. Detailed Monitoring Check
  const instancesWithoutMonitoring = allInstances.filter(i => i.Monitoring?.State !== 'enabled');
  addCheck(
    'Detailed Monitoring',
    instancesWithoutMonitoring.length === 0,
    instancesWithoutMonitoring.length === 0
      ? 'All instances have detailed monitoring enabled.'
      : `Some instances (${instancesWithoutMonitoring.map(i => i.InstanceId).join(', ')}) lack detailed monitoring.`,
    instancesWithoutMonitoring.map(i => i.InstanceId)
  );

  // 10. AMI Check
  const latestAmiPrefix = 'ami-0';
  const instancesWithOldAmi = allInstances.filter(i => !i.ImageId?.startsWith(latestAmiPrefix));
  addCheck(
    'Latest AMI',
    instancesWithOldAmi.length === 0,
    instancesWithOldAmi.length === 0
      ? 'All instances use a recent AMI.'
      : `Some instances (${instancesWithOldAmi.map(i => i.InstanceId).join(', ')}) may be using outdated AMIs.`,
    instancesWithOldAmi.map(i => i.InstanceId)
  );

  // 11. Tags Check
  const instancesWithoutTags = allInstances.filter(i => !i.Tags?.length);
  addCheck(
    'Instance Tagging',
    instancesWithoutTags.length === 0,
    instancesWithoutTags.length === 0
      ? 'All instances are tagged.'
      : `Some instances (${instancesWithoutTags.map(i => i.InstanceId).join(', ')}) lack tags.`,
    instancesWithoutTags.map(i => i.InstanceId)
  );

  // 12. Auto Scaling Check
  const instancesNotInAsg = allInstances.filter(i => !i.AutoScalingGroupName);
  addCheck(
    'Auto Scaling Group',
    instancesNotInAsg.length === 0,
    instancesNotInAsg.length === 0
      ? 'All instances are in an Auto Scaling group.'
      : `Some instances (${instancesNotInAsg.map(i => i.InstanceId).join(', ')}) are not in an Auto Scaling group.`,
    instancesNotInAsg.map(i => i.InstanceId)
  );

  // 13. Termination Protection Check
  const instancesWithoutProtection = allInstances.filter(i => !i.DisableApiTermination);
  addCheck(
    'Termination Protection',
    instancesWithoutProtection.length === 0,
    instancesWithoutProtection.length === 0
      ? 'All instances have termination protection.'
      : `Some instances (${instancesWithoutProtection.map(i => i.InstanceId).join(', ')}) lack termination protection.`,
    instancesWithoutProtection.map(i => i.InstanceId)
  );

  // 14. Nitro Types Check
  const nitroTypes = ['t3', 't4g', 'm5', 'c5', 'r5'];
  const instancesNotNitro = allInstances.filter(i =>
    !nitroTypes.some(type => i.InstanceType?.startsWith(type))
  );
  addCheck(
    'Nitro Instance Types',
    instancesNotNitro.length === 0,
    instancesNotNitro.length === 0
      ? 'All instances use Nitro-based types.'
      : `Some instances (${instancesNotNitro.map(i => i.InstanceId).join(', ')}) use older instance types.`,
    instancesNotNitro.map(i => i.InstanceId)
  );

  // 15. Security Group Rules Check
  const instancesWithExcessiveSg = allInstances.filter(i => {
    const sgCount = i.SecurityGroups.reduce((acc, sg) => acc + (sg.GroupId ? 1 : 0), 0);
    return sgCount > 50;
  });
  addCheck(
    'Reasonable SG Rules',
    instancesWithExcessiveSg.length === 0,
    instancesWithExcessiveSg.length === 0
      ? 'All instances have a reasonable number of security group rules.'
      : `Some instances (${instancesWithExcessiveSg.map(i => i.InstanceId).join(', ')}) have excessive security group rules.`,
    instancesWithExcessiveSg.map(i => i.InstanceId)
  );

  return {
    ...checks,
    totalAssets: allInstances.length,
    assetsAtRisk: assetsAtRiskSet.size,
  };
}

module.exports = { runEc2Checks };