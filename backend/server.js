process.env.AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE = '1';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const AWS = require('aws-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const crypto = require('crypto');
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
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:8080',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.listen(port, () => {
  console.log(`Backend server running on  http://localhost:${port}`);
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const scanResultsStore = new Map();

// Generate RSA key pair
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

app.get('/api/get-public-key', (req, res) => {
  try {
    res.json({ publicKey });
  } catch (error) {
    console.error('Error serving public key:', error);
    res.status(500).json({ error: 'Failed to fetch public key' });
  }
});

const decryptPayload = (req, res, next) => {
  const { encryptedData } = req.body;
  if (!encryptedData) {
    return res.status(400).json({ error: 'Encrypted data is required' });
  }

  try {
    const encryptedBuffer = Buffer.from(encryptedData, 'base64');
    const decryptedData = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      encryptedBuffer
    );
    req.body = JSON.parse(decryptedData.toString('utf-8'));
    next();
  } catch (error) {
    console.error('Error decrypting payload:', error);
    res.status(400).json({ error: 'Failed to decrypt payload' });
  }
};

app.post('/api/check-aws-info', decryptPayload, async (req, res) => {
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

app.post('/api/run-security-checks', decryptPayload, async (req, res) => {
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

    const allDetails = [
      ...(ec2Results.details || []),
      ...(iamResults.details || []),
      ...(s3Results.details || []),
      ...(vpcResults.details || []),
      ...(rdsResults.details || []),
      ...(lambdaResults.details || []),
      ...(cloudTrailResults.details || []),
      ...(ebsResults.details || []),
      ...(elbResults.details || []),
      ...(snsResults.details || []),
      ...(sqsResults.details || []),
    ].map(detail => detail.message).join('\n');

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    // First Prompt: Score Analysis
    const systemMessageAnalysis = `
      You are an AWS security expert. Analyze the following list of security check results from an AWS environment. 
      Extract the 10 most common issues or patterns, excluding specific identifiers like resource names, ARNs, or regions. 
      Return the results as a JSON array of objects with "message" (the generalized issue) and "count" (number of occurrences).
      Focus on recurring security themes rather than unique identifiers.
    `;
    const analysisPrompt = `${systemMessageAnalysis}\n\n${allDetails}`;
    const aiAnalysisResponse = await model.generateContent(analysisPrompt);
    const aiAnalysisText = await aiAnalysisResponse.response.text();
    let aiAnalysis;
    try {
      const jsonMatch = aiAnalysisText.match(/\[.*\]/s);
      aiAnalysis = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch (error) {
      console.error('Error parsing Gemini analysis response:', error);
      aiAnalysis = [];
    }

    // Second Prompt: Steps To Take
    const systemMessageSteps = `
      You are an AWS security expert. Based on the following security check results from an AWS environment, 
      determine the top 5 actionable steps the user should take to secure their AWS resources. 
      Provide clear, concise, and prioritized steps, focusing on addressing the most critical or common issues identified. 
      Exclude specific identifiers like resource names, ARNs, or regions in the steps. 
      Return the results as a JSON array of strings, where each string is a step.
    `;
    const stepsPrompt = `${systemMessageSteps}\n\n${allDetails}`;
    const aiStepsResponse = await model.generateContent(stepsPrompt);
    const aiStepsText = await aiStepsResponse.response.text();
    let aiSteps;
    try {
      const jsonMatch = aiStepsText.match(/\[.*\]/s);
      aiSteps = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch (error) {
      console.error('Error parsing Gemini steps response:', error);
      aiSteps = [];
    }

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
      regionStats,
      aiScoreAnalysis: aiAnalysis,
      aiStepsToTake: aiSteps
    };

    // Generate a unique ID for this scan result
    const scanId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    scanResultsStore.set(scanId, result);

    res.json({ scanId });
  } catch (error) {
    console.error('Error running security checks:', error);
    res.status(500).json({ error: error.message || 'Failed to run security checks' });
  }
});

app.get('/api/get-security-results/:scanId', (req, res) => {
  const { scanId } = req.params;
  const result = scanResultsStore.get(scanId);

  if (!result) {
    return res.status(404).json({ error: 'Scan results not found or expired' });
  }

  res.json(result);
});


app.post('/api/generate-fix-code', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const aiResponse = await model.generateContent(prompt);
    const aiText = await aiResponse.response.text();

    // Extract code (assuming AI returns plain code without markdown)
    res.json({ code: aiText.trim() });
  } catch (error) {
    console.error('Error generating fix code:', error);
    res.status(500).json({ error: 'Failed to generate fix code' });
  }
});