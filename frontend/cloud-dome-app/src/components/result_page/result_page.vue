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
    </div>
  </template>
  
  <script src="./result_page.js"></script>
  <style scoped src="./result_page.css"></style>