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
        scanId: null,
      };
    },
    methods: {
      showDropdown() {
        this.isDropdownOpen = true;
      },
      hideDropdown() {
        this.isDropdownOpen = false;
      },
      refresh() {
        this.$router.push({ path: '/' });
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
          const response = await fetch('https://backend-service-106601605987.us-central1.run.app/api/check-aws-info', {
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
             // Start security checks immediately
            this.runSecurityChecks();
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
        this.progressMessage = 'Authenticating and Running Processes...';
        const messages = [
          'Scanning AWS services...',
          'Checking security measures...',
          'Extracting data...',
          'Creating charts...',
          'Calculating Security Score...',
        ];
        let step = 0;
        this.progressWidth = 0;
  
        await this.runSecurityChecks(); // Wait for scan ID
        
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
              if (this.scanId) {
                this.$router.push({
                  path: '/results',
                  query: { scanId: this.scanId },
                });
              } else {
                console.error('Scan ID not received');
              }
            }, 1000);
          }
        }, 2000);
      },
      async runSecurityChecks() {
        try {
          const response = await fetch('https://backend-service-106601605987.us-central1.run.app/api/run-security-checks', {
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
  
          this.scanId = data.scanId; // Store the scan ID
        } catch (error) {
          console.error('Error running security checks:', error);
          this.awsIdError = 'Error running security checks. Please try again.';
        }
      },
    },
  };