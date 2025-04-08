process.env.AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE = '1';

const express = require('express');
const cors = require('cors');
const AWS = require('aws-sdk');
const { runEc2Checks } = require('./checks/ec2_checks');
const { runIamChecks } = require('./checks/iam_checks');
const { runS3Checks } = require('./checks/s3_checks');
const { runVpcChecks } = require('./checks/vpc_checks');
const { runRdsChecks } = require('./checks/rds_checks');
const { runLambdaChecks } = require('./checks/lambda_checks');
const { runCloudTrailChecks } = require('./checks/cloudtrail_checks');
const { runEbsChecks } = require('./checks/ebs_checks');
const { runElbChecks } = require('./checks/elb_checks');
const { runSnsChecks } = require('./checks/sns_checks');
const { runSqsChecks } = require('./checks/sqs_checks');

const app = express();
const port = 3000;
const scanResultsStore = new Map();
app.use(express.json());
app.use(cors());

// API endpoint to check if an AWS Account ID exists
app.post('/api/check-aws-info', async (req, res) => {
  const { awsAccountId, awsAccessKey, awsSecretKey, awsSessionToken } = req.body;

  if (!awsAccountId) {
    return res.status(400).json({ error: 'AWS Account ID is required' });
  }

  if (!awsAccessKey || !awsSecretKey) {
    return res.status(400).json({ error: 'Access Key ID and Secret Access Key are required' });
  }

  try {
    const sts = new AWS.STS({
      accessKeyId: awsAccessKey,
      secretAccessKey: awsSecretKey,
      sessionToken: awsSessionToken || undefined,
    });

    const response = await sts.getCallerIdentity().promise();
    const idExists = response.Account === awsAccountId;

    res.json({ exists: idExists });
  } catch (error) {
    console.error('Error verifying AWS Account ID:', error);
    if (error.code === 'InvalidClientTokenId' || error.code === 'SignatureDoesNotMatch') {
      res.status(401).json({ exists: false, error: 'Invalid AWS credentials' });
    } else {
      res.status(500).json({ exists: false, error: error.message || 'Internal server error' });
    }
  }
});

