const express = require('express');
const cors = require('cors'); // To allow cross-origin requests from the frontend

const app = express();
const port = 3000; // Port for the backend server

// Middleware to parse JSON requests and enable CORS
app.use(express.json());
app.use(cors());

// Mock list of valid AWS Account IDs (for testing purposes)
const validAwsIds = [
  '1234-5678-9012',
  '9876-5432-1098',
  '4567-8901-2345',
];

// API endpoint to check if an AWS Account ID exists
app.post('/api/check-aws-id', (req, res) => {
  const { awsAccountId } = req.body; // Extract the AWS Account ID from the request body

  if (!awsAccountId) {
    return res.status(400).json({ error: 'AWS Account ID is required' });
  }

  // Mock check: see if the ID exists in the validAwsIds list
  const idExists = validAwsIds.includes(awsAccountId);

  // Respond with a boolean indicating whether the ID exists
  res.json({ exists: idExists });
});

// Start the server
app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});