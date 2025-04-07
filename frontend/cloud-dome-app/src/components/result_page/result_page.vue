<template>
    <div class="main-container">
        <header class="header">
            <div class="top-nav">
                <div class="top-left-nav">
                    <img src="../../assets/cloud-dome-logo.png" alt="CloudDome Logo" class="icon-image"
                        @click="goToMainPage">
                    <button class="logo" @click="goToMainPage">CloudDome</button>
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
        </header>
        <main class="main-content">
            <div class="dashboard" v-if="results.securityScore">
                <div class="content-wrapper">
                    <!-- Left Panel -->
                    <div class="panel">
                        <h2 class="panel-title">Reports</h2>
                        <ul class="panel-list">
                            <li v-for="(item, index) in panelItems" :key="index" class="panel-item"
                                :class="{ 'active': activePanel === index }" @click="setActivePanel(index)">
                                <span class="tab-marker"></span>
                                {{ item.label }}
                            </li>
                        </ul>
                    </div>
                    <!-- Columns Container -->
                    <div class="columns-container">
                        <!-- First Column: Security Score -->
                        <div class="left-column">
                            <div class="section-card score">
                                <h2 class="column-title">YOUR SECURITY SCORE</h2>
                                <div class="score-container">
                                    <svg class="progress-ring" width="200" height="200">
                                        <circle class="progress-ring__background" cx="100" cy="100" r="90" />
                                        <circle class="progress-ring__fill" :style="{
                                            strokeDasharray: `${circumference} ${circumference}`,
                                            strokeDashoffset: strokeDashoffset,
                                            stroke: ringColor
                                        }" cx="100" cy="100" r="90" />
                                    </svg>
                                    <div class="score-text">{{ roundedScore }}</div>
                                </div>
                                <p class="score-label">{{ scoreLabel }}</p>
                                <p class="score-description">
                                    This score reflects the overall security of your AWS assets based on our
                                    comprehensive scan.
                                </p>
                                <div class="score-details">
                                    <h3>What Does This Score Mean?</h3>
                                    <p>Your security score is a comprehensive metric that evaluates the security posture
                                        of your AWS environment. It takes into account various factors such as the
                                        configuration of your resources, the presence of security best practices, and
                                        the results of automated security checks. A higher score indicates a stronger
                                        security posture, while a lower score suggests areas that need improvement. The
                                        score is designed to give you a quick overview of your security status, helping
                                        you prioritize actions to enhance your cloud security.</p>
                                    <h3>How Is the Score Calculated?</h3>
                                    <p>The score is calculated by running a series of security checks across your AWS
                                        services. Each check is weighted based on its importance, and the final score is
                                        the percentage of checks that passed successfully. The checks cover a wide range
                                        of security aspects, including but not limited to: encryption, access control,
                                        logging, and monitoring. The weighting ensures that critical security issues
                                        have a greater impact on the score, encouraging you to address the most
                                        significant risks first.</p>
                                </div>
                            </div>
                        </div>
                        <!-- Second Column: Assets Overview & Vulnerable Services -->
                        <div class="right-column">
                            <div class="section-card assets-overview">
                                <h2 class="section-title">ASSETS BREAKDOWN</h2>
                                <div class="assets-container">
                                    <div class="assets-total-wrapper">
                                        <div class="assets-total">{{ results.totalAssets }}</div>
                                        <div class="assets-label">Total Assets Checked</div>
                                    </div>
                                    <div class="assets-info">
                                        <div class="assets-details">
                                            <span class="assets-safe"><span class="icon">🛡️</span> {{
                                                results.totalAssets - results.totalAssetsAtRisk }} Safe</span>
                                            <span class="assets-at-risk"><span class="icon">⚠️</span> {{
                                                results.totalAssetsAtRisk }} At Risk</span>
                                        </div>
                                        <div class="assets-bar">
                                            <div class="safe-bar" :style="{ width: safeBarWidth + '%' }"></div>
                                            <div class="at-risk-bar" :style="{ width: atRiskBarWidth + '%' }"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="section-card vulnerable-services">
                                <h2 class="section-title">MOST VULNERABLE SERVICES</h2>
                                <div class="services-list">
                                    <div v-for="(service, index) in sortedServices" :key="service.name"
                                        class="service-item">
                                        <div class="service-header">
                                            <span class="service-name">{{ service.name }}</span>
                                            <span class="service-risk">{{ service.assetsAtRisk }}
                                                assets</span>
                                        </div>
                                        <div class="service-bar-container">
                                            <div class="service-bar" :style="{ width: serviceBarWidths[index] + '%' }">
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div v-else>
                <p>Loading results...</p>
            </div>
        </main>
        <footer class="footer">
            <div class="footer-copyright">
                <p>© 2025 CloudDome. All rights reserved.</p>
            </div>
        </footer>
    </div>
</template>

<script src="./result_page.js"></script>
<style scoped src="./result_page.css"></style>