/* eslint-disable */
export default {
    data() {
      return {
        isDropdownOpen: false,
        awsAccountId: '',
        awsAccessKey: '',
        awsSecretKey: '',
        awsSessionToken: '',
        awsIdError: '',
        showProgress: false, // Controls visibility of progress bar
        progressWidth: 0, // Percentage width of the progress bar
        progressMessage: '', // Message above the progress bar
        isScanning: false, // Tracks step 2 progress
        isDone: false, // Tracks step 3 progress
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
            headers: {
              'Content-Type': 'application/json',
            },
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
            this.awsIdError = 'AWS Account ID not found.';
          } else {
            this.awsIdError = '';
            this.startProgress(); // Start progress bar on successful validation
          }
        } catch (error) {
          console.error('Error checking AWS Account ID:', error);
          this.awsIdError = 'Error checking AWS Account ID. Please try again.';
        }
      },
      startProgress() {
        this.showProgress = true;
        this.isScanning = true; // Activate step 2
        const messages = [
          'Scanning AWS services...',
          'Checking security measures...',
          'Extracting data...',
          'Creating charts...',
          'Calculating Security Score...',
        ];
        let step = 0;
        this.progressWidth = 0;
  
        const interval = setInterval(() => {
          this.progressWidth += 20; // Increase by 20% every 2 seconds
          this.progressMessage = messages[step];
          step++;
  
          if (step >= messages.length) {
            clearInterval(interval);
            this.isScanning = false;
            this.isDone = true; // Activate step 3
            setTimeout(() => {
              this.showProgress = false;
              this.$router.push('/results');
            }, 500); // Wait 0.5 seconds after completion
          }
        }, 2000); // Update every 2 seconds
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