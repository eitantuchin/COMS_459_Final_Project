<template>
	<div class="main-container">
	  <header class="header">
		<div class="top-nav">
		  <div class="top-left-nav">
			<img src="../../assets/cloud-dome-logo.png" alt="CloudDome Logo" class="icon-image">
			<button class="logo">CloudDome</button>
		  </div>
		  <nav class="nav-links">
			<div class="dropdown" @mouseenter="showDropdown" @mouseleave="hideDropdown">
			  <a href="#" class="dropdown-toggle">
				Resources
				<span class="arrow" :class="{ 'flipped': isDropdownOpen }">▼</span>
			  </a>
			  <div v-show="isDropdownOpen" class="resources-dropdown-menu">
				<a href="#">Documentation</a>
				<a href="#">Tutorials</a>
				<a href="#">Blog</a>
			  </div>
			</div>
			<a href="#">Pricing</a>
		  </nav>
		</div>
		<div class="header-content">
		  <div class="text-container">
			<h1 class="page-title">Secure your AWS <br> resources with <br> CloudDome</h1>
			<p class="title-description">CloudDome scans your AWS account <br> and gives you a security score</p>
			<div class="title-button-wrapper">
			  <button class="title-button" @click="scrollToAwsInput">Scan Your AWS Assets</button>
			</div>
		  </div>
		  <div class="main-image"></div>
		</div>
	  </header>
	  <main class="main-content">
		<section class="clouddome-impact">
			<p>
				Many people have trouble securing of all the AWS resources they used properly.
				Why? AWS is a large user interface with many different features and options 
				for every service, making it difficult and time-consuming to ensure all 
				services comply with industry-level security standards. The <b>CloudDome 
				Security Score (CDSS)</b> will help you optimize your security protocol, 
				pointing out areas weakly secured and giving you a clear guide on 
				how to improve your score. 
				<br>
				<br>
				<b>CloudDome's assessment can increase your security score by 50%.</b>
			</p>
		</section>
		<!-- Process steps section -->
		<section class="process-steps-section">
			<div class="process-steps">
			<div class="step">
				<div class="step-number active">1</div>
				<div class="step-label">Enter AWS Account Info</div>
			</div>
			<div class="step-connector" :class="{ 'active': isScanning || isDone }"></div>
			<div class="step">
				<div class="step-number" :class="{ 'active': isScanning || isDone }">2</div>
				<div class="step-label">CloudDome scans</div>
			</div>
			<div class="step-connector" :class="{ 'active': isDone }"></div>
			<div class="step">
				<div class="step-number" :class="{ 'active': isDone }">3</div>
				<div class="step-label">Get Security Score</div>
			</div>
			</div>
		</section>
		<section class="progress-section" v-if="showProgress">
			<div class="progress-message">{{ progressMessage }}</div>
			<div class="progress-bar">
			<div class="progress-fill" :style="{ width: progressWidth + '%' }"></div>
			</div>
      	</section>
		<!-- AWS account ID input section -->
		<section class="aws-account-section">
			<div class="help-icon">
			<span class="question-mark">?</span>
			<div class="tooltip">
				<h3>Where to Find Your AWS Credentials</h3>
				<p><strong>AWS Account ID:</strong> Log in to the AWS Management Console. Your Account ID is displayed in the top-right corner under your username (click the dropdown). It’s a 12-digit number (e.g., 1234-5678-9012).</p>
				<p><strong>Access Key ID and Secret Access Key:</strong> Go to the IAM service in the AWS Management Console. Navigate to "Users," select your user, and go to the "Security credentials" tab. Click "Create access key" to generate a new Access Key ID and Secret Access Key. Note: You can only view the Secret Access Key once during creation, so save it securely.</p>
				<p><strong>Session Token (if using temporary credentials):</strong> If you’re using temporary credentials (e.g., from an IAM role or AWS SSO), you’ll get a Session Token along with your Access Key ID and Secret Access Key. You can generate temporary credentials using the AWS CLI with <code>aws sts get-session-token</code> or by assuming a role with <code>aws sts assume-role</code>.</p>
				<p><strong>Note:</strong> For security, use temporary credentials whenever possible. Avoid using long-term access keys for IAM users.</p>
			</div>
			</div>
			<h2 class="aws-account-title">Enter your AWS Account Credentials to get started</h2>
			<div class="aws-account-input-wrapper">
			<div class="aws-input-grid">
				<div class="input-group">
				<label for="aws-account-input">AWS Account ID</label>
				<input
					type="text"
					id="aws-account-input"
					class="aws-account-input"
					placeholder="Enter your AWS Account ID"
					v-model="awsAccountId"
				/>
				</div>
				<div class="input-group">
				<label for="aws-access-key-input">Access Key</label>
				<input
					type="text"
					id="aws-access-key-input"
					class="aws-account-input"
					placeholder="Enter your AWS Access Key"
					v-model="awsAccessKey"
				/>
				</div>
				<div class="input-group">
				<label for="aws-secret-key-input">Secret Access Key</label>
				<input
					type="password"
					id="aws-secret-key-input"
					class="aws-account-input"
					placeholder="Enter your AWS Secret Access Key"
					v-model="awsSecretKey"
				/>
				</div>
				<div class="input-group">
				<label for="aws-session-token-input">Session Token (optional)</label>
				<input
					type="password"
					id="aws-session-token-input"
					class="aws-account-input"
					placeholder="Enter your AWS Session Token (optional)"
					v-model="awsSessionToken"
				/>
				</div>
			</div>
			<p v-if="awsIdError" class="error-message">{{ awsIdError }}</p>
			<button class="aws-account-submit" @click="validateAwsId">Submit</button>
			</div>
		</section>
		<p class="privacy-message">CloudDome never stores or saves any sensitive data that you use.</p>
		</main>
	  <footer class="footer">
		<div class="footer-copyright">
		  <p>© 2025 CloudDome. All rights reserved.</p>
		</div>
	  </footer>
	</div>
  </template>
  
  <script src="./main_page.js"></script>
  <style scoped src="./main_page.css"></style>