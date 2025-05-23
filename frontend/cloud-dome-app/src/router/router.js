import { createRouter, createWebHistory } from 'vue-router';
import MainPage from '../components/main_page/main_page.vue'; // Your current main page component
import ResultPage from '../components/result_page/result_page.vue'; // Your result page component

const routes = [
  {
    path: '/',
    name: 'MainPage',
    component: MainPage,
  },
  {
    path: '/results',
    name: 'ResultPage',
    component: ResultPage,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;