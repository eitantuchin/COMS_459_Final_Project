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
                                :class="{ 'active': activePanel === index }" @click="setActivePanel(index)"
                                :title="item.label">
                                <span class="tab-marker"></span>
                                <i class="panel-icon" :class="item.icon"></i>
                                {{ item.label }}
                            </li>
                        </ul>
                    </div>
                    <!-- Columns Container -->
                    <div class="columns-container">
                        <!-- Overview Tab Content -->
                        <div v-if="activePanel === 0" class="overview-content">
                            <!-- First Column: Security Score -->
                            <div class="left-column">
                                <div class="section-card score">
                                    <h2 class="column-title">Your Security Score</h2>
                                    <div class="score-wrapper">
                                        <div class="score-container">
                                            <svg class="progress-ring" width="220" height="220">
                                                <circle class="progress-ring__background" cx="110" cy="110" r="95" />
                                                <circle class="progress-ring__fill" :style="{
                                                    strokeDasharray: `${circumference} ${circumference}`,
                                                    strokeDashoffset: strokeDashoffset,
                                                    stroke: ringColor
                                                }" cx="110" cy="110" r="95" />
                                                <circle class="progress-ring__inner" cx="110" cy="110" r="75" />
                                            </svg>
                                            <div class="score-content">
                                                <div class="score-text">{{ animatedScore }}</div>
                                                <div class="score-max">/100</div>
                                            </div>
                                            <div class="score-label" :style="{ color: ringColor }">{{ scoreLabel }}
                                            </div>
                                        </div>
                                    </div>
                                    <div class="score-details">
                                        <p class="score-description">
                                            This score reflects the overall security posture of your AWS assets based on
                                            our
                                            comprehensive scan.
                                        </p>
                                        <div class="score-info">
                                            <h3>What Does This Score Mean?</h3>
                                            <p>
                                                Your security score is a comprehensive metric that evaluates the
                                                security posture
                                                of your AWS environment. It takes into account various factors such as
                                                the
                                                configuration of your resources, the presence of security best
                                                practices, and
                                                the results of automated security checks. A higher score indicates a
                                                stronger
                                                security posture, while a lower score suggests areas that need
                                                improvement. The
                                                score is designed to give you a quick overview of your security status,
                                                helping
                                                you prioritize actions to enhance your cloud security.
                                            </p>
                                            <h3>How Is It Calculated?</h3>
                                            <p>The score is calculated by running a series of security checks across
                                                your AWS
                                                services. Each check is weighted based on its importance, and the final
                                                score is
                                                the percentage of checks that passed successfully. The checks cover a
                                                wide range
                                                of security aspects, including but not limited to: encryption, access
                                                control,
                                                logging, and monitoring. The weighting ensures that critical security
                                                issues
                                                have a greater impact on the score, encouraging you to address the most
                                                significant risks first.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <!-- Second Column: Assets Overview & Vulnerable Services -->
                            <div class="right-column">
                                <div class="section-card assets-overview">
                                    <h2 class="section-title">Assets Breakdown</h2>
                                    <div class="assets-container">
                                        <div class="assets-total-wrapper">
                                            <div class="assets-total">{{ animatedTotalAssets }}</div>
                                            <div class="assets-label">Total Assets Checked</div>
                                        </div>
                                        <div class="assets-breakdown">
                                            <div class="assets-stats">
                                                <div class="stat-item safe">
                                                    <span class="stat-icon">🛡️</span>
                                                    <span class="stat-value">{{ animatedSafeAssets }}</span>
                                                    <span class="stat-label">Safe</span>
                                                </div>
                                                <div class="stat-item at-risk">
                                                    <span class="stat-icon">⚠️</span>
                                                    <span class="stat-value">{{ animatedAtRiskAssets }}</span>
                                                    <span class="stat-label">At Risk</span>
                                                </div>
                                            </div>
                                            <div class="assets-progress">
                                                <div class="progress-bar">
                                                    <div class="progress-safe" :style="{ width: safeBarWidth + '%' }">
                                                    </div>
                                                    <div class="progress-at-risk"
                                                        :style="{ width: atRiskBarWidth + '%' }">
                                                    </div>
                                                </div>
                                                <div class="progress-legend">
                                                    <span class="legend-item safe">
                                                        <span class="legend-dot"></span>Safe {{
                                                        Math.round(safePercentage) }}%
                                                    </span>
                                                    <span class="legend-item at-risk">
                                                        <span class="legend-dot"></span>At Risk {{
                                                        Math.round(atRiskPercentage) }}%
                                                    </span>
                                                </div>
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
                                                <span class="service-risk">{{ service.assetsAtRisk }} assets</span>
                                            </div>
                                            <div class="service-bar-container">
                                                <div class="service-bar"
                                                    :style="{ width: serviceBarWidths[index] + '%' }">
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <!-- Charts Tab Content -->
                        <div v-else-if="activePanel === 1" class="charts-content">
                            <div class="charts-grid">
                                <!-- Card 1: Service Security Scores -->
                                <div class="section-card chart-card">
                                    <h2 class="section-title">Service Security Scores</h2>
                                    <div class="service-scores-container">
                                        <div v-for="service in serviceScores" :key="service.name" class="service-score">
                                            <div class="score-container small">
                                                <svg class="progress-ring" width="100" height="100">
                                                    <circle class="progress-ring__background" cx="50" cy="50" r="40" />
                                                    <circle class="progress-ring__fill" :style="{
                                                        strokeDasharray: `${serviceCircumference} ${serviceCircumference}`,
                                                        strokeDashoffset: service.strokeDashoffset,
                                                        stroke: service.ringColor
                                                    }" cx="50" cy="50" r="40" />
                                                    <circle class="progress-ring__inner" cx="50" cy="50" r="32" />
                                                </svg>
                                                <div class="score-content">
                                                    <div class="score-text small">{{ Math.round(service.score) }}</div>
                                                    <div class="score-max small">/100</div>
                                                </div>
                                            </div>
                                            <div class="service-label">{{ service.name }}</div>
                                        </div>
                                    </div>
                                </div>
                                <!-- Card 2: Placeholder -->
                                <div class="section-card chart-card">
                                    <h2 class="section-title">Top 2 Services at Risk by Region</h2>
                                    <canvas id="topServicesAtRiskBarChart" width="400" height="300"></canvas>
                                </div>
                                <!-- Card 3: Bar Chart - Assets at Risk per Region -->
                                <div class="section-card chart-card">
                                    <h2 class="section-title">Assets at Risk by Region</h2>
                                    <canvas id="regionAssetsAtRiskChart" width="400" height="400"></canvas>
                                </div>
                                <div class="section-card chart-card">
                                    <h2 class="section-title">Assets at Risk Trend Across Regions</h2>
                                    <canvas id="assetsAtRiskTrendChart" width="400" height="300"></canvas>
                                </div>
                                <div class="section-card chart-card">
                                    <h2 class="section-title">Assets Breakdown by Region</h2>
                                    <div class="dropdown-container">
                                        <select class="custom-dropdown" @change="updateRegion($event.target.value)"
                                            v-model="selectedRegion">
                                            <option v-for="region in allRegions" :key="region" :value="region">{{ region
                                                }}</option>
                                        </select>
                                    </div>
                                    <canvas id="regionAssetsBreakdownChart" width="400" height="300"></canvas>
                                </div>
                            </div>
                        </div>
                        <!-- Recommendation Tab Content -->
                        <div v-else-if="activePanel === 2" class="recommendation-content">
                            <div class="recommendation-grid">
                                <!-- Score Analysis Card -->
                                <div class="section-card recommendation-card">
                                    <h2 class="section-title">Score Analysis</h2>
                                    <div class="score-analysis-content">
                                        <p class="intro-text" v-if="results.securityScore">
                                            Your current security score is <strong>{{ roundedScore }}/100</strong> ({{
                                            scoreLabel }}).
                                        </p>
                                        <p class="intro-text" v-else>Loading score data...</p>
                                        <div v-if="results.securityScore" class="analysis-details">
                                            <p class="description">
                                                Below is a list of the 10 most common security issues or patterns
                                                identified by an analysis across your AWS services. Specific identifiers
                                                (e.g., resource names, regions) have been excluded for clarity.
                                            </p>
                                            <div class="analysis-list-wrapper">
                                                <div v-for="(item, index) in results.aiScoreAnalysis" :key="index"
                                                    class="analysis-item">
                                                    <span class="item-number">{{ index + 1 }}.</span>
                                                    <span class="item-text">{{ item.message }}</span>
                                                    <span class="item-count">({{ item.count }} time{{ item.count > 1 ?
                                                        's' : '' }})</span>
                                                </div>
                                            </div>
                                            <p class="footer-text">
                                                This list highlights recurring themes in your security
                                                posture based on detailed scan results. Use it to prioritize remediation
                                                efforts.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <!-- Steps To Take Card -->
                                <div class="section-card recommendation-card">
                                    <h2 class="section-title">Steps To Take</h2>
                                    <div class="steps-content">
                                        <p class="intro-text">
                                            Based on an analysis of your AWS security check results, here are the top
                                            recommended actions to improve your security posture:
                                        </p>
                                        <div class="steps-list-wrapper">
                                            <div v-for="(step, index) in results.aiStepsToTake" :key="index"
                                                class="step-item">
                                                <span class="step-number">{{ index + 1 }}.</span>
                                                <span class="step-text">{{ step }}</span>
                                                <div class="step-action">
                                                    <button v-if="!fixStatus[index]" class="fix-button"
                                                        @click="applyFix(index, step)">
                                                        Apply Fix
                                                    </button>
                                                    <span v-else class="fix-done">
                                                        Fix Done <i class="fas fa-check-circle"></i>
                                                    </span>
                                                </div>
                                            </div>
                                            <p v-if="!results.aiStepsToTake || results.aiStepsToTake.length === 0"
                                                class="no-steps">
                                                Loading steps or no steps generated...
                                            </p>
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