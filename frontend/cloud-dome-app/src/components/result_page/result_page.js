export default {
    name: 'ResultPage',
    data() {
        return {
            isDropdownOpen: false,
            currentProgress: 0,
            safeBarWidth: 0,
            atRiskBarWidth: 0,
            serviceBarWidths: [], // Array to store animated widths for each service
            results: {},
            isLoaded: false,
            activePanel: 0,
            panelItems: [
                { label: 'Overview', content: 'overview' },
                { label: 'Charts', content: 'charts' },
                { label: 'Score Analysis', content: 'analysis' }
            ]
        };
    },
    computed: {
        roundedScore() {
            return Math.round(this.results.securityScore || 0);
        },
        circumference() {
            return 2 * Math.PI * 90;
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
        }
    },
    methods: {
        setActivePanel(index) {
            this.activePanel = index;
            this.currentView = this.panelItems[index].content;
            // Add logic here to switch content based on selection
        },
        showDropdown() {
            this.isDropdownOpen = true;
        },
        hideDropdown() {
            this.isDropdownOpen = false;
        },
        goToMainPage() {
            this.$router.push({ path: '/' });
        },
        animateScore() {
            const targetScore = this.results.securityScore || 0;
            let current = 0;
            const increment = targetScore / 50;
            const animate = () => {
                if (current < targetScore) {
                    current += increment;
                    if (current > targetScore) current = targetScore;
                    this.currentProgress = current;
                    requestAnimationFrame(animate);
                }
            };
            requestAnimationFrame(animate);
        },
        animateAssetsBar() {
            const targetSafe = this.safePercentage;
            const targetAtRisk = this.atRiskPercentage;
            let currentSafe = 0;
            let currentAtRisk = 0;
            const incrementSafe = targetSafe / 50;
            const incrementAtRisk = targetAtRisk / 50;

            const animate = () => {
                if (currentSafe < targetSafe || currentAtRisk < targetAtRisk) {
                    if (currentSafe < targetSafe) {
                        currentSafe += incrementSafe;
                        if (currentSafe > targetSafe) currentSafe = targetSafe;
                        this.safeBarWidth = currentSafe;
                    }
                    if (currentAtRisk < targetAtRisk) {
                        currentAtRisk += incrementAtRisk;
                        if (currentAtRisk > targetAtRisk) currentAtRisk = targetAtRisk;
                        this.atRiskBarWidth = currentAtRisk;
                    }
                    requestAnimationFrame(animate);
                }
            };
            requestAnimationFrame(animate);
        },
        animateServiceBars() {
            const targets = this.serviceTargetPercentages;
            this.serviceBarWidths = new Array(targets.length).fill(0); // Initialize widths to 0
            const increments = targets.map(target => target / 50); // Smoothness factor
            const currents = new Array(targets.length).fill(0);

            const animate = () => {
                let stillAnimating = false;
                targets.forEach((target, index) => {
                    if (currents[index] < target) {
                        currents[index] += increments[index];
                        if (currents[index] > target) currents[index] = target;
                        this.serviceBarWidths[index] = currents[index];
                        stillAnimating = true;
                    }
                });
                if (stillAnimating) {
                    requestAnimationFrame(animate);
                }
            };
            requestAnimationFrame(animate);
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
                    this.animateScore();
                    this.animateAssetsBar();
                    this.animateServiceBars(); // Start service bars animation
                });
            } catch (error) {
                console.error('Error fetching scan results:', error);
                this.$router.push({ path: '/' });
            }
        }
    },
    mounted() {
        this.fetchResults();
    }
};