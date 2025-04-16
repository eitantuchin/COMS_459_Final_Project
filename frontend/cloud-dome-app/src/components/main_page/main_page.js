import { Buffer } from 'buffer';

export default {
  data() {
    return {
      isMobile: window.innerWidth <= 768,
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
      publicKey: null
    };
  },
  mounted() {
    window.addEventListener('resize', this.handleResize);
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.handleResize);
  },
  async created() {
    // Fetch public key when component is created
    await this.fetchPublicKey();
  },
  methods: {
    handleResize() {
      this.isMobile = window.innerWidth <= 768;
    },
    async fetchPublicKey() {
      try {
        const response = await fetch('http://localhost:3000/api/get-public-key');
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch public key');
        }
        this.publicKey = data.publicKey;
      } catch (error) {
        console.error('Error fetching public key:', error);
        this.awsIdError = 'Error initializing encryption. Please try again.';
      }
    },
    async encryptData(data) {
      if (!this.publicKey) {
        throw new Error('Public key not available');
      }
      // Convert PEM to ArrayBuffer
      const pemHeader = '-----BEGIN PUBLIC KEY-----';
      const pemFooter = '-----END PUBLIC KEY-----';
      const pemContents = this.publicKey.replace(pemHeader, '').replace(pemFooter, '').replace(/\n/g, '');
      const binaryDer = atob(pemContents);
      const buffer = Uint8Array.from(binaryDer, c => c.charCodeAt(0)).buffer;

      const key = await crypto.subtle.importKey(
        'spki',
        buffer,
        {
          name: 'RSA-OAEP',
          hash: 'SHA-256'
        },
        true,
        ['encrypt']
      );
      const jsonString = JSON.stringify(data);
      const encodedData = new TextEncoder().encode(jsonString);
      const encryptedData = await crypto.subtle.encrypt(
        {
          name: 'RSA-OAEP'
        },
        key,
        encodedData
      );
      return Buffer.from(encryptedData).toString('base64');
    },
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
        const payload = {
          awsAccountId: this.awsAccountId,
          awsAccessKey: this.awsAccessKey,
          awsSecretKey: this.awsSecretKey,
          awsSessionToken: this.awsSessionToken || undefined
        };
        const encryptedData = await this.encryptData(payload);
        const response = await fetch('http://localhost:3000/api/check-aws-info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encryptedData })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to check AWS Account ID');
        }

        if (!data.exists) {
          this.awsIdError = 'AWS Account ID not found or credentials invalid.';
        } else {
          this.awsIdError = '';
          this.runSecurityChecks();
          this.startProgress();
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

      await this.runSecurityChecks();

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
        const payload = {
          awsAccountId: this.awsAccountId,
          awsAccessKey: this.awsAccessKey,
          awsSecretKey: this.awsSecretKey,
          awsSessionToken: this.awsSessionToken || undefined
        };
        const encryptedData = await this.encryptData(payload);
        const response = await fetch('http://localhost:3000/api/run-security-checks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encryptedData })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to run security checks');
        }

        this.scanId = data.scanId;
      } catch (error) {
        console.error('Error running security checks:', error);
        this.awsIdError = 'Error running security checks. Please try again.';
      }
    }
  }
};