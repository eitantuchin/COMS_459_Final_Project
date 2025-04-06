const AWS = require('aws-sdk');

// Function to run all EC2 security checks across all regions
async function runEc2Checks(credentials) {
  // Set a default region for the initial client
  const ec2 = new AWS.EC2({ ...credentials, region: 'us-east-1' }); // Default region for describeRegions

  // Get all regions
  const regionResponse = await ec2.describeRegions().promise();
  const regions = regionResponse.Regions.map(region => region.RegionName);

  // Fetch all instances across regions concurrently
  const instancePromises = regions.map(region => {
    const regionalEc2 = new AWS.EC2({ ...credentials, region }); // Set region dynamically
    return regionalEc2.describeInstances().promise();
  });
  const ec2Responses = await Promise.all(instancePromises);

  // Aggregate all instances
  const allInstances = [];
  ec2Responses.forEach((ec2Response, index) => {
    const region = regions[index];
    ec2Response.Reservations.forEach(reservation => {
      reservation.Instances.forEach(instance => {
        allInstances.push({ ...instance, Region: region });
      });
    });
  });

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

  // 1. Check if all instances have a key pair
  const allHaveKeyPairs = allInstances.every(instance => instance.KeyName);
  addCheck(
    'EC2 Key Pair Check',
    allHaveKeyPairs,
    allHaveKeyPairs
      ? 'All instances have key pairs.'
      : `Some instances (${allInstances.filter(i => !i.KeyName).map(i => `${i.InstanceId} (${i.Region})`).join(', ')}) lack key pairs.`
  );

  // 2. Check if instances are using IMDSv2
  const allUseImdsV2 = allInstances.every(instance => instance.MetadataOptions?.HttpTokens === 'required');
  addCheck(
    'IMDSv2 Enabled',
    allUseImdsV2,
    allUseImdsV2
      ? 'All instances use IMDSv2.'
      : 'Some instances do not enforce IMDSv2.'
  );

  // 3. Check if instances are in a VPC
  const allInVpc = allInstances.every(instance => instance.VpcId);
  addCheck(
    'Instances in VPC',
    allInVpc,
    allInVpc
      ? 'All instances are in a VPC.'
      : 'Some instances are not in a VPC (EC2-Classic is deprecated).'
  );

  // 4. Check if instances have public IPs
  const noPublicIps = allInstances.every(instance => !instance.PublicIpAddress);
  addCheck(
    'No Public IPs',
    noPublicIps,
    noPublicIps
      ? 'No instances have public IPs.'
      : 'Some instances have public IPs, consider using private subnets.'
  );

  // 5. Check if instances have security groups attached
  const allHaveSecurityGroups = allInstances.every(instance => instance.SecurityGroups?.length > 0);
  addCheck(
    'Security Groups Attached',
    allHaveSecurityGroups,
    allHaveSecurityGroups
      ? 'All instances have security groups.'
      : 'Some instances lack security groups.'
  );

  // 6. Check if instances are using encrypted EBS volumes
  const allEbsEncrypted = allInstances.every(instance =>
    instance.BlockDeviceMappings.every(bdm => bdm.Ebs?.Encrypted)
  );
  addCheck(
    'EBS Encryption',
    allEbsEncrypted,
    allEbsEncrypted
      ? 'All EBS volumes are encrypted.'
      : 'Some EBS volumes are not encrypted.'
  );

  // 7. Check if instances are running
  const allRunning = allInstances.every(instance => instance.State.Name === 'running');
  addCheck(
    'Instances Running',
    allRunning,
    allRunning
      ? 'All instances are running.'
      : 'Some instances are stopped or terminated.'
  );

  // 8. Check if instances have IAM instance profiles
  const allHaveIamProfiles = allInstances.every(instance => instance.IamInstanceProfile);
  addCheck(
    'IAM Instance Profile',
    allHaveIamProfiles,
    allHaveIamProfiles
      ? 'All instances have IAM profiles.'
      : 'Some instances lack IAM profiles for least privilege access.'
  );

  // 9. Check if instances have detailed monitoring enabled
  const allDetailedMonitoring = allInstances.every(instance => instance.Monitoring?.State === 'enabled');
  addCheck(
    'Detailed Monitoring',
    allDetailedMonitoring,
    allDetailedMonitoring
      ? 'All instances have detailed monitoring enabled.'
      : 'Some instances lack detailed monitoring.'
  );

  // 10. Check if instances are using a recent AMI (simplified example)
  const latestAmiPrefix = 'ami-0';
  const allLatestAmi = allInstances.every(instance => instance.ImageId?.startsWith(latestAmiPrefix));
  addCheck(
    'Latest AMI',
    allLatestAmi,
    allLatestAmi
      ? 'All instances use a recent AMI.'
      : 'Some instances may be using outdated AMIs.'
  );

  // 11. Check if instances have tags
  const allTagged = allInstances.every(instance => instance.Tags?.length > 0);
  addCheck(
    'Instance Tagging',
    allTagged,
    allTagged
      ? 'All instances are tagged.'
      : 'Some instances lack tags.'
  );

  // 12. Check if instances are in an Auto Scaling group
  const allInAsg = allInstances.every(instance => instance.AutoScalingGroupName);
  addCheck(
    'Auto Scaling Group',
    allInAsg,
    allInAsg
      ? 'All instances are in an Auto Scaling group.'
      : 'Some instances are not in an Auto Scaling group.'
  );

  // 13. Check if instances have termination protection
  const allTerminationProtected = allInstances.every(instance => instance.DisableApiTermination);
  addCheck(
    'Termination Protection',
    allTerminationProtected,
    allTerminationProtected
      ? 'All instances have termination protection.'
      : 'Some instances lack termination protection.'
  );

  // 14. Check if instances use Nitro-based types
  const nitroTypes = ['t3', 't4g', 'm5', 'c5', 'r5'];
  const allNitro = allInstances.every(instance =>
    nitroTypes.some(type => instance.InstanceType?.startsWith(type))
  );
  addCheck(
    'Nitro Instance Types',
    allNitro,
    allNitro
      ? 'All instances use Nitro-based types.'
      : 'Some instances use older instance types.'
  );

  // 15. Check if instances have reasonable security group rules
  const allReasonableSgRules = allInstances.every(instance => {
    const sgCount = instance.SecurityGroups.reduce((acc, sg) => acc + (sg.GroupId ? 1 : 0), 0);
    return sgCount <= 50;
  });
  addCheck(
    'Reasonable SG Rules',
    allReasonableSgRules,
    allReasonableSgRules
      ? 'All instances have a reasonable number of security group rules.'
      : 'Some instances have excessive security group rules.'
  );

  return checks;
}

module.exports = { runEc2Checks };