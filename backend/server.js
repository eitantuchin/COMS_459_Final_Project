process.env.AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE = '1';

const express = require('express');
const cors = require('cors');
const AWS = require('aws-sdk');

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

    // Create an STS client with the user-provided credentials
    const sts = new AWS.STS({
      accessKeyId: awsAccessKey,
      secretAccessKey: awsSecretKey,
      sessionToken: awsSessionToken || undefined,
    });

    // Use STS to get the caller's identity with the provided credentials
    const response = await sts.getCallerIdentity().promise();

    // Check if the account ID matches
    const idExists = response.Account === awsAccountId;

    res.json({ exists: idExists });
  } catch (error) {
    console.error('Error verifying AWS Account ID:', error);

    // If the credentials are invalid or the account doesn’t exist, return false
    if (error.code === 'InvalidClientTokenId' || error.code === 'SignatureDoesNotMatch') {
      res.json({ exists: false });
    } else {
      res.status(500).json({ exists: false });
    }
  }
});

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});