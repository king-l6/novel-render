import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ThemeType = 'light' | 'sepia' | 'dark'

export const useAppStore = defineStore('app', () => {
  const theme = ref<ThemeType>('light')
  const fontSize = ref(18)
  const paginationMode = ref(false)

  function setTheme(t: ThemeType) {
    theme.value = t
    document.body.setAttribute('data-theme', t)
  }

  function setFontSize(n: number) {
    fontSize.value = Math.max(14, Math.min(28, n))
    document.documentElement.style.setProperty('--font-size', fontSize.value + 'px')
  }

  function togglePaginationMode() {
    paginationMode.value = !paginationMode.value
  }

  return {
    theme,
    fontSize,
    paginationMode,
    setTheme,
    setFontSize,
    togglePaginationMode,
  }
})