// API endpoint to run security checks
app.post('/api/run-security-checks', async (req, res) => {
  const { awsAccountId, awsAccessKey, awsSecretKey, awsSessionToken } = req.body;

  if (!awsAccountId || !awsAccessKey || !awsSecretKey) {
    return res.status(400).json({ error: 'All AWS credentials are required' });
  }

  try {
    const credentials = {
      accessKeyId: awsAccessKey,
      secretAccessKey: awsSecretKey,
      sessionToken: awsSessionToken || undefined,
    };

    // Run security checks for all services concurrently
    const [
      ec2Results,
      iamResults,
      s3Results,
      vpcResults,
      rdsResults,
      lambdaResults,
      cloudTrailResults,
      ebsResults,
      elbResults,
      snsResults,
      sqsResults,
    ] = await Promise.all([
      runEc2Checks(credentials),
      runIamChecks(credentials),
      runS3Checks(credentials),
      runVpcChecks(credentials),
      runRdsChecks(credentials),
      runLambdaChecks(credentials),
      runCloudTrailChecks(credentials),
      runEbsChecks(credentials),
      runElbChecks(credentials),
      runSnsChecks(credentials),
      runSqsChecks(credentials),
    ]);

    // Aggregate totals across all services
    const totalChecks =
      ec2Results.totalChecks +
      iamResults.totalChecks +
      s3Results.totalChecks +
      vpcResults.totalChecks +
      rdsResults.totalChecks +
      lambdaResults.totalChecks +
      cloudTrailResults.totalChecks +
      ebsResults.totalChecks +
      elbResults.totalChecks +
      snsResults.totalChecks +
      sqsResults.totalChecks;

    const totalPassed =
      ec2Results.totalPassed +
      iamResults.totalPassed +
      s3Results.totalPassed +
      vpcResults.totalPassed +
      rdsResults.totalPassed +
      lambdaResults.totalPassed +
      cloudTrailResults.totalPassed +
      ebsResults.totalPassed +
      elbResults.totalPassed +
      snsResults.totalPassed +
      sqsResults.totalPassed;

    const totalAssets =
      (ec2Results.totalAssets || 0) +
      (iamResults.totalAssets || 0) +
      (s3Results.totalAssets || 0) +
      (vpcResults.totalAssets || 0) +
      (rdsResults.totalAssets || 0) +
      (lambdaResults.totalAssets || 0) +
      (cloudTrailResults.totalAssets || 0) +
      (ebsResults.totalAssets || 0) +
      (elbResults.totalAssets || 0) +
      (snsResults.totalAssets || 0) +
      (sqsResults.totalAssets || 0);

    const totalAssetsAtRisk =
      (ec2Results.assetsAtRisk || 0) +
      (iamResults.assetsAtRisk || 0) +
      (s3Results.assetsAtRisk || 0) +
      (vpcResults.assetsAtRisk || 0) +
      (rdsResults.assetsAtRisk || 0) +
      (lambdaResults.assetsAtRisk || 0) +
      (cloudTrailResults.assetsAtRisk || 0) +
      (ebsResults.assetsAtRisk || 0) +
      (elbResults.assetsAtRisk || 0) +
      (snsResults.assetsAtRisk || 0) +
      (sqsResults.assetsAtRisk || 0);

    const securityScore = totalChecks > 0 ? (totalPassed / totalChecks) * 100 : 0;

   // Aggregate region stats from all services
   const regionStats = {};
   const addRegionStats = (serviceResults, serviceName) => {
     if (serviceResults.regionStats) {
       Object.entries(serviceResults.regionStats).forEach(([region, stats]) => {
         if (!regionStats[region]) {
           regionStats[region] = { totalAssets: 0, assetsAtRisk: 0 };
         }
         regionStats[region].totalAssets += stats.totalAssets;
         regionStats[region].assetsAtRisk += stats.assetsAtRisk;
       });
     }
   };

   addRegionStats(ec2Results, 'ec2');
   addRegionStats(vpcResults, 'vpc');
   addRegionStats(rdsResults, 'rds');
   addRegionStats(lambdaResults, 'lambda');
   addRegionStats(ebsResults, 'ebs');
   addRegionStats(elbResults, 'elb');
   addRegionStats(snsResults, 'sns');
   addRegionStats(sqsResults, 'sqs');
   addRegionStats(iamResults, 'iam');
   addRegionStats(s3Results, 's3');
   addRegionStats(cloudTrailResults, 'cloudtrail');
   // Note: IAM, S3, CloudTrail are typically global or not fully region-specific

   const result = {
     securityScore: securityScore.toFixed(2),
     totalAssets,
     totalAssetsAtRisk,
     services: {
       ec2: {
         totalChecks: ec2Results.totalChecks,
         totalPassed: ec2Results.totalPassed,
         totalAssets: ec2Results.totalAssets || 0,
         assetsAtRisk: ec2Results.assetsAtRisk || 0,
         details: ec2Results.details,
         regionStats: ec2Results.regionStats || {},
       },
       iam: {
         totalChecks: iamResults.totalChecks,
         totalPassed: iamResults.totalPassed,
         totalAssets: iamResults.totalAssets || 0,
         assetsAtRisk: iamResults.assetsAtRisk || 0,
         details: iamResults.details,
         regionStats: iamResults.regionStats || {},
       },
       s3: {
         totalChecks: s3Results.totalChecks,
         totalPassed: s3Results.totalPassed,
         totalAssets: s3Results.totalAssets || 0,
         assetsAtRisk: s3Results.assetsAtRisk || 0,
         details: s3Results.details,
         regionStats: s3Results.regionStats || {},
       },
       vpc: {
         totalChecks: vpcResults.totalChecks,
         totalPassed: vpcResults.totalPassed,
         totalAssets: vpcResults.totalAssets || 0,
         assetsAtRisk: vpcResults.assetsAtRisk || 0,
         details: vpcResults.details,
         regionStats: vpcResults.regionStats || {},
       },
       rds: {
         totalChecks: rdsResults.totalChecks,
         totalPassed: rdsResults.totalPassed,
         totalAssets: rdsResults.totalAssets || 0,
         assetsAtRisk: rdsResults.assetsAtRisk || 0,
         details: rdsResults.details,
         regionStats: rdsResults.regionStats || {},
       },
       lambda: {
         totalChecks: lambdaResults.totalChecks,
         totalPassed: lambdaResults.totalPassed,
         totalAssets: lambdaResults.totalAssets || 0,
         assetsAtRisk: lambdaResults.assetsAtRisk || 0,
         details: lambdaResults.details,
         regionStats: lambdaResults.regionStats || {},
       },
       cloudtrail: {
         totalChecks: cloudTrailResults.totalChecks,
         totalPassed: cloudTrailResults.totalPassed,
         totalAssets: cloudTrailResults.totalAssets || 0,
         assetsAtRisk: cloudTrailResults.assetsAtRisk || 0,
         details: cloudTrailResults.details,
         regionStats: cloudTrailResults.regionStats || {},
       },
       ebs: {
         totalChecks: ebsResults.totalChecks,
         totalPassed: ebsResults.totalPassed,
         totalAssets: ebsResults.totalAssets || 0,
         assetsAtRisk: ebsResults.assetsAtRisk || 0,
         details: ebsResults.details,
         regionStats: ebsResults.regionStats || {},
       },
       elb: {
         totalChecks: elbResults.totalChecks,
         totalPassed: elbResults.totalPassed,
         totalAssets: elbResults.totalAssets || 0,
         assetsAtRisk: elbResults.assetsAtRisk || 0,
         details: elbResults.details,
         regionStats: elbResults.regionStats || {},
       },
       sns: {
         totalChecks: snsResults.totalChecks,
         totalPassed: snsResults.totalPassed,
         totalAssets: snsResults.totalAssets || 0,
         assetsAtRisk: snsResults.assetsAtRisk || 0,
         details: snsResults.details,
         regionStats: snsResults.regionStats || {},
       },
       sqs: {
         totalChecks: sqsResults.totalChecks,
         totalPassed: sqsResults.totalPassed,
         totalAssets: sqsResults.totalAssets || 0,
         assetsAtRisk: sqsResults.assetsAtRisk || 0,
         details: sqsResults.details,
         regionStats: sqsResults.regionStats || {},
       },
     },
     totalChecks,
     totalPassed,
     regionStats // Top-level region stats
   };

    // Generate a unique ID for this scan result
    const scanId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    scanResultsStore.set(scanId, result);

    // Return the ID instead of the full result
    res.json({ scanId });
  } catch (error) {
    console.error('Error running security checks:', error);
    res.status(500).json({ error: error.message || 'Failed to run security checks' });
  }
});
tard
// New endpoint to fetch scan results by ID
app.get('/api/get-security-results/:scanId', (req, res) => {
    const { scanId } = req.params;
    const result = scanResultsStore.get(scanId);
  
    if (!result) {
      return res.status(404).json({ error: 'Scan results not found or expired' });
    }
  
    res.json(result);
  });

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});