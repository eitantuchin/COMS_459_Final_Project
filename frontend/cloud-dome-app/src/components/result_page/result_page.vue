<template>
    <div class="main-container flex flex-col min-h-screen">
      <!-- Header -->
      <header class="bg-gradient-to-r from-blue-600 to-blue-400 text-white w-full fixed top-0 z-10 shadow-lg">
        <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div class="flex justify-between items-center">
            <div class="flex items-center space-x-3">
              <img src="../../assets/cloud-dome-logo.png" alt="CloudDome Logo" class="h-10 cursor-pointer" @click="goToMainPage">
              <button class="text-2xl sm:text-3xl font-bold bg-transparent border-none cursor-pointer hover:text-blue-100" @click="goToMainPage">
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
        </div>
      </header>
  
      <!-- Main Content -->
      <main class="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12 bg-gray-100">
        <div v-if="results.securityScore" class="flex flex-col lg:flex-row gap-6">
          <!-- Left Panel -->
          <div class="w-full lg:w-64 bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-xl sm:text-2xl font-semibold text-gray-800 border-b pb-3 mb-6">Reports</h2>
            <ul class="space-y-2">
              <li v-for="(item, index) in panelItems" :key="index"
                  class="flex items-center p-3 rounded-md cursor-pointer text-gray-600 hover:bg-gray-50 hover:text-blue-600"
                  :class="{ 'bg-blue-50 text-blue-600 font-semibold': activePanel === index }"
                  @click="setActivePanel(index)"
                  :title="item.label">
                <span class="w-1 h-full bg-blue-600 mr-3 transition-transform" :class="{ 'scale-y-100': activePanel === index, 'scale-y-50 opacity-20': activePanel !== index }"></span>
                <i :class="item.icon + ' mr-2'"></i>
                {{ item.label }}
              </li>
            </ul>
          </div>
  
          <!-- Columns Container -->
          <div class="flex-1">
            <!-- Overview Tab -->
            <div v-if="activePanel === 0" class="flex flex-col lg:flex-row gap-6">
              <!-- Security Score -->
              <div class="w-full lg:w-1/2 bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
                <h2 class="text-xl sm:text-2xl font-semibold text-gray-800 text-center mb-6">Your Security Score</h2>
                <div class="relative bg-gradient-to-br from-gray-50 to-blue-50 p-6 rounded-lg mb-6">
                  <div class="relative w-48 h-48 sm:w-56 sm:h-56 mx-auto">
                    <svg class="progress-ring" width="100%" height="100%">
                      <circle class="progress-ring__background" cx="50%" cy="50%" r="45%" stroke-width="10%" />
                      <circle class="progress-ring__fill" :style="{
                        strokeDasharray: `${circumference} ${circumference}`,
                        strokeDashoffset: strokeDashoffset,
                        stroke: ringColor
                      }" cx="50%" cy="50%" r="45%" stroke-width="10%" />
                      <circle class="progress-ring__inner" cx="50%" cy="50%" r="36%" />
                    </svg>
                    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-baseline">
                      <span class="text-4xl sm:text-5xl font-bold text-gray-800">{{ animatedScore }}</span>
                      <span class="text-lg sm:text-xl text-gray-600">/100</span>
                    </div>
                    <span class="absolute bottom-0 left-1/2 -translate-x-1/2 text-lg sm:text-xl font-semibold bg-white px-4 py-1 rounded-full shadow" :style="{ color: ringColor }">
                      {{ scoreLabel }}
                    </span>
                  </div>
                </div>
                <div class="text-center">
                  <p class="text-sm sm:text-base text-gray-600 mb-6">
                    This score reflects the overall security posture of your AWS assets based on our comprehensive scan.
                  </p>
                  <div class="text-left">
                    <h3 class="text-lg font-semibold text-blue-600 mb-2">What Does This Score Mean?</h3>
                    <p class="text-sm sm:text-base text-gray-600 mb-4">
                      Your security score is a comprehensive metric that evaluates the security posture of your AWS environment.
                    </p>
                    <h3 class="text-lg font-semibold text-blue-600 mb-2">How Is It Calculated?</h3>
                    <p class="text-sm sm:text-base text-gray-600">
                      The score is calculated by running a series of security checks across your AWS services.
                    </p>
                  </div>
                </div>
              </div>
              <!-- Assets Overview & Vulnerable Services -->
              <div class="w-full lg:w-1/2 flex flex-col gap-6">
                <div class="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
                  <h2 class="text-xl sm:text-2xl font-semibold text-gray-800 text-center mb-6">Assets Breakdown</h2>
                  <div class="flex flex-col items-center gap-6">
                    <div class="text-center bg-gradient-to-br from-gray-50 to-blue-50 p-4 rounded-lg">
                      <div class="text-4xl sm:text-5xl font-bold text-blue-600">{{ animatedTotalAssets }}</div>
                      <div class="text-sm sm:text-base text-gray-600">Total Assets Checked</div>
                    </div>
                    <div class="w-full">
                      <div class="flex justify-center gap-6 sm:gap-8 mb-4">
                        <div class="flex flex-col items-center bg-green-50 p-4 rounded-md">
                          <span class="text-2xl mb-2">🛡️</span>
                          <span class="text-2xl font-semibold text-green-600">{{ animatedSafeAssets }}</span>
                          <span class="text-sm text-gray-600">Safe</span>
                        </div>
                        <div class="flex flex-col items-center bg-red-50 p-4 rounded-md">
                          <span class="text-2xl mb-2">⚠️</span>
                          <span class="text-2xl font-semibold text-red-600">{{ animatedAtRiskAssets }}</span>
                          <span class="text-sm text-gray-600">At Risk</span>
                        </div>
                      </div>
                      <div class="w-full h-3 bg-gray-200 rounded-full overflow-hidden mb-2">
                        <div class="h-full bg-green-600" :style="{ width: safeBarWidth + '%' }"></div>
                        <div class="h-full bg-red-600 absolute right-0 top-0" :style="{ width: atRiskBarWidth + '%' }"></div>
                      </div>
                      <div class="flex justify-between text-sm">
                        <span class="flex items-center text-green-600">
                          <span class="w-2 h-2 bg-green-600 rounded-full mr-1"></span>Safe {{ Math.round(safePercentage) }}%
                        </span>
                        <span class="flex items-center text-red-600">
                          <span class="w-2 h-2 bg-red-600 rounded-full mr-1"></span>At Risk {{ Math.round(atRiskPercentage) }}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow flex-1">
                  <h2 class="text-xl sm:text-2xl font-semibold text-gray-800 text-center mb-6">Most Vulnerable Services</h2>
                  <div class="max-h-80 overflow-y-auto">
                    <div v-for="(service, index) in sortedServices" :key="service.name" class="bg-gray-50 p-3 rounded-md mb-3">
                      <div class="flex justify-between items-center mb-2">
                        <span class="font-semibold text-gray-800">{{ service.name }}</span>
                        <span class="text-red-600 font-semibold">{{ service.assetsAtRisk }} assets</span>
                      </div>
                      <div class="w-full h-2 bg-gray-200 rounded-full">
                        <div class="h-full bg-blue-600 rounded-full" :style="{ width: serviceBarWidths[index] + '%' }"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
  
            <!-- Charts Tab -->
            <div v-else-if="activePanel === 1" class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <!-- Service Security Scores -->
              <div class="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
                <h2 class="text-xl sm:text-2xl font-semibold text-gray-800 text-center mb-6">Service Security Scores</h2>
                <div class="flex flex-wrap justify-center gap-6 max-h-96 overflow-y-auto">
                  <div v-for="service in serviceScores" :key="service.name" class="flex flex-col items-center w-24 sm:w-32">
                    <div class="relative w-20 h-20 sm:w-24 sm:h-24">
                      <svg class="progress-ring" width="100%" height="100%">
                        <circle class="progress-ring__background" cx="50%" cy="50%" r="40%" stroke-width="10%" />
                        <circle class="progress-ring__fill" :style="{
                          strokeDasharray: `${serviceCircumference} ${serviceCircumference}`,
                          strokeDashoffset: service.strokeDashoffset,
                          stroke: service.ringColor
                        }" cx="50%" cy="50%" r="40%" stroke-width="10%" />
                        <circle class="progress-ring__inner" cx="50%" cy="50%" r="32%" />
                      </svg>
                      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-baseline">
                        <span class="text-lg sm:text-xl font-bold text-gray-800">{{ Math.round(service.score) }}</span>
                        <span class="text-xs sm:text-sm text-gray-600">/100</span>
                      </div>
                    </div>
                    <span class="mt-2 text-xs sm:text-sm text-blue-600 font-medium uppercase">{{ service.name }}</span>
                  </div>
                </div>
              </div>
              <!-- Top 2 Services at Risk -->
              <div class="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
                <h2 class="text-xl sm:text-2xl font-semibold text-gray-800 text-center mb-6">Top 2 Services at Risk by Region</h2>
                <canvas id="topServicesAtRiskBarChart" class="max-w-full h-64"></canvas>
              </div>
              <!-- Assets at Risk by Region -->
              <div class="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
                <h2 class="text-xl sm:text-2xl font-semibold text-gray-800 text-center mb-6">Assets at Risk by Region</h2>
                <canvas id="regionAssetsAtRiskChart" class="max-w-full h-80"></canvas>
              </div>
              <!-- Assets at Risk Trend -->
              <div class="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
                <h2 class="text-xl sm:text-2xl font-semibold text-gray-800 text-center mb-6">Assets at Risk Trend Across Regions</h2>
                <canvas id="assetsAtRiskTrendChart" class="max-w-full h-64"></canvas>
              </div>
              <!-- Assets Breakdown by Region -->
              <div class="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
                <h2 class="text-xl sm:text-2xl font-semibold text-gray-800 text-center mb-6">Assets Breakdown by Region</h2>
                <div class="relative w-48 mx-auto mb-4">
                  <select class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 appearance-none bg-white" @change="updateRegion($event.target.value)" v-model="selectedRegion">
                    <option v-for="region in allRegions" :key="region" :value="region">{{ region }}</option>
                  </select>
                  <span class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600">▼</span>
                </div>
                <canvas id="regionAssetsBreakdownChart" class="max-w-full h-64"></canvas>
              </div>
            </div>
  
            <!-- Recommendation Tab -->
            <div v-else-if="activePanel === 2" class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <!-- Score Analysis -->
              <div class="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow flex flex-col">
                <h2 class="text-xl sm:text-2xl font-semibold text-blue-600 text-center mb-6 relative after:content-[''] after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-12 after:h-1 after:bg-blue-600 after:rounded">
                  Score Analysis
                </h2>
                <div class="flex-1 overflow-y-auto">
                  <p class="text-base text-gray-800 text-center mb-4" v-if="results.securityScore">
                    Your current security score is <strong class="text-blue-600">{{ roundedScore }}/100</strong> ({{ scoreLabel }}).
                  </p>
                  <p class="text-base text-gray-800 text-center mb-4" v-else>Loading score data...</p>
                  <div v-if="results.securityScore" class="space-y-4">
                    <p class="text-sm text-gray-600 text-center">
                      Below is a list of the 10 most common security issues or patterns identified by an analysis across your AWS services.
                    </p>
                    <div class="bg-gray-50 p-4 rounded-md">
                      <div v-for="(item, index) in results.aiScoreAnalysis" :key="index" class="flex items-center p-3 border-b last:border-b-0 hover:bg-blue-50 transition-colors">
                        <span class="font-semibold text-blue-600 mr-2">{{ index + 1 }}.</span>
                        <span class="flex-1 text-gray-800">{{ item.message }}</span>
                        <span class="text-sm text-gray-500">({{ item.count }} time{{ item.count > 1 ? 's' : '' }})</span>
                      </div>
                    </div>
                    <p class="text-sm text-gray-600 text-center">
                      This list highlights recurring themes in your security posture based on detailed scan results.
                    </p>
                  </div>
                </div>
              </div>
              <!-- Steps To Take -->
              <div class="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow flex flex-col">
                <h2 class="text-xl sm:text-2xl font-semibold text-blue-600 text-center mb-6 relative after:content-[''] after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-12 after:h-1 after:bg-blue-600 after:rounded">
                  Steps To Take
                </h2>
                <div class="flex-1 overflow-y-auto">
                  <p class="text-base text-gray-800 text-center mb-4">
                    Based on an analysis of your AWS security check results, here are the top recommended actions to improve your security posture:
                  </p>
                  <div class="bg-gray-50 p-4 rounded-md">
                    <div v-for="(step, index) in results.aiStepsToTake" :key="index" class="flex items-center p-3 border-b last:border-b-0 hover:bg-blue-50 transition-colors">
                      <span class="font-semibold text-blue-600 mr-2">{{ index + 1 }}.</span>
                      <span class="flex-1 text-gray-800">{{ step }}</span>
                    </div>
                    <p v-if="!results.aiStepsToTake || results.aiStepsToTake.length === 0" class="text-center text-gray-500 italic">
                      Loading steps or no steps generated...
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="text-center text-gray-600 text-lg mt-12">
          Loading results...
        </div>
      </main>
  
      <!-- Footer -->
      <footer class="bg-gray-900 text-white py-6 w-full">
        <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p class="text-sm">© 2025 CloudDome. All rights reserved.</p>
        </div>
      </footer>
    </div>
  </template>
  
  <script src="./result_page.js"></script>