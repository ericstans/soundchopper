import { createRouter, createWebHistory } from 'vue-router';
import Home from './views/Home.vue';

const routes = [
  { path: '/', name: 'Home', component: Home },
  { path: '/soundchopper', name: 'Home2', component: Home }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
