<template>
    <div class="flex flex-col min-h-screen font-sans antialiased">
      <header class="w-full h-[90px] bg-gradient-to-r from-brand-blue to-brand-blue-light fixed top-0 left-0 flex flex-col z-10 shadow-custom-lg">
        <div class="px-5 sm:px-10 py-5 flex justify-between items-center">
          <div class="flex flex-row items-center">
            <img src="../../assets/cloud-dome-logo.png" alt="CloudDome Logo" class="h-[50px] mr-2.5 cursor-pointer" @click="goToMainPage">
            <button class="text-white text-2xl sm:text-[30px] font-bold bg-transparent border-none p-0 cursor-pointer hover:text-brand-dropdown-hover" @click="goToMainPage">CloudDome</button>
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
      </header>
      <main class="flex flex-col items-center mt-[90px] px-5 flex-grow bg-brand-bg">
        <div class="flex w-full gap-5" v-if="results.securityScore">
          <div class="w-[250px] h-[800px] bg-white p-5 shadow-custom rounded-lg transition-all duration-300">
            <h2 class="text-xl sm:text-[22px] font-semibold text-gray-900 mb-6 pb-2.5 border-b border-brand-light-gray text-left">Reports</h2>
            <ul class="list-none p-0 m-0">
              <li v-for="(item, index) in panelItems" :key="index" class="p-3 text-base text-gray-600 cursor-pointer flex items-center rounded-lg mb-2 transition-all duration-300 relative overflow-hidden hover:bg-gray-100 hover:text-brand-blue" :class="{ 'text-brand-blue font-semibold bg-blue-100': activePanel === index }" @click="setActivePanel(index)" :title="item.label">
                <span class="block w-1 h-full bg-brand-blue mr-3 absolute left-0 top-0 opacity-20 transition-all duration-300 transform scale-y-75" :class="{ 'opacity-100 scale-y-100': activePanel === index }"></span>
                <i class="panel-icon" :class="item.icon"></i>
                {{ item.label }}
              </li>
            </ul>
          </div>
          <div class="flex gap-5 w-full">
            <div class="bg-transparent p-0 shadow-none w-[550px]">
              <div class="bg-white rounded-lg p-5 shadow-custom h-[845px] transition-all duration-300 relative overflow-hidden overflow-y-auto hover:-translate-y-1 hover:shadow-custom-xl" v-if="activePanel === 0">
                <h2 class="text-xl sm:text-[22px] font-semibold text-gray-900 uppercase mb-5 text-center tracking-wide">Your Security Score</h2>
                <div class="relative py-5 bg-gradient-to-br from-gray-100 to-blue-50 rounded-lg my-5">
                  <div class="relative w-[220px] h-[220px] mx-auto">
                    <svg class="progress-ring" width="220" height="220">
                      <circle class="progress-ring__background" cx="110" cy="110" r="95" />
                      <circle class="progress-ring__fill" :style="{ strokeDasharray: `${circumference} ${circumference}`, strokeDashoffset: strokeDashoffset, stroke: ringColor }" cx="110" cy="110" r="95" />
                      <circle class="progress-ring__inner" cx="110" cy="110" r="75" />
                    </svg>
                    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-baseline gap-1">
                      <div class="text-5xl sm:text-[56px] font-bold text-gray-900 leading-none transition-colors duration-300">{{ animatedScore }}</div>
                      <div class="text-lg sm:text-[20px] font-medium text-gray-600">/100</div>
                    </div>
                    <div class="absolute -bottom-7.5 left-1/2 -translate-x-1/2 text-lg sm:text-[20px] font-semibold uppercase tracking-wide px-3.5 py-1.5 bg-white/90 rounded-full shadow-sm transition-all duration-300" :style="{ color: ringColor }">{{ scoreLabel }}</div>
                  </div>
                </div>
                <div class="p-5 bg-white rounded-lg mt-10">
                  <p class="text-sm sm:text-[15px] text-gray-600 text-center mb-5 leading-relaxed">
                    This score reflects the overall security posture of your AWS assets based on our comprehensive scan.
                  </p>
                  <div class="text-left">
                    <h3 class="text-base sm:text-[16px] text-brand-blue my-3.5 font-semibold">What Does This Score Mean?</h3>
                    <p class="text-sm sm:text-[14px] text-gray-600 mb-3.5 leading-relaxed">
                      Your security score is a comprehensive metric that evaluates the security posture of your AWS environment. It takes into account various factors such as the configuration of your resources, the presence of security best practices, and the results of automated security checks. A higher score indicates a stronger security posture, while a lower score suggests areas that need improvement. The score is designed to give you a quick overview of your security status, helping you prioritize actions to enhance your cloud security.
                    </p>
                    <h3 class="text-base sm:text-[16px] text-brand-blue my-3.5 font-semibold">How Is It Calculated?</h3>
                    <p class="text-sm sm:text-[14px] text-gray-600 mb-3.5 leading-relaxed">
                      The score is calculated by running a series of security checks across your AWS services. Each check is weighted based on its importance, and the final score is the percentage of checks that passed successfully. The checks cover a wide range of security aspects, including but not limited to: encryption, access control, logging, and monitoring. The weighting ensures that critical security issues have a greater impact on the score, encouraging you to address the most significant risks first.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div class="flex flex-col bg-transparent p-0 shadow-none w-[550px]">
              <div class="bg-white rounded-lg p-6 shadow-custom transition-transform duration-300 hover:-translate-y-1">
                <h2 class="text-xl sm:text-[22px] font-semibold text-gray-900 uppercase mb-5 text-center tracking-wide">Assets Breakdown</h2>
                <div class="flex flex-col items-center gap-6">
                  <div class="text-center p-3.5 bg-gradient-to-br from-gray-100 to-blue-50 rounded-lg w-[200px]">
                    <div class="text-4xl sm:text-[48px] font-bold text-brand-blue leading-none mb-2">{{ animatedTotalAssets }}</div>
                    <div class="text-sm sm:text-[14px] text-gray-600 font-medium">Total Assets Checked</div>
                  </div>
                  <div class="w-full flex flex-col gap-5">
                    <div class="flex justify-center gap-7.5">
                      <div class="flex flex-col items-center p-3.5 rounded-lg min-w-[120px] bg-green-100/50 transition-all duration-300 hover:scale-105">
                        <span class="text-2xl mb-2">🛡️</span>
                        <span class="text-2xl sm:text-[28px] font-semibold mb-1 text-brand-green">{{ animatedSafeAssets }}</span>
                        <span class="text-sm sm:text-[14px] text-gray-600">Safe</span>
                      </div>
                      <div class="flex flex-col items-center p-3.5 rounded-lg min-w-[120px] bg-red-100/50 transition-all duration-300 hover:scale-105">
                        <span class="text-2xl mb-2">⚠️</span>
                        <span class="text-2xl sm:text-[28px] font-semibold mb-1 text-brand-red">{{ animatedAtRiskAssets }}</span>
                        <span class="text-sm sm:text-[14px] text-gray-600">At Risk</span>
                      </div>
                    </div>
                    <div class="w-full">
                      <div class="relative w-full h-3 bg-brand-light-gray rounded-lg overflow-hidden mb-2.5">
                        <div class="absolute left-0 top-0 h-full bg-gradient-to-r from-brand-green to-green-400 transition-all duration-1000" :style="{ width: safeBarWidth + '%' }"></div>
                        <div class="absolute right-0 top-0 h-full bg-gradient-to-r from-brand-red to-red-400 transition-all duration-1000" :style="{ width: atRiskBarWidth + '%' }"></div>
                      </div>
                      <div class="flex justify-between text-xs text-gray-600">
                        <span class="flex items-center gap-1 text-brand-green">
                          <span class="w-2 h-2 rounded-full bg-brand-green"></span>Safe {{ Math.round(safePercentage) }}%
                        </span>
                        <span class="flex items-center gap-1 text-brand-red">
                          <span class="w-2 h-2 rounded-full bg-brand-red"></span>At Risk {{ Math.round(atRiskPercentage) }}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="bg-white rounded-lg p-6 shadow-custom flex-1 mt-5 max-h-[385px] transition-transform duration-300 hover:-translate-y-1">
                <h2 class="text-xl sm:text-[22px] font-semibold text-gray-900 uppercase mb-5 text-center tracking-wide">MOST VULNERABLE SERVICES</h2>
                <div class="max-h-[330px] overflow-y-auto">
                  <div v-for="(service, index) in sortedServices" :key="service.name" class="flex flex-col bg-gray-50 p-2.5 rounded mb-2.5 w-full">
                    <div class="flex justify-between items-center w-full">
                      <span class="font-bold text-gray-700">{{ service.name }}</span>
                      <span class="text-brand-red font-bold">{{ service.assetsAtRisk }} assets</span>
                    </div>
                    <div class="relative w-full h-2.5 bg-brand-light-gray mt-1.5 rounded-sm">
                      <div class="absolute left-0 top-0 h-full bg-brand-blue rounded-sm" :style="{ width: serviceBarWidths[index] + '%' }"></div>
                    </div>
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
      <footer class="bg-brand-dark py-5 w-full -ml-2.5 -mb-2.5 z-10">
        <div class="flex justify-center text-center">
          <p class="text-sm text-white">© 2025 CloudDome. All rights reserved.</p>
        </div>
      </footer>
    </div>
  </template>
  
  <script src="./result_page.js"></script>