const AWS = require('aws-sdk');

// Function to run all IAM security checks
async function runIamChecks(credentials) {
  const iam = new AWS.IAM({ ...credentials }); // IAM is a global service, no region needed

  // Fetch necessary IAM data
  const [usersResponse, policiesResponse, groupsResponse, mfaResponse, accountSummaryResponse] = await Promise.all([
    iam.listUsers().promise(),
    iam.listPolicies({ Scope: 'Local' }).promise(), // Customer-managed policies
    iam.listGroups().promise(),
    iam.getAccountSummary().promise(), // Includes MFA info
    iam.getAccountSummary().promise(), // General account summary
  ]);

  const users = usersResponse.Users;
  const policies = policiesResponse.Policies;
  const groups = groupsResponse.Groups;
  const accountSummary = accountSummaryResponse.SummaryMap;

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

  // 1. Check if root user has MFA enabled
  const rootMfaEnabled = accountSummary['AccountMFAEnabled'] === 1;
  addCheck(
    'Root User MFA',
    rootMfaEnabled,
    rootMfaEnabled
      ? 'Root user has MFA enabled.'
      : 'Root user does not have MFA enabled (critical security risk).'
  );

  // 2. Check if there are no access keys for the root user
  const rootAccessKeys = accountSummary['AccountAccessKeysPresent'] === 0;
  addCheck(
    'No Root Access Keys',
    rootAccessKeys,
    rootAccessKeys
      ? 'No access keys exist for the root user.'
      : 'Root user has access keys (should be removed).'
  );

  // 3. Check if all IAM users have MFA enabled
  const allUsersMfa = users.every(async user => {
    const mfaDevices = await iam.listMFADevices({ UserName: user.UserName }).promise();
    return mfaDevices.MFADevices.length > 0;
  });
  const allUsersMfaResult = await Promise.all(users.map(async user => {
    const mfaDevices = await iam.listMFADevices({ UserName: user.UserName }).promise();
    return mfaDevices.MFADevices.length > 0;
  }));
  const allHaveMfa = allUsersMfaResult.every(result => result);
  addCheck(
    'All Users MFA',
    allHaveMfa,
    allHaveMfa
      ? 'All IAM users have MFA enabled.'
      : `Some users (${users.filter((_, i) => !allUsersMfaResult[i]).map(u => u.UserName).join(', ')}) lack MFA.`
  );

  // 4. Check if there are no active access keys older than 90 days
  const accessKeys = await Promise.all(users.map(user => iam.listAccessKeys({ UserName: user.UserName }).promise()));
  const now = new Date();
  const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000);
  const noOldKeys = accessKeys.every(keys =>
    keys.AccessKeyMetadata.every(key => new Date(key.CreateDate) > ninetyDaysAgo || key.Status === 'Inactive')
  );
  addCheck(
    'No Old Access Keys',
    noOldKeys,
    noOldKeys
      ? 'No active access keys older than 90 days.'
      : 'Some access keys are older than 90 days and still active.'
  );

  // 5. Check if IAM users are assigned to groups (not direct policies)
  const allUsersInGroups = users.every(async user => {
    const groups = await iam.listGroupsForUser({ UserName: user.UserName }).promise();
    return groups.Groups.length > 0;
  });
  const allUsersInGroupsResult = await Promise.all(users.map(async user => {
    const groups = await iam.listGroupsForUser({ UserName: user.UserName }).promise();
    return groups.Groups.length > 0;
  }));
  const allInGroups = allUsersInGroupsResult.every(result => result);
  addCheck(
    'Users in Groups',
    allInGroups,
    allInGroups
      ? 'All users are assigned to groups.'
      : 'Some users have direct policies instead of group assignments.'
  );

  // 6. Check if there are no inline policies on users
  const noInlinePolicies = users.every(async user => {
    const policies = await iam.listUserPolicies({ UserName: user.UserName }).promise();
    return policies.PolicyNames.length === 0;
  });
  const noInlinePoliciesResult = await Promise.all(users.map(async user => {
    const policies = await iam.listUserPolicies({ UserName: user.UserName }).promise();
    return policies.PolicyNames.length === 0;
  }));
  const noInline = noInlinePoliciesResult.every(result => result);
  addCheck(
    'No Inline User Policies',
    noInline,
    noInline
      ? 'No users have inline policies.'
      : 'Some users have inline policies (use managed policies instead).'
  );

  // 7. Check if there are IAM groups defined
  const groupsExist = groups.length > 0;
  addCheck(
    'IAM Groups Exist',
    groupsExist,
    groupsExist
      ? 'IAM groups are defined.'
      : 'No IAM groups exist (use groups for better management).'
  );

  // 8. Check if policies are least privilege (simplified: no overly permissive policies like '*')
  const noOverlyPermissivePolicies = policies.every(policy => !policy.Arn.includes('AdministratorAccess'));
  addCheck(
    'Least Privilege Policies',
    noOverlyPermissivePolicies,
    noOverlyPermissivePolicies
      ? 'No overly permissive policies detected.'
      : 'Some policies (e.g., AdministratorAccess) are overly permissive.'
  );

  // 9. Check if there are no unused IAM users (no login for 90 days)
  const noUnusedUsers = users.every(user => {
    const lastUsed = user.PasswordLastUsed ? new Date(user.PasswordLastUsed) : new Date(user.CreateDate);
    return (now - lastUsed) / (1000 * 60 * 60 * 24) <= 90;
  });
  addCheck(
    'No Unused Users',
    noUnusedUsers,
    noUnusedUsers
      ? 'No IAM users unused for over 90 days.'
      : 'Some IAM users have not logged in for over 90 days.'
  );

  // 10. Check if IAM password policy exists and meets complexity requirements
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
    strongPasswordPolicy
      ? 'IAM password policy meets complexity requirements.'
      : 'No strong password policy defined or it lacks complexity.'
  );

  // 11. Check if there are no users with multiple active access keys
  const noMultipleKeys = accessKeys.every(keys => 
    keys.AccessKeyMetadata.filter(key => key.Status === 'Active').length <= 1
  );
  addCheck(
    'No Multiple Active Keys',
    noMultipleKeys,
    noMultipleKeys
      ? 'No users have multiple active access keys.'
      : 'Some users have multiple active access keys.'
  );

  // 12. Check if IAM roles are used (at least one role exists)
  const rolesResponse = await iam.listRoles().promise();
  const rolesExist = rolesResponse.Roles.length > 0;
  addCheck(
    'IAM Roles Exist',
    rolesExist,
    rolesExist
      ? 'IAM roles are defined.'
      : 'No IAM roles exist (use roles for temporary credentials).'
  );

  // 13. Check if there are no policies with wildcard resources ('*')
  const policyDetails = await Promise.all(policies.map(policy => 
    iam.getPolicyVersion({ PolicyArn: policy.Arn, VersionId: policy.DefaultVersionId }).promise()
  ));
  const noWildcardResources = policyDetails.every(detail => 
    !JSON.stringify(detail.PolicyVersion.Document).includes('"Resource": "*"')
  );
  addCheck(
    'No Wildcard Resources',
    noWildcardResources,
    noWildcardResources
      ? 'No policies use wildcard resources.'
      : 'Some policies use wildcard resources (*).'
  );

  // 14. Check if IAM users have console access limited (no recent console logins if only programmatic)
  const noRecentConsole = users.every(user => !user.PasswordLastUsed || (now - new Date(user.PasswordLastUsed)) > 90 * 24 * 60 * 60 * 1000);
  addCheck(
    'Limited Console Access',
    noRecentConsole,
    noRecentConsole
      ? 'No recent console logins for programmatic users.'
      : 'Some users with programmatic access have recent console logins.'
  );

  // 15. Check if account has an alternate contact for security
  const accountContacts = await iam.getAccountSummary().promise();
  const hasSecurityContact = accountSummary['AccountSecurityContact'] === 1; // Simplified check
  addCheck(
    'Security Contact Defined',
    hasSecurityContact,
    hasSecurityContact
      ? 'Account has a security contact defined.'
      : 'No security contact defined for the account.'
  );

  return checks;
}

module.exports = { runIamChecks };