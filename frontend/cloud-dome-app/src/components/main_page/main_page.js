export default {
    data() {
      return {
        isDropdownOpen: false,
        awsAccountId: '',
        awsAccessKey: '',
        awsSecretKey: '',
        awsSessionToken: '',
        awsIdError: '',
        showProgress: false,
        progressWidth: 0,
        progressMessage: '',
        isScanning: false,
        isDone: false,
        securityResults: null, // Store results from security checks
      };
    },
    methods: {
      showDropdown() {
        this.isDropdownOpen = true;
      },
      hideDropdown() {
        this.isDropdownOpen = false;
      },
      scrollToAwsInput() {
        const awsInput = document.getElementById('aws-account-input');
        if (awsInput) {
          awsInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      },
      async validateAwsId() {
        const awsIdPattern = /^\d{12}$/;
  
        if (!awsIdPattern.test(this.awsAccountId)) {
          this.awsIdError = 'Invalid AWS ID. Try again please.';
          return;
        }
  
        if (!this.awsAccessKey || !this.awsSecretKey) {
          this.awsIdError = 'Access Key ID and Secret Access Key are required.';
          return;
        }
  
        try {
          const response = await fetch('http://localhost:3000/api/check-aws-info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              awsAccountId: this.awsAccountId,
              awsAccessKey: this.awsAccessKey,
              awsSecretKey: this.awsSecretKey,
              awsSessionToken: this.awsSessionToken || undefined,
            }),
          });
  
          const data = await response.json();
  
          if (!response.ok) {
            throw new Error(data.error || 'Failed to check AWS Account ID');
          }
  
          if (!data.exists) {
            this.awsIdError = 'AWS Account ID not found or credentials invalid.';
          } else {
            this.awsIdError = '';
            this.startProgress(); // Start progress bar and trigger security checks
          }
        } catch (error) {
          console.error('Error checking AWS Account ID:', error);
          this.awsIdError = 'Error checking AWS Account ID. Please try again.';
        }
      },
      async startProgress() {
        this.showProgress = true;
        this.isScanning = true;
        const messages = [
          'Scanning AWS services...',
          'Checking security measures...',
          'Extracting data...',
          'Creating charts...',
          'Calculating Security Score...',
        ];
        let step = 0;
        this.progressWidth = 0;
  
        // Start security checks immediately
        this.runSecurityChecks();
  
        const interval = setInterval(() => {
          this.progressWidth += 20;
          this.progressMessage = messages[step];
          step++;
  
          if (step >= messages.length) {
            clearInterval(interval);
            this.isScanning = false;
            this.isDone = true;
            setTimeout(() => {
              this.showProgress = false;
              if (this.securityResults) {
                this.$router.push({
                  path: '/results',
                  query: { results: JSON.stringify(this.securityResults) },
                });
              } else {
                console.error('Security checks not completed yet');
              }
            }, 500);
          }
        }, 2000);
      },
     async runSecurityChecks() {
        try {
          const response = await fetch('http://localhost:3000/api/run-security-checks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              awsAccountId: this.awsAccountId,
              awsAccessKey: this.awsAccessKey,
              awsSecretKey: this.awsSecretKey,
              awsSessionToken: this.awsSessionToken || undefined,
            }),
          });
  
          const data = await response.json();
  
          if (!response.ok) {
            throw new Error(data.error || 'Failed to run security checks');
          }
  
          this.securityResults = data; // Store results
        } catch (error) {
          console.error('Error running security checks:', error);
          this.awsIdError = 'Error running security checks. Please try again.';
        }
      },
    },
  };

document.addEventListener('DOMContentLoaded', () => {
    const logo = document.querySelector('.logo');
    const icon_image = document.querySelector('.icon-image');
    if (logo) {
        logo.addEventListener('click', () => {
            window.location.reload(); // Reload the current page
        });
    }
    if (icon_image) {
        icon_image.addEventListener('click', () => {
            window.location.reload(); // Reload the current page
        });
    }
});