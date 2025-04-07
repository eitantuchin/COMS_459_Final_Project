export default {
    name: 'ResultPage',
    data() {
        return {
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
                { label: 'Score Analysis', content: 'analysis', icon: 'fas fa-search' }
            ]
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
    },
    methods: {
        setActivePanel(index) {
            this.activePanel = index;
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
                    this.animateAll(); // Single animation that handles everything

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