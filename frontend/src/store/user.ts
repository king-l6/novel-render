import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/api'

export interface UserInfo {
  username: string
  isAdmin: boolean
}

export const useUserStore = defineStore('user', () => {
  const userInfo = ref<UserInfo | null>(null)

  const isLoggedIn = computed(() => !!userInfo.value)
  const userName = computed(() => userInfo.value?.username ?? '')
  const isAdmin = computed(() => userInfo.value?.isAdmin ?? false)

  async function fetchMe() {
    try {
      const res = await api.get<UserInfo>('/api/auth/me')
      userInfo.value = res
      return res
    } catch {
      userInfo.value = null
      return null
    }
  }

  async function login(username: string, password: string) {
    const res = await api.post<UserInfo>('/api/auth/login', { username, password })
    userInfo.value = res
    return res
  }

  async function logout() {
    try {
      await api.post('/api/auth/logout')
    } finally {
      userInfo.value = null
    }
  }

  return {
    userInfo,
    isLoggedIn,
    userName,
    isAdmin,
    fetchMe,
    login,
    logout,
  }
})
