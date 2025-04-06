const AWS = require('aws-sdk');

async function runLambdaChecks(credentials) {
  const lambda = new AWS.Lambda({ ...credentials, region: 'us-east-1' });
  const ec2 = new AWS.EC2({ ...credentials, region: 'us-east-1' });
  const regionResponse = await ec2.describeRegions().promise();
  const regions = regionResponse.Regions.map(region => region.RegionName);

  const lambdaPromises = regions.map(region => {
    const regionalLambda = new AWS.Lambda({ ...credentials, region });
    return regionalLambda.listFunctions().promise().then(response => ({
      region,
      functions: response.Functions,
    }));
  });

  const lambdaResponses = await Promise.all(lambdaPromises);
  const allFunctions = [];
  lambdaResponses.forEach(response => {
    allFunctions.push(...response.functions.map(func => ({ ...func, Region: response.region })));
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

  const functionsExist = allFunctions.length > 0;
  addCheck(
    'Lambda Functions Exist',
    functionsExist,
    functionsExist ? 'Lambda functions are present.' : 'No Lambda functions found.'
  );

  if (!functionsExist) {
    return { ...checks, totalAssets: allFunctions.length, assetsAtRisk: assetsAtRiskSet.size };
  }

  const functionDetails = await Promise.all(
    allFunctions.map(func => {
      const regionalLambda = new AWS.Lambda({ ...credentials, region: func.Region });
      return Promise.all([
        regionalLambda.getFunctionConfiguration({ FunctionName: func.FunctionName }).promise(),
        regionalLambda.getPolicy({ FunctionName: func.FunctionName }).promise().catch(() => null),
        regionalLambda.listTags({ Resource: func.FunctionArn }).promise(),
      ]).then(([config, policy, tags]) => ({
        ...func,
        config,
        policy: policy?.Policy ? JSON.parse(policy.Policy) : null,
        tags: tags.Tags,
      }));
    })
  );

  const funcsNoVpc = functionDetails.filter(f => !f.config.VpcConfig?.VpcId);
  addCheck(
    'VPC Configuration',
    funcsNoVpc.length === 0,
    funcsNoVpc.length === 0
      ? 'All Lambda functions are configured with a VPC.'
      : `Some functions (${funcsNoVpc.map(f => `${f.FunctionName} (${f.Region})`).join(', ')}) lack VPC configuration.`,
    funcsNoVpc.map(f => f.FunctionArn)
  );

  const funcsNoRole = functionDetails.filter(f => !f.Role);
  addCheck(
    'IAM Role Assigned',
    funcsNoRole.length === 0,
    funcsNoRole.length === 0
      ? 'All Lambda functions have an IAM role.'
      : `Some functions (${funcsNoRole.map(f => `${f.FunctionName} (${f.Region})`).join(', ')}) lack an IAM role.`,
    funcsNoRole.map(f => f.FunctionArn)
  );

  const funcsHighTimeout = functionDetails.filter(f => f.config.Timeout > 900);
  addCheck(
    'Reasonable Timeout',
    funcsHighTimeout.length === 0,
    funcsHighTimeout.length === 0
      ? 'All Lambda functions have a timeout of 15 minutes or less.'
      : `Some functions (${funcsHighTimeout.map(f => `${f.FunctionName} (${f.Region})`).join(', ')}) have excessive timeouts.`,
    funcsHighTimeout.map(f => f.FunctionArn)
  );

  const funcsNoTracing = functionDetails.filter(f => f.config.TracingConfig?.Mode !== 'Active');
  addCheck(
    'Tracing Enabled',
    funcsNoTracing.length === 0,
    funcsNoTracing.length === 0
      ? 'All Lambda functions have tracing enabled.'
      : `Some functions (${funcsNoTracing.map(f => `${f.FunctionName} (${f.Region})`).join(', ')}) lack tracing.`,
    funcsNoTracing.map(f => f.FunctionArn)
  );

  const supportedRuntimes = ['nodejs18.x', 'python3.9', 'java11', 'dotnet6', 'ruby3.2'];
  const funcsOldRuntime = functionDetails.filter(f => !supportedRuntimes.includes(f.config.Runtime));
  addCheck(
    'Supported Runtime',
    funcsOldRuntime.length === 0,
    funcsOldRuntime.length === 0
      ? 'All Lambda functions use supported runtimes.'
      : `Some functions (${funcsOldRuntime.map(f => `${f.FunctionName} (${f.Region})`).join(', ')}) use deprecated runtimes.`,
    funcsOldRuntime.map(f => f.FunctionArn)
  );

  const funcsNoKms = functionDetails.filter(f => f.config.Environment?.Variables && !f.config.KMSKeyArn);
  addCheck(
    'Encrypted Environment Variables',
    funcsNoKms.length === 0,
    funcsNoKms.length === 0
      ? 'All Lambda functions with environment variables use KMS encryption.'
      : `Some functions (${funcsNoKms.map(f => `${f.FunctionName} (${f.Region})`).join(', ')}) lack KMS encryption.`,
    funcsNoKms.map(f => f.FunctionArn)
  );

  const funcsNoDlq = functionDetails.filter(f => !f.config.DeadLetterConfig?.TargetArn);
  addCheck(
    'Dead Letter Queue',
    funcsNoDlq.length === 0,
    funcsNoDlq.length === 0
      ? 'All Lambda functions have a dead letter queue.'
      : `Some functions (${funcsNoDlq.map(f => `${f.FunctionName} (${f.Region})`).join(', ')}) lack a DLQ.`,
    funcsNoDlq.map(f => f.FunctionArn)
  );

  const funcsNoTags = functionDetails.filter(f => Object.keys(f.tags).length === 0);
  addCheck(
    'Lambda Tagging',
    funcsNoTags.length === 0,
    funcsNoTags.length === 0
      ? 'All Lambda functions are tagged.'
      : `Some functions (${funcsNoTags.map(f => `${f.FunctionName} (${f.Region})`).join(', ')}) lack tags.`,
    funcsNoTags.map(f => f.FunctionArn)
  );

  const funcsHighMemory = functionDetails.filter(f => f.config.MemorySize > 10240);
  addCheck(
    'Reasonable Memory Size',
    funcsHighMemory.length === 0,
    funcsHighMemory.length === 0
      ? 'All Lambda functions have a memory size of 10 GB or less.'
      : `Some functions (${funcsHighMemory.map(f => `${f.FunctionName} (${f.Region})`).join(', ')}) have excessive memory.`,
    funcsHighMemory.map(f => f.FunctionArn)
  );

  const funcsPermissive = functionDetails.filter(f => 
    f.policy?.Statement.some(s => 
      s.Effect === 'Allow' && s.Action === 'lambda:*' && s.Resource === '*' && !s.Condition
    )
  );
  addCheck(
    'No Overly Permissive Policies',
    funcsPermissive.length === 0,
    funcsPermissive.length === 0
      ? 'No Lambda functions have overly permissive execution policies.'
      : `Some functions (${funcsPermissive.map(f => `${f.FunctionName} (${f.Region})`).join(', ')}) have permissive policies.`,
    funcsPermissive.map(f => f.FunctionArn)
  );

  const funcsOldLayers = functionDetails.filter(f => 
    f.config.Layers && !f.config.Layers.every(l => l.Arn.includes(':latest'))
  );
  addCheck(
    'Latest Layer Versions',
    funcsOldLayers.length === 0,
    funcsOldLayers.length === 0
      ? 'All Lambda functions use the latest layer versions.'
      : `Some functions (${funcsOldLayers.map(f => `${f.FunctionName} (${f.Region})`).join(', ')}) use outdated layers.`,
    funcsOldLayers.map(f => f.FunctionArn)
  );

  const funcsNoConcurrency = functionDetails.filter(f => f.config.ReservedConcurrentExecutions === undefined);
  addCheck(
    'Concurrency Limits',
    funcsNoConcurrency.length === 0,
    funcsNoConcurrency.length === 0
      ? 'All Lambda functions have concurrency limits set.'
      : `Some functions (${funcsNoConcurrency.map(f => `${f.FunctionName} (${f.Region})`).join(', ')}) lack concurrency limits.`,
    funcsNoConcurrency.map(f => f.FunctionArn)
  );

  const funcsNoLogging = functionDetails.filter(f => f.config.LastUpdateStatus === 'Failed');
  addCheck(
    'Logging Enabled',
    funcsNoLogging.length === 0,
    funcsNoLogging.length === 0
      ? 'All Lambda functions have logging enabled.'
      : `Some functions (${funcsNoLogging.map(f => `${f.FunctionName} (${f.Region})`).join(', ')}) may lack logging.`,
    funcsNoLogging.map(f => f.FunctionArn)
  );

  const funcsNoDesc = functionDetails.filter(f => !f.config.Description || f.config.Description.trim() === '');
  addCheck(
    'Function Descriptions',
    funcsNoDesc.length === 0,
    funcsNoDesc.length === 0
      ? 'All Lambda functions have descriptions.'
      : `Some functions (${funcsNoDesc.map(f => `${f.FunctionName} (${f.Region})`).join(', ')}) lack descriptions.`,
    funcsNoDesc.map(f => f.FunctionArn)
  );

  return {
    ...checks,
    totalAssets: allFunctions.length,
    assetsAtRisk: assetsAtRiskSet.size,
  };
}

module.exports = { runLambdaChecks };