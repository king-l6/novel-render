import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/store/user'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'Login', component: () => import('@/views/LoginView.vue'), meta: { public: true } },
    { path: '/bookshelf', name: 'Bookshelf', component: () => import('@/views/BookshelfView.vue') },
    { path: '/reader/:id', name: 'Reader', component: () => import('@/views/ReaderView.vue') },
    { path: '/', redirect: '/bookshelf' },
  ],
})

router.beforeEach(async (to, _from, next) => {
  const userStore = useUserStore()
  if (to.meta.public) {
    next()
    return
  }
  if (!userStore.isLoggedIn) {
    await userStore.fetchMe()
    if (!userStore.isLoggedIn) {
      next({ path: '/login', query: { redirect: to.fullPath } })
      return
    }
  }
  next()
})

export default router
