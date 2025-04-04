export default {
    name: 'MainPage',
    data() {
      return {
        isDropdownOpen: false,
        timeoutId: null,
        awsIdError: '',
      }
    },
    methods: {
      showDropdown() {
        clearTimeout(this.timeoutId)
        this.isDropdownOpen = true
      },
      hideDropdown() {
        this.timeoutId = setTimeout(() => {
          this.isDropdownOpen = false
        }, 200)
      },
      scrollToAwsInput() {
        const awsInput = document.getElementById('aws-account-input');
        if (awsInput) {
          awsInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      },
      // Updated method to validate AWS Account ID
    async validateAwsId() {
        // Regular expression for ####-####-#### format (where # is a digit)
        const awsIdPattern = /^\d{4}-\d{4}-\d{4}$/;
  
        // First, check the format
        if (!awsIdPattern.test(this.awsAccountId)) {
          this.awsIdError = 'Invalid AWS ID. Try again please.';
          return; // Exit early if the format is invalid
        }
  
        // If the format is valid, call the backend to check if the AWS Account ID exists
        try {
          const response = await fetch('http://localhost:3000/api/check-aws-id', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ awsAccountId: this.awsAccountId }),
          });
  
          const data = await response.json();
  
          if (!response.ok) {
            throw new Error(data.error || 'Failed to check AWS Account ID');
          }
  
          // Check the response from the backend
          if (!data.exists) {
            this.awsIdError = 'AWS Account ID not found.';
          } else {
            // initiate all processes here
            this.awsIdError = ''; // Clear the error if the ID exists
          }
        } catch (error) {
          console.error('Error checking AWS Account ID:', error);
          this.awsIdError = 'Error checking AWS Account ID. Please try again.';
        }
      },
    }
}

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