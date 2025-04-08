const AWS = require('aws-sdk');

async function runIamChecks(credentials) {
  const iam = new AWS.IAM({ ...credentials });
  const ec2 = new AWS.EC2({ ...credentials, region: 'us-east-1' });
  const regionResponse = await ec2.describeRegions().promise();
  const regions = regionResponse.Regions.map(region => region.RegionName);

  const [usersResponse, policiesResponse, groupsResponse, accountSummaryResponse] = await Promise.all([
    iam.listUsers().promise(),
    iam.listPolicies({ Scope: 'Local' }).promise(),
    iam.listGroups().promise(),
    iam.getAccountSummary().promise(),
  ]);

  const users = usersResponse.Users;
  const policies = policiesResponse.Policies;
  const groups = groupsResponse.Groups;
  const accountSummary = accountSummaryResponse.SummaryMap;

  const checks = {
    totalChecks: 0,
    totalPassed: 0,
    details: [],
  };

  const regionStats = {};
  regions.forEach(region => {
    regionStats[region] = { totalAssets: 0, assetsAtRisk: new Set() };
  });
  // Since IAM is global, assign all assets to a "global" pseudo-region (e.g., us-east-1)
  const globalRegion = 'us-east-1';

  const assetsAtRiskSet = new Set();

  const addCheck = (name, passed, message, assetIds = []) => {
    checks.totalChecks++;
    if (passed) checks.totalPassed++;
    checks.details.push({ name, passed, message });
    if (!passed) {
      assetIds.forEach(id => {
        assetsAtRiskSet.add(id);
        regionStats[globalRegion].assetsAtRisk.add(id); // All IAM assets assigned to global region
      });
    }
  };

  const rootMfaEnabled = accountSummary['AccountMFAEnabled'] === 1;
  addCheck(
    'Root User MFA',
    rootMfaEnabled,
    rootMfaEnabled ? 'Root user has MFA enabled.' : 'Root user does not have MFA enabled.',
    !rootMfaEnabled ? ['root'] : []
  );

  const rootAccessKeys = accountSummary['AccountAccessKeysPresent'] === 0;
  addCheck(
    'No Root Access Keys',
    rootAccessKeys,
    rootAccessKeys ? 'No access keys exist for the root user.' : 'Root user has access keys.',
    !rootAccessKeys ? ['root'] : []
  );

  const allUsersMfaResult = await Promise.all(
    users.map(async user => {
      const mfaDevices = await iam.listMFADevices({ UserName: user.UserName }).promise();
      return mfaDevices.MFADevices.length > 0;
    })
  );
  const usersNoMfa = users.filter((_, i) => !allUsersMfaResult[i]);
  addCheck(
    'All Users MFA',
    usersNoMfa.length === 0,
    usersNoMfa.length === 0
      ? 'All IAM users have MFA enabled.'
      : `Some users (${usersNoMfa.map(u => u.UserName).join(', ')}) lack MFA.`,
    usersNoMfa.map(u => u.UserName)
  );

  const accessKeys = await Promise.all(users.map(user => iam.listAccessKeys({ UserName: user.UserName }).promise()));
  const now = new Date();
  const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000);
  const usersOldKeys = users.filter((user, i) => 
    accessKeys[i].AccessKeyMetadata.some(key => 
      new Date(key.CreateDate) < ninetyDaysAgo && key.Status === 'Active'
    )
  );
  addCheck(
    'No Old Access Keys',
    usersOldKeys.length === 0,
    usersOldKeys.length === 0
      ? 'No active access keys older than 90 days.'
      : `Some users (${usersOldKeys.map(u => u.UserName).join(', ')}) have old active access keys.`,
    usersOldKeys.map(u => u.UserName)
  );

  const allUsersInGroupsResult = await Promise.all(
    users.map(async user => {
      const groups = await iam.listGroupsForUser({ UserName: user.UserName }).promise();
      return groups.Groups.length > 0;
    })
  );
  const usersNotInGroups = users.filter((_, i) => !allUsersInGroupsResult[i]);
  addCheck(
    'Users in Groups',
    usersNotInGroups.length === 0,
    usersNotInGroups.length === 0
      ? 'All users are assigned to groups.'
      : `Some users (${usersNotInGroups.map(u => u.UserName).join(', ')}) have direct policies.`,
    usersNotInGroups.map(u => u.UserName)
  );

  const noInlinePoliciesResult = await Promise.all(
    users.map(async user => {
      const policies = await iam.listUserPolicies({ UserName: user.UserName }).promise();
      return policies.PolicyNames.length === 0;
    })
  );
  const usersWithInline = users.filter((_, i) => !noInlinePoliciesResult[i]);
  addCheck(
    'No Inline User Policies',
    usersWithInline.length === 0,
    usersWithInline.length === 0
      ? 'No users have inline policies.'
      : `Some users (${usersWithInline.map(u => u.UserName).join(', ')}) have inline policies.`,
    usersWithInline.map(u => u.UserName)
  );

  const groupsExist = groups.length > 0;
  addCheck(
    'IAM Groups Exist',
    groupsExist,
    groupsExist ? 'IAM groups are defined.' : 'No IAM groups exist.'
  );

  const permissivePolicies = policies.filter(p => p.Arn.includes('AdministratorAccess'));
  addCheck(
    'Least Privilege Policies',
    permissivePolicies.length === 0,
    permissivePolicies.length === 0
      ? 'No overly permissive policies detected.'
      : `Some policies (${permissivePolicies.map(p => p.PolicyName).join(', ')}) are overly permissive.`,
    permissivePolicies.map(p => p.Arn)
  );

  const unusedUsers = users.filter(u => {
    const lastUsed = u.PasswordLastUsed ? new Date(u.PasswordLastUsed) : new Date(u.CreateDate);
    return (now - lastUsed) / (1000 * 60 * 60 * 24) > 90;
  });
  addCheck(
    'No Unused Users',
    unusedUsers.length === 0,
    unusedUsers.length === 0
      ? 'No IAM users unused for over 90 days.'
      : `Some users (${unusedUsers.map(u => u.UserName).join(', ')}) are unused.`,
    unusedUsers.map(u => u.UserName)
  );

  const passwordPolicyResponse = await iam.getAccountPasswordPolicy().promise().catch(() => null);
  const strongPasswordPolicy = passwordPolicyResponse?.PasswordPolicy && 
    passwordPolicyResponse.PasswordPolicy.MinimumPasswordLength >= 8 &&
    passwordPolicyResponse.PasswordPolicy.RequireSymbols &&
    passwordPolicyResponse.PasswordPolicy.RequireNumbers &&
    passwordPolicyResponse.PasswordPolicy.RequireUppercaseCharacters &&
    passwordPolicyResponse.PasswordPolicy.RequireLowercaseCharacters;
  addCheck(
    'Strong Password Policy',
    !!strongPasswordPolicy,
    strongPasswordPolicy ? 'IAM password policy meets complexity requirements.' : 'No strong password policy defined.'
  );

  const usersMultipleKeys = users.filter((u, i) => 
    accessKeys[i].AccessKeyMetadata.filter(k => k.Status === 'Active').length > 1
  );
  addCheck(
    'No Multiple Active Keys',
    usersMultipleKeys.length === 0,
    usersMultipleKeys.length === 0
      ? 'No users have multiple active access keys.'
      : `Some users (${usersMultipleKeys.map(u => u.UserName).join(', ')}) have multiple active keys.`,
    usersMultipleKeys.map(u => u.UserName)
  );

  const rolesResponse = await iam.listRoles().promise();
  const rolesExist = rolesResponse.Roles.length > 0;
  addCheck(
    'IAM Roles Exist',
    rolesExist,
    rolesExist ? 'IAM roles are defined.' : 'No IAM roles exist.'
  );

  const policyDetails = await Promise.all(
    policies.map(p => iam.getPolicyVersion({ PolicyArn: p.Arn, VersionId: p.DefaultVersionId }).promise())
  );
  const wildcardPolicies = policies.filter((p, i) => 
    JSON.stringify(policyDetails[i].PolicyVersion.Document).includes('"Resource": "*"')
  );
  addCheck(
    'No Wildcard Resources',
    wildcardPolicies.length === 0,
    wildcardPolicies.length === 0
      ? 'No policies use wildcard resources.'
      : `Some policies (${wildcardPolicies.map(p => p.PolicyName).join(', ')}) use wildcard resources.`,
    wildcardPolicies.map(p => p.Arn)
  );

  const recentConsoleUsers = users.filter(u => 
    u.PasswordLastUsed && (now - new Date(u.PasswordLastUsed)) <= 90 * 24 * 60 * 60 * 1000
  );
  addCheck(
    'Limited Console Access',
    recentConsoleUsers.length === 0,
    recentConsoleUsers.length === 0
      ? 'No recent console logins for programmatic users.'
      : `Some users (${recentConsoleUsers.map(u => u.UserName).join(', ')}) have recent console logins.`,
    recentConsoleUsers.map(u => u.UserName)
  );

  const hasSecurityContact = accountSummary['AccountSecurityContact'] === 1;
  addCheck(
    'Security Contact Defined',
    hasSecurityContact,
    hasSecurityContact ? 'Account has a security contact defined.' : 'No security contact defined.'
  );

  // Calculate total assets for the global region
  regionStats[globalRegion].totalAssets = users.length + policies.length + groups.length + rolesResponse.Roles.length + 1; // +1 for root

  return {
    ...checks,
    totalAssets: users.length + policies.length + groups.length + rolesResponse.Roles.length + 1, // +1 for root
    assetsAtRisk: assetsAtRiskSet.size,
    regionStats: Object.fromEntries(
      Object.entries(regionStats).map(([region, stats]) => [region, {
        totalAssets: stats.totalAssets,
        assetsAtRisk: stats.assetsAtRisk.size
      }])
    )
  };
}

module.exports = { runIamChecks };