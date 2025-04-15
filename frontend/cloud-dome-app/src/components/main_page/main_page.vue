<template>
	<div class="flex flex-col min-h-screen font-sans antialiased">
	  <header class="w-full h-[700px] bg-gradient-to-r from-brand-blue to-brand-blue-light fixed top-0 left-0 flex flex-col z-10">
		<div class="px-5 sm:px-10 py-5 flex justify-between items-center">
		  <div class="flex flex-row items-center">
			<img src="../../assets/cloud-dome-logo.png" alt="CloudDome Logo" class="h-[50px] mr-2.5 cursor-pointer" @click="refresh">
			<button class="text-white text-2xl sm:text-[30px] font-bold bg-transparent border-none p-0 cursor-pointer hover:text-brand-dropdown-hover" @click="refresh">CloudDome</button>
		  </div>
		  <nav class="flex items-center space-x-5">
			<div class="relative inline-block" @mouseenter="showDropdown" @mouseleave="hideDropdown">
			  <a href="#" class="flex items-center text-sm sm:text-base hover:text-brand-dropdown-hover">
				Resources
				<span class="ml-1 text-xs transition-transform duration-300" :class="{ 'rotate-180': isDropdownOpen }">▼</span>
			  </a>
			  <div v-show="isDropdownOpen" class="absolute top-full right-0 bg-white min-w-[160px] shadow-custom-lg z-[1] rounded">
				<a href="#" class="block px-4 py-2.5 text-sm text-brand-blue hover:bg-gray-100 transition-colors duration-300">Documentation</a>
				<a href="#" class="block px-4 py-2.5 text-sm text-brand-blue hover:bg-gray-100 transition-colors duration-300">Tutorials</a>
				<a href="#" class="block px-4 py-2.5 text-sm text-brand-blue hover:bg-gray-100 transition-colors duration-300">Blog</a>
			  </div>
			</div>
			<a href="#" class="text-sm sm:text-base hover:text-brand-dropdown-hover">Pricing</a>
		  </nav>
		</div>
		<div class="flex flex-row justify-between">
		  <div class="text-left text-white">
			<h1 class="text-3xl sm:text-[39px] font-bold ml-10 sm:ml-[120px] mb-5 pt-10 sm:pt-[120px] px-10">Secure your AWS <br> resources with <br> CloudDome</h1>
			<p class="text-xl sm:text-[22px] mb-7 ml-10 sm:ml-[120px] px-10">CloudDome scans your AWS account <br> and gives you a security score</p>
			<div class="px-10">
			  <button class="bg-white text-brand-blue border-none py-3 px-7 text-lg sm:text-xl font-bold rounded shadow-custom cursor-pointer transition-transform duration-200 hover:-translate-y-0.5 ml-10 sm:ml-[120px]" @click="scrollToAwsInput">Scan Your AWS Assets</button>
			</div>
		  </div>
		  <img src="../../assets/overview-dashboard.png" alt="Results Overview" class="w-full sm:w-[800px] h-[450px] bg-white/20 rounded-l-lg mt-20 shadow-custom"/>
		</div>
	  </header>
	  <main class="flex flex-col items-center mt-[700px] px-10">
		<section class="mb-[110px] w-full sm:w-3/5">
		  <p class="text-base leading-relaxed">
			Many people have trouble securing all the AWS resources they used properly.
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
		<section class="w-full sm:w-3/5 mb-10">
		  <div class="flex items-center justify-between">
			<div class="flex flex-col items-center text-center">
			  <div class="w-10 h-10 rounded-full bg-brand-blue text-white flex items-center justify-center text-lg font-bold mb-2.5">1</div>
			  <span class="text-sm text-gray-700">Enter AWS Account Info</span>
			</div>
			<div class="flex-1 h-0.5 bg-gray-300 mx-2.5" :class="{ 'bg-brand-blue': isScanning || isDone }"></div>
			<div class="flex flex-col items-center text-center">
			  <div class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-lg font-bold mb-2.5" :class="{ 'bg-brand-blue text-white': isScanning || isDone }">2</div>
			  <span class="text-sm text-gray-700">CloudDome scans</span>
			</div>
			<div class="flex-1 h-0.5 bg-gray-300 mx-2.5" :class="{ 'bg-brand-blue': isDone }"></div>
			<div class="flex flex-col items-center text-center">
			  <div class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-lg font-bold mb-2.5" :class="{ 'bg-brand-blue text-white': isDone }">3</div>
			  <span class="text-sm text-gray-700">Get Security Score</span>
			</div>
		  </div>
		</section>
		<section v-if="showProgress" class="w-full sm:w-3/5 mb-5 text-center">
		  <div class="text-base font-bold text-gray-700 mb-2.5">{{ progressMessage }}</div>
		  <div class="w-full h-5 bg-brand-gray rounded-full overflow-hidden">
			<div class="h-full bg-brand-blue transition-all duration-500" :style="{ width: progressWidth + '%' }"></div>
		  </div>
		</section>
		<section class="w-full sm:w-3/5 mb-10 text-center border-2 border-brand-dark p-5 rounded relative overflow-visible">
		  <div class="absolute top-2.5 right-2.5 w-6 h-6 flex items-center justify-center cursor-pointer">
			<span class="w-6 h-6 bg-brand-blue text-white text-base font-bold rounded-full flex items-center justify-center transition-colors duration-300 hover:bg-brand-hover-blue">?</span>
			<div class="absolute top-7.5 right-0 bg-gray-800 text-white p-2.5 rounded w-[500px] z-10 text-sm leading-relaxed invisible opacity-0 transition-all duration-300 group-hover:visible group-hover:opacity-100">
			  <h3 class="text-base font-bold mb-2.5">Where to Find Your AWS Credentials</h3>
			  <p class="mb-2.5"><strong>AWS Account ID:</strong> Log in to the AWS Management Console. Your Account ID is displayed in the top-right corner under your username (click the dropdown). It’s a 12-digit number (e.g., 1234-5678-9012).</p>
			  <p class="mb-2.5"><strong>Access Key ID and Secret Access Key:</strong> Go to the IAM service in the AWS Management Console. Navigate to "Users," select your user, and go to the "Security credentials" tab. Click "Create access key" to generate a new Access Key ID and Secret Access Key. Note: You can only view the Secret Access Key once during creation, so save it securely.</p>
			  <p class="mb-2.5"><strong>Session Token (if using temporary credentials):</strong> If you’re using temporary credentials (e.g., from an IAM role or AWS SSO), you’ll get a Session Token along with your Access Key ID and Secret Access Key. You can generate temporary credentials using the AWS CLI with <code>aws sts get-session-token</code> or by assuming a role with <code>aws sts assume-role</code>.</p>
			  <p><strong>Note:</strong> For security, use temporary credentials whenever possible. Avoid using long-term access keys for IAM users.</p>
			</div>
		  </div>
		  <h2 class="text-2xl font-bold text-gray-700 mb-5">Enter your AWS Account Credentials to get started</h2>
		  <div class="flex flex-col items-center">
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
			  <div class="flex flex-col">
				<label for="aws-account-input" class="text-sm font-bold text-gray-700 mb-1.5">AWS Account ID</label>
				<input
				  type="text"
				  id="aws-account-input"
				  class="w-[300px] p-2.5 text-base border border-gray-300 rounded focus:outline-none focus:border-brand-blue focus:ring focus:ring-brand-blue/30"
				  placeholder="Enter your AWS Account ID"
				  v-model="awsAccountId"
				/>
			  </div>
			  <div class="flex flex-col">
				<label for="aws-access-key-input" class="text-sm font-bold text-gray-700 mb-1.5">Access Key</label>
				<input
				  type="text"
				  id="aws-access-key-input"
				  class="w-[300px] p-2.5 text-base border border-gray-300 rounded focus:outline-none focus:border-brand-blue focus:ring focus:ring-brand-blue/30"
				  placeholder="Enter your AWS Access Key"
				  v-model="awsAccessKey"
				/>
			  </div>
			  <div class="flex flex-col">
				<label for="aws-secret-key-input" class="text-sm font-bold text-gray-700 mb-1.5">Secret Access Key</label>
				<input
				  type="password"
				  id="aws-secret-key-input"
				  class="w-[300px] p-2.5 text-base border border-gray-300 rounded focus:outline-none focus:border-brand-blue focus:ring focus:ring-brand-blue/30"
				  placeholder="Enter your AWS Secret Access Key"
				  v-model="awsSecretKey"
				/>
			  </div>
			  <div class="flex flex-col">
				<label for="aws-session-token-input" class="text-sm font-bold text-gray-700 mb-1.5">Session Token (optional)</label>
				<input
				  type="password"
				  id="aws-session-token-input"
				  class="w-[300px] p-2.5 text-base border border-gray-300 rounded focus:outline-none focus:border-brand-blue focus:ring focus:ring-brand-blue/30"
				  placeholder="Enter your AWS Session Token (optional)"
				  v-model="awsSessionToken"
				/>
			  </div>
			</div>
			<p v-if="awsIdError" class="text-brand-red text-sm mt-0.5">{{ awsIdError }}</p>
			<button class="bg-brand-blue text-white border-none py-2.5 px-5 text-base font-bold rounded cursor-pointer transition-colors duration-300 hover:bg-brand-hover-blue" @click="validateAwsId">Submit</button>
		  </div>
		</section>
		<p class="text-sm text-gray-700 font-bold text-center my-2.5 mx-auto w-full sm:w-3/5">CloudDome never stores or saves any sensitive data that you use. We use encryption to ensure your data cannot be accessed.</p>
	  </main>
	  <footer class="bg-brand-dark py-5 w-full -ml-2.5 -mb-2.5 z-10">
		<div class="flex justify-center text-center">
		  <p class="text-sm text-white">© 2025 CloudDome. All rights reserved.</p>
		</div>
	  </footer>
	</div>
  </template>
  
  <script src="./main_page.js"></script>