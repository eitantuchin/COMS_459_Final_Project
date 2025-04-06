process.env.AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE = '1';

const express = require('express');
const cors = require('cors');
const AWS = require('aws-sdk');
const { runEc2Checks } = require('./checks/ec2_checks');
const { runIamChecks } = require('./checks/iam_checks');

const app = express();
const port = 3000;

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
  
      // Run security checks for EC2 and IAM concurrently
      const [ec2Results, iamResults] = await Promise.all([
        runEc2Checks(credentials),
        runIamChecks(credentials),
      ]);
  
      // Aggregate totals across all services
      const totalChecks = ec2Results.totalChecks + iamResults.totalChecks;
      const totalPassed = ec2Results.totalPassed + iamResults.totalPassed;
      const securityScore = totalChecks > 0 ? (totalPassed / totalChecks) * 100 : 0;
  
      // Prepare response
      const result = {
        securityScore: securityScore.toFixed(2),
        services: {
          ec2: {
            totalChecks: ec2Results.totalChecks,
            totalPassed: ec2Results.totalPassed,
            details: ec2Results.details,
          },
          iam: {
            totalChecks: iamResults.totalChecks,
            totalPassed: iamResults.totalPassed,
            details: iamResults.details,
          },
        },
        totalChecks,
        totalPassed,
      };
  
      res.json(result);
    } catch (error) {
      console.error('Error running security checks:', error);
      res.status(500).json({ error: error.message || 'Failed to run security checks' });
    }
  });

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});