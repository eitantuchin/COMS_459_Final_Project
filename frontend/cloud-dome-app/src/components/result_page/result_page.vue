<template>
    <div class="result-container">
      <h1>Security Scan Results</h1>
      <p>Overall Security Score: {{ results.securityScore }}%</p>
      <p>Total Checks Passed: {{ results.totalPassed }} / {{ results.totalChecks }}</p>
  
      <h2>EC2 Service Checks</h2>
      <p>Checks Passed: {{ results.services.ec2.totalPassed }} / {{ results.services.ec2.totalChecks }}</p>
      <ul>
        <li v-for="check in results.services.ec2.details" :key="check.name" :class="{ passed: check.passed, failed: !check.passed }">
          {{ check.name }}: {{ check.message }} ({{ check.passed ? 'Passed' : 'Failed' }})
        </li>
      </ul>
  
      <h2>IAM Service Checks</h2>
      <p>Checks Passed: {{ results.services.iam.totalPassed }} / {{ results.services.iam.totalChecks }}</p>
      <ul>
        <li v-for="check in results.services.iam.details" :key="check.name" :class="{ passed: check.passed, failed: !check.passed }">
          {{ check.name }}: {{ check.message }} ({{ check.passed ? 'Passed' : 'Failed' }})
        </li>
      </ul>
  
      <h2>S3 Service Checks</h2>
      <p>Checks Passed: {{ results.services.s3.totalPassed }} / {{ results.services.s3.totalChecks }}</p>
      <ul>
        <li v-for="check in results.services.s3.details" :key="check.name" :class="{ passed: check.passed, failed: !check.passed }">
          {{ check.name }}: {{ check.message }} ({{ check.passed ? 'Passed' : 'Failed' }})
        </li>
      </ul>
  
      <h2>VPC Service Checks</h2>
      <p>Checks Passed: {{ results.services.vpc.totalPassed }} / {{ results.services.vpc.totalChecks }}</p>
      <ul>
        <li v-for="check in results.services.vpc.details" :key="check.name" :class="{ passed: check.passed, failed: !check.passed }">
          {{ check.name }}: {{ check.message }} ({{ check.passed ? 'Passed' : 'Failed' }})
        </li>
      </ul>
  
      <h2>RDS Service Checks</h2>
      <p>Checks Passed: {{ results.services.rds.totalPassed }} / {{ results.services.rds.totalChecks }}</p>
      <ul>
        <li v-for="check in results.services.rds.details" :key="check.name" :class="{ passed: check.passed, failed: !check.passed }">
          {{ check.name }}: {{ check.message }} ({{ check.passed ? 'Passed' : 'Failed' }})
        </li>
      </ul>
  
      <h2>Lambda Service Checks</h2>
      <p>Checks Passed: {{ results.services.lambda.totalPassed }} / {{ results.services.lambda.totalChecks }}</p>
      <ul>
        <li v-for="check in results.services.lambda.details" :key="check.name" :class="{ passed: check.passed, failed: !check.passed }">
          {{ check.name }}: {{ check.message }} ({{ check.passed ? 'Passed' : 'Failed' }})
        </li>
      </ul>
  
      <h2>CloudTrail Service Checks</h2>
      <p>Checks Passed: {{ results.services.cloudtrail.totalPassed }} / {{ results.services.cloudtrail.totalChecks }}</p>
      <ul>
        <li v-for="check in results.services.cloudtrail.details" :key="check.name" :class="{ passed: check.passed, failed: !check.passed }">
          {{ check.name }}: {{ check.message }} ({{ check.passed ? 'Passed' : 'Failed' }})
        </li>
      </ul>
  
      <h2>EBS Service Checks</h2>
      <p>Checks Passed: {{ results.services.ebs.totalPassed }} / {{ results.services.ebs.totalChecks }}</p>
      <ul>
        <li v-for="check in results.services.ebs.details" :key="check.name" :class="{ passed: check.passed, failed: !check.passed }">
          {{ check.name }}: {{ check.message }} ({{ check.passed ? 'Passed' : 'Failed' }})
        </li>
      </ul>
  
      <h2>ELB Service Checks</h2>
      <p>Checks Passed: {{ results.services.elb.totalPassed }} / {{ results.services.elb.totalChecks }}</p>
      <ul>
        <li v-for="check in results.services.elb.details" :key="check.name" :class="{ passed: check.passed, failed: !check.passed }">
          {{ check.name }}: {{ check.message }} ({{ check.passed ? 'Passed' : 'Failed' }})
        </li>
      </ul>
  
      <h2>SNS Service Checks</h2>
      <p>Checks Passed: {{ results.services.sns.totalPassed }} / {{ results.services.sns.totalChecks }}</p>
      <ul>
        <li v-for="check in results.services.sns.details" :key="check.name" :class="{ passed: check.passed, failed: !check.passed }">
          {{ check.name }}: {{ check.message }} ({{ check.passed ? 'Passed' : 'Failed' }})
        </li>
      </ul>
  
      <h2>SQS Service Checks</h2>
      <p>Checks Passed: {{ results.services.sqs.totalPassed }} / {{ results.services.sqs.totalChecks }}</p>
      <ul>
        <li v-for="check in results.services.sqs.details" :key="check.name" :class="{ passed: check.passed, failed: !check.passed }">
          {{ check.name }}: {{ check.message }} ({{ check.passed ? 'Passed' : 'Failed' }})
        </li>
      </ul>
    </div>
  </template>
  
  <script src="./result_page.js"></script>
  <style scoped src="./result_page.css"></style>