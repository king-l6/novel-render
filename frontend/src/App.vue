<template>
  <div class="min-h-screen bg-gray-50">
    <RouterView />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useUserStore } from '@/store/user'
import { useRouter } from 'vue-router'

const userStore = useUserStore()
const router = useRouter()

onMounted(async () => {
  await userStore.fetchMe()
  const isLogin = userStore.isLoggedIn
  const path = router.currentRoute.value.path
  if (!isLogin && path !== '/login') {
    router.replace('/login')
  } else if (isLogin && path === '/login') {
    router.replace('/bookshelf')
  }
})
</script>
