/* eslint-disable */
export default {
    name: 'ResultPage',
    computed: {
      results() {
        return this.$route.query.results ? JSON.parse(this.$route.query.results) : {};
      },
    },
  };