<template>
	<div class="main-container flex flex-col min-h-screen">
	  <!-- Header -->
	  <header class="bg-gradient-to-r from-blue-600 to-blue-400 text-white w-full relative z-10">
		<div class="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
		  <div class="flex justify-between items-center">
			<div class="flex items-center space-x-3">
			  <img src="../../assets/cloud-dome-logo.png" alt="CloudDome Logo" class="h-10 cursor-pointer" @click="refresh">
			  <button class="text-2xl sm:text-3xl font-bold bg-transparent border-none cursor-pointer hover:text-blue-100" @click="refresh">
				CloudDome
			  </button>
			</div>
			<nav class="flex items-center space-x-4 sm:space-x-6">
			  <div class="relative group" @mouseenter="showDropdown" @mouseleave="hideDropdown">
				<a href="#" class="flex items-center text-sm sm:text-base hover:text-blue-100">
				  Resources
				  <span class="ml-1 text-xs transition-transform duration-300" :class="{ 'rotate-180': isDropdownOpen }">▼</span>
				</a>
				<div v-show="isDropdownOpen" class="absolute right-0 mt-2 w-40 bg-white text-blue-600 shadow-lg rounded-md z-20">
				  <a href="#" class="block px-4 py-2 text-sm hover:bg-gray-100">Documentation</a>
				  <a href="#" class="block px-4 py-2 text-sm hover:bg-gray-100">Tutorials</a>
				  <a href="#" class="block px-4 py-2 text-sm hover:bg-gray-100">Blog</a>
				</div>
			  </div>
			  <a href="#" class="text-sm sm:text-base hover:text-blue-100">Pricing</a>
			</nav>
		  </div>
		  <div class="flex flex-col lg:flex-row items-center justify-between mt-8 sm:mt-12 lg:mt-16">
			<div class="text-center lg:text-left mb-8 lg:mb-0 max-w-lg">
			  <h1 class="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight">
				Secure your AWS<br>resources with<br>CloudDome
			  </h1>
			  <p class="mt-4 text-lg sm:text-xl">
				CloudDome scans your AWS account<br>and gives you a security score
			  </p>
			  <button class="mt-6 bg-white text-blue-600 font-bold py-3 px-6 rounded-md shadow-md hover:-translate-y-1 transition-transform" @click="scrollToAwsInput">
				Scan Your AWS Assets
			  </button>
			</div>
			<img src="../../assets/overview-dashboard.png" alt="Results Overview" class="w-full max-w-md lg:max-w-lg rounded-lg shadow-lg">
		  </div>
		</div>
	  </header>
  
	  <!-- Main Content -->
	  <main class="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 pt-40 sm:pt-48 lg:pt-56 pb-12">
		<!-- CloudDome Impact -->
		<section class="mb-12 max-w-3xl mx-auto text-center">
		  <p class="text-base sm:text-lg leading-relaxed">
			Many people have trouble securing all the AWS resources they use properly.
			Why? AWS is a large user interface with many different features and options
			for every service, making it difficult and time-consuming to ensure all
			services comply with industry-level security standards. The <span class="font-bold">CloudDome
			Security Score (CDSS)</span> will help you optimize your security protocol,
			pointing out areas weakly secured and giving you a clear guide on
			how to improve your score.
			<br><br>
			<span class="font-bold">CloudDome's assessment can increase your security score by 50%.</span>
		  </p>
		</section>
  
		<!-- Process Steps -->
		<section class="mb-12 max-w-3xl mx-auto">
		  <div class="flex flex-col sm:flex-row items-center justify-between space-y-6 sm:space-y-0 sm:space-x-4">
			<div class="flex flex-col items-center text-center">
			  <div class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-lg font-bold" :class="{ 'bg-blue-600 text-white': true }">1</div>
			  <span class="mt-2 text-sm sm:text-base">Enter AWS Account Info</span>
			</div>
			<div class="flex-1 h-0.5 bg-gray-300 sm:mx-4" :class="{ 'bg-blue-600': isScanning || isDone }"></div>
			<div class="flex flex-col items-center text-center">
			  <div class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-lg font-bold" :class="{ 'bg-blue-600 text-white': isScanning || isDone }">2</div>
			  <span class="mt-2 text-sm sm:text-base">CloudDome scans</span>
			</div>
			<div class="flex-1 h-0.5 bg-gray-300 sm:mx-4" :class="{ 'bg-blue-600': isDone }"></div>
			<div class="flex flex-col items-center text-center">
			  <div class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-lg font-bold" :class="{ 'bg-blue-600 text-white': isDone }">3</div>
			  <span class="mt-2 text-sm sm:text-base">Get Security Score</span>
			</div>
		  </div>
		</section>
  
		<!-- Progress Bar -->
		<section v-if="showProgress" class="mb-12 max-w-3xl mx-auto text-center">
		  <div class="text-lg font-bold text-gray-800 mb-4">{{ progressMessage }}</div>
		  <div class="w-full h-5 bg-gray-200 rounded-full overflow-hidden">
			<div class="h-full bg-blue-600 transition-all duration-500" :style="{ width: progressWidth + '%' }"></div>
		  </div>
		</section>
  
		<!-- AWS Account Input -->
		<section class="max-w-3xl mx-auto border-2 border-gray-900 rounded-lg p-6 relative">
		  <div class="absolute top-4 right-4 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center cursor-pointer group">
			<span class="text-sm font-bold">?</span>
			<div class="absolute top-8 right-0 bg-gray-800 text-white p-4 rounded-md w-80 sm:w-96 text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
			  <h3 class="text-base font-bold mb-2">Where to Find Your AWS Credentials</h3>
			  <p class="mb-2"><strong>AWS Account ID:</strong> Log in to the AWS Management Console. Your Account ID is displayed in the top-right corner under your username (click the dropdown). It’s a 12-digit number (e.g., 1234-5678-9012).</p>
			  <p class="mb-2"><strong>Access Key ID and Secret Access Key:</strong> Go to the IAM service in the AWS Management Console. Navigate to "Users," select your user, and go to the "Security credentials" tab. Click "Create access key" to generate a new Access Key ID and Secret Access Key.</p>
			  <p class="mb-2"><strong>Session Token (if using temporary credentials):</strong> If you’re using temporary credentials, you’ll get a Session Token along with your Access Key ID and Secret Access Key.</p>
			  <p><strong>Note:</strong> For security, use temporary credentials whenever possible. Avoid using long-term access keys for IAM users.</p>
			</div>
		  </div>
		  <h2 class="text-2xl sm:text-3xl font-bold text-center text-gray-800 mb-6">Enter your AWS Account Credentials to get started</h2>
		  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
			<div class="flex flex-col">
			  <label for="aws-account-input" class="text-sm font-bold text-gray-700 mb-2">AWS Account ID</label>
			  <input
				type="text"
				id="aws-account-input"
				class="border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
				placeholder="Enter your AWS Account ID"
				v-model="awsAccountId"
			  />
			</div>
			<div class="flex flex-col">
			  <label for="aws-access-key-input" class="text-sm font-bold text-gray-700 mb-2">Access Key</label>
			  <input
				type="text"
				id="aws-access-key-input"
				class="border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
				placeholder="Enter your AWS Access Key"
				v-model="awsAccessKey"
			  />
			</div>
			<div class="flex flex-col">
			  <label for="aws-secret-key-input" class="text-sm font-bold text-gray-700 mb-2">Secret Access Key</label>
			  <input
				type="password"
				id="aws-secret-key-input"
				class="border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
				placeholder="Enter your AWS Secret Access Key"
				v-model="awsSecretKey"
			  />
			</div>
			<div class="flex flex-col">
			  <label for="aws-session-token-input" class="text-sm font-bold text-gray-700 mb-2">Session Token (optional)</label>
			  <input
				type="password"
				id="aws-session-token-input"
				class="border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
				placeholder="Enter your AWS Session Token (optional)"
				v-model="awsSessionToken"
			  />
			</div>
		  </div>
		  <p v-if="awsIdError" class="text-red-600 text-sm mt-4 text-center">{{ awsIdError }}</p>
		  <div class="flex justify-center mt-6">
			<button class="bg-blue-600 text-white font-bold py-3 px-6 rounded-md hover:bg-blue-700 transition-colors" @click="validateAwsId">
			  Submit
			</button>
		  </div>
		</section>
  
		<!-- Privacy Message -->
		<p class="text-center text-sm sm:text-base font-bold text-gray-800 mt-6 max-w-3xl mx-auto">
		  CloudDome never stores or saves any sensitive data that you use. We use encryption to ensure your data cannot be accessed.
		</p>
	  </main>
  
	  <!-- Footer -->
	  <footer class="bg-gray-900 text-white py-6 w-full">
		<div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
		  <p class="text-sm">© 2025 CloudDome. All rights reserved.</p>
		</div>
	  </footer>
	</div>
  </template>
  
  <script src="./main_page.js"></script>