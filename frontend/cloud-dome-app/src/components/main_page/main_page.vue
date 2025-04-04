<template>
	<div class="main-container">
	  <header class="header">
		<div class="top-nav">
		  <div class="top-left-nav">
			<div class="icon-image"></div>
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
		  <p>Many people have trouble securing of all the AWS resources they used properly. Why? AWS is a large user interface with many different features and options for every service, making it difficult and time-consuming to ensure all services comply with industry-level security standards. The <b>CloudDome Security Score (CDSS)</b> will help you optimize your security protocol, pointing out areas weakly secured and giving you a clear guide on how to improve your score. <br><br><b>CloudDome's assessment can increase your security score by 50%.</b></p>
		</section>
		<!-- Process steps section -->
		<section class="process-steps-section">
		  <div class="process-steps">
			<div class="step">
			  <div class="step-number active">1</div>
			  <div class="step-label">Enter AWS Account ID</div>
			</div>
			<div class="step-connector"></div>
			<div class="step">
			  <div class="step-number">2</div>
			  <div class="step-label">CloudDome scans</div>
			</div>
			<div class="step-connector"></div>
			<div class="step">
			  <div class="step-number">3</div>
			  <div class="step-label">Get Security Score</div>
			</div>
		  </div>
		</section>
		<!-- New section for AWS account ID input -->
		<section class="aws-account-section">
			<h2 class="aws-account-title">Enter your AWS Account ID to get started</h2>
			<div class="aws-account-input-wrapper">
				<input
				type="text"
				id="aws-account-input"
				class="aws-account-input"
				placeholder="Example AWS ID: 0123-4567-8910"
				v-model="awsAccountId"
				/>
				<p v-if="awsIdError" class="error-message">{{ awsIdError }}</p> <!-- Display error message if it exists -->
				<button class="aws-account-submit" @click="validateAwsId">Submit AWS Account ID</button>
			</div>
		</section>
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