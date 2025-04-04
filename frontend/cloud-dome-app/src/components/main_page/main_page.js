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
    // New method to validate AWS Account ID
    validateAwsId() {
      // Regular expression for ####-####-#### format (where # is a digit)
      const awsIdPattern = /^\d{4}-\d{4}-\d{4}$/;

      // Test the input against the pattern
      if (!awsIdPattern.test(this.awsAccountId)) {
        this.awsIdError = 'Invalid AWS ID. Please try again.';
      } else {
        this.awsIdError = ''; // Clear the error if the format is valid
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