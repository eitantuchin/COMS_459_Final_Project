import Chart from 'chart.js/auto';

export default {
    name: 'ResultPage',
    data() {
        return {
            isMobile: window.innerWidth <= 768,
            isDropdownOpen: false,
            currentProgress: 0,
            safeBarWidth: 0,
            atRiskBarWidth: 0,
            serviceBarWidths: [],
            results: {},
            isLoaded: false,
            activePanel: 0,
            animatedScore: 0, // New data property for animated score
            animatedTotalAssets: 0, // New data property for animated total assets
            animatedSafeAssets: 0, // New data property for animated safe assets
            animatedAtRiskAssets: 0, // New data property for animated at-risk assets
            panelItems: [
                { label: 'Overview', content: 'overview', icon: 'fas fa-home' },
                { label: 'Charts', content: 'charts', icon: 'fas fa-chart-bar' },
                { label: 'Recommendation', content: 'analysis', icon: 'fas fa-search' }
            ],
            regionAssetsAtRiskChart: null,
            topServicesAtRiskBarChart: null,
            assetsAtRiskTrendChart: null,
            regionAssetsBreakdownChart: null,
            selectedRegion: null,
        };
    }, 
    computed: {
        roundedScore() {
            return Math.round(this.results.securityScore || 0);
        },
        circumference() {
            return 2 * Math.PI * 95;
        },
        strokeDashoffset() {
            const progress = this.currentProgress / 100;
            return this.circumference * (1 - progress);
        },
        ringColor() {
            const score = this.roundedScore;
            if (score <= 20) return '#d32f2f';
            if (score <= 40) return '#f57c00';
            if (score <= 60) return '#ffca28';
            if (score <= 80) return '#388e3c';
            return '#2e7d32';
        },
        scoreLabel() {
            const score = this.roundedScore;
            if (score <= 20) return 'Critical';
            if (score <= 40) return 'Below Standard';
            if (score <= 60) return 'Average';
            if (score <= 80) return 'Good';
            return 'Very Good';
        },
        safePercentage() {
            const total = this.results.totalAssets || 0;
            const atRisk = this.results.totalAssetsAtRisk || 0;
            return total > 0 ? ((total - atRisk) / total) * 100 : 0;
        },
        atRiskPercentage() {
            const total = this.results.totalAssets || 0;
            const atRisk = this.results.totalAssetsAtRisk || 0;
            return total > 0 ? (atRisk / total) * 100 : 0;
        },
        sortedServices() {
            const services = Object.keys(this.results.services || {}).map(name => ({
                name: name.toUpperCase(),
                assetsAtRisk: this.results.services[name].assetsAtRisk || 0
            }));
            return services.sort((a, b) => b.assetsAtRisk - a.assetsAtRisk);
        },
        serviceTargetPercentages() {
            const totalAtRisk = this.results.totalAssetsAtRisk || 0;
            return this.sortedServices.map(service =>
                totalAtRisk > 0 ? (service.assetsAtRisk / totalAtRisk) * 100 : 0
            );
        },
        serviceScores() {
            return Object.keys(this.results.services || {}).map(name => {
                const service = this.results.services[name];
                const score = service.totalChecks > 0 ? (service.totalPassed / service.totalChecks) * 100 : 0;
                const circumference = 2 * Math.PI * 40; // Smaller radius for service rings
                const progress = score / 100;
                const strokeDashoffset = circumference * (1 - progress);
                const ringColor = this.getRingColor(score);
                return {
                    name: name.toUpperCase(),
                    score,
                    strokeDashoffset,
                    ringColor
                };
            });
        },
        serviceCircumference() {
            return 2 * Math.PI * 40;
        },
        allRegions() {
            const services = this.results.services || {};
            return [...new Set(Object.values(services).flatMap(s => Object.keys(s.regionStats || {})))];
        },
    },
    methods: {
        showDropdown() {
            this.isDropdownOpen = true;
        },
        hideDropdown() {
            this.isDropdownOpen = false;
        },
        goToMainPage() {
            this.$router.push({ path: '/' });
        },
        // Easing function for deceleration (ease-out)
        easeOutQuad(t) {
            return t * (2 - t); // Quadratic ease-out
        },

        // Add this method:
        animateAll() {
            const targetScore = this.results.securityScore || 0;
            const totalAssets = this.results.totalAssets || 0;
            const atRiskAssets = this.results.totalAssetsAtRisk || 0;
            const safeAssets = totalAssets - atRiskAssets;
            const targetSafe = this.safePercentage;
            const targetAtRisk = this.atRiskPercentage;
            const serviceTargets = this.serviceTargetPercentages;

            let startTime = null;
            const step = (timestamp) => {
                if (!startTime) startTime = timestamp;
                const progress = Math.min((timestamp - startTime) / 1500, 1);
                const easedProgress = this.easeOutQuad(progress);

                // Update all values simultaneously
                this.animatedScore = Math.round(targetScore * easedProgress);
                this.currentProgress = targetScore * easedProgress;

                this.animatedTotalAssets = Math.round(totalAssets * easedProgress);
                this.animatedSafeAssets = Math.round(safeAssets * easedProgress);
                this.animatedAtRiskAssets = Math.round(atRiskAssets * easedProgress);

                this.safeBarWidth = targetSafe * easedProgress;
                this.atRiskBarWidth = targetAtRisk * easedProgress;

                this.serviceBarWidths = serviceTargets.map(target => target * easedProgress);

                if (progress < 1) {
                    requestAnimationFrame(step);
                }
            };
            requestAnimationFrame(step);
        },
        getRingColor(score) {
            if (score <= 20) return '#d32f2f';
            if (score <= 40) return '#f57c00';
            if (score <= 60) return '#ffca28';
            if (score <= 80) return '#388e3c';
            return '#2e7d32';
        },
        initRegionAssetsAtRiskChart() {
            const canvas = document.getElementById('regionAssetsAtRiskChart');
            if (!canvas) {
                console.warn('Canvas #regionAssetsAtRiskChart not found. Ensure the Charts tab is active.');
                return; // Exit if canvas isn’t in the DOM
            }
            const ctx = canvas.getContext('2d');
            const regionStats = this.results.regionStats || {};
            const regions = Object.keys(regionStats);
            const assetsAtRisk = regions.map(region => regionStats[region].assetsAtRisk);

            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: regions,
                    datasets: [{
                        label: 'Assets at Risk',
                        data: assetsAtRisk,
                        backgroundColor: 'rgba(0, 110, 220, 1)',
                        borderColor: 'rgb(40, 10, 234)',
                        borderWidth: 3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true, title: { display: true, text: 'Number of Assets at Risk' } },
                        x: { title: { display: true, text: 'Region' } }
                    },
                    plugins: {
                        legend: { display: true, position: 'top' },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return `${context.dataset.label}: ${context.raw}`;
                                }
                            }
                        }
                    }
                }
            });
        },
        initTopServicesAtRiskBarChart() {
            const canvas = document.getElementById('topServicesAtRiskBarChart');
            if (!canvas) {
                console.warn('Canvas #topServicesAtRiskBarChart not found.');
                return;
            }
            const ctx = canvas.getContext('2d');
            const services = this.results.services || {};
            const allRegions = [...new Set(Object.values(services).flatMap(s => Object.keys(s.regionStats || {})))];

            // Prepare data for top 2 services per region
            const topServiceData = [];
            const secondServiceData = [];
            const topServiceLabels = [];
            const secondServiceLabels = [];

            allRegions.forEach(region => {
                const serviceRisks = Object.entries(services)
                    .map(([serviceName, service]) => {
                        const regionStats = service.regionStats?.[region] || { assetsAtRisk: 0 };
                        return { serviceName, assetsAtRisk: regionStats.assetsAtRisk || 0 };
                    })
                    .filter(s => s.assetsAtRisk > 0)
                    .sort((a, b) => b.assetsAtRisk - a.assetsAtRisk)
                    .slice(0, 2);

                // Top service
                topServiceData.push(serviceRisks[0]?.assetsAtRisk || 0);
                topServiceLabels.push(serviceRisks[0]?.serviceName.toUpperCase() || 'None');

                // Second service (or 0 if none)
                secondServiceData.push(serviceRisks[1]?.assetsAtRisk || 0);
                secondServiceLabels.push(serviceRisks[1]?.serviceName.toUpperCase() || 'None');
            });

            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: allRegions,
                    datasets: [
                        {
                            label: 'Top Service',
                            data: topServiceData,
                            backgroundColor: 'rgba(255, 99, 132, 0.6)', // Red for top service
                            borderColor: 'rgba(255, 99, 132, 1)',
                            borderWidth: 1
                        },
                        {
                            label: 'Second Service',
                            data: secondServiceData,
                            backgroundColor: 'rgba(54, 162, 235, 0.6)', // Blue for second service
                            borderColor: 'rgba(54, 162, 235, 1)',
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { title: { display: true, text: 'Region' } },
                        y: { beginAtZero: true, title: { display: true, text: 'Number of Assets at Risk' } }
                    },
                    plugins: {
                        legend: { position: 'top' },
                        tooltip: {
                            callbacks: {
                                label: context => {
                                    const service = context.datasetIndex === 0 
                                        ? topServiceLabels[context.dataIndex] 
                                        : secondServiceLabels[context.dataIndex];
                                    return `${context.dataset.label} (${service}): ${context.raw} assets at risk`;
                                }
                            }
                        }
                    }
                }
            });
        },

        async fetchResults() {
            const scanId = this.$route.query.scanId;
            if (!scanId) {
                this.$router.push({ path: '/' });
                return;
            }
            try {
                const response = await fetch(`http://localhost:3000/api/get-security-results/${scanId}`);
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to fetch scan results');
                }
                this.results = data;
                this.$nextTick(() => {
                    this.isLoaded = true;
                    this.animateAll();
                    if (this.activePanel === 1) {
                        this.initRegionAssetsAtRiskChart();
                        this.initTopServicesAtRiskBarChart();
                        this.initAssetsAtRiskTrendChart();
                    }
                });
            } catch (error) {
                console.error('Error fetching scan results:', error);
                this.$router.push({ path: '/' });
            }
        },
        initAssetsAtRiskTrendChart() {
            const canvas = document.getElementById('assetsAtRiskTrendChart');
            if (!canvas) {
                console.warn('Canvas #assetsAtRiskTrendChart not found.');
                return;
            }
            const ctx = canvas.getContext('2d');
            const services = this.results.services || {};
            const allRegions = [...new Set(Object.values(services).flatMap(s => Object.keys(s.regionStats || {})))];
        
            const datasets = Object.entries(services).map(([serviceName], index) => {
                const data = allRegions.map(region => {
                    const regionStats = services[serviceName].regionStats?.[region] || {};
                    return regionStats.assetsAtRisk || 0;
                });
                return {
                    label: serviceName.toUpperCase(),
                    data,
                    borderColor: `hsl(${(index * 137.508) % 360}, 70%, 50%)`,
                    fill: false,
                    tension: 0.1
                };
            });
        
            if (this.assetsAtRiskTrendChart) {
                this.assetsAtRiskTrendChart.destroy();
            }
        
            this.assetsAtRiskTrendChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: allRegions,
                    datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { title: { display: true, text: 'Region' } },
                        y: { beginAtZero: true, title: { display: true, text: 'Assets at Risk' } }
                    },
                    plugins: {
                        legend: { position: 'top' },
                        tooltip: {
                            callbacks: {
                                label: context => `${context.dataset.label}: ${context.raw} assets at risk`
                            }
                        }
                    }
                }
            });
        },
        initRegionAssetsBreakdownChart() {
            const canvas = document.getElementById('regionAssetsBreakdownChart');
            if (!canvas) {
                console.warn('Canvas #regionAssetsBreakdownChart not found.');
                return;
            }
            const ctx = canvas.getContext('2d');
            const services = this.results.services || {};
            const allRegions = [...new Set(Object.values(services).flatMap(s => Object.keys(s.regionStats || {})))];

            // Default to first region if not set
            if (!this.selectedRegion) {
                this.selectedRegion = allRegions[0];
            }

            let totalAssets = 0;
            let assetsAtRisk = 0;
            Object.values(services).forEach(service => {
                const regionStats = service.regionStats?.[this.selectedRegion] || {};
                totalAssets += regionStats.totalAssets || 0;
                assetsAtRisk += regionStats.assetsAtRisk || 0;
            });
            const safeAssets = totalAssets - assetsAtRisk;

            if (this.regionAssetsBreakdownChart) {
                this.regionAssetsBreakdownChart.destroy();
            }

            this.regionAssetsBreakdownChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['At Risk', 'Safe'],
                    datasets: [{
                        data: [assetsAtRisk, safeAssets],
                        backgroundColor: ['#FF6384', '#36A2EB'],
                        borderColor: '#fff',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'top' },
                        title: { display: true, text: `Assets in ${this.selectedRegion}` },
                        tooltip: {
                            callbacks: {
                                label: context => `${context.label}: ${context.raw} (${((context.raw / totalAssets) * 100).toFixed(1)}%)`
                            }
                        }
                    }
                }
            });
        },
        updateRegion(region) {
            this.selectedRegion = region;
            this.initRegionAssetsBreakdownChart();
        },

        setActivePanel(index) {
            this.activePanel = index;
            if (index === 1) {
                this.$nextTick(() => {
                    this.initRegionAssetsAtRiskChart();
                    this.initTopServicesAtRiskBarChart();
                    this.initAssetsAtRiskTrendChart();
                    this.initRegionAssetsBreakdownChart(); // Add for Card 5
                });
            }
        },
        handleResize() {
            this.isMobile = window.innerWidth <= 768;
        },
    },
    mounted() {
        this.fetchResults();
        window.addEventListener('resize', this.handleResize);
    },
    beforeDestroy() {
        window.removeEventListener('resize', this.handleResize);
    }
};