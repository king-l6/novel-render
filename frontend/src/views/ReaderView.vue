<template>
  <div class="reader-view h-screen flex flex-col" :data-theme="appStore.theme">
    <header class="reader-header flex-shrink-0 flex items-center gap-3 px-4 py-2 border-b shadow-sm z-10">
      <Button type="text" size="large" @click="goBack">←</Button>
      <Button type="text" size="large" @click="sidebarOpen = !sidebarOpen">≡</Button>
      <h1 class="flex-1 text-base font-semibold truncate reader-title">{{ book?.title || '加载中…' }}</h1>
      <div class="flex items-center gap-1">
        <Button type="text" size="middle" @click="toggleMode" :title="appStore.paginationMode ? '分页模式' : '普通模式'">📄</Button>
        <Button type="text" size="middle" @click="cycleTheme">🌓</Button>
        <Button type="text" size="middle" @click="appStore.setFontSize(appStore.fontSize - 2)">A-</Button>
        <span class="text-sm w-6 text-center reader-muted">{{ appStore.fontSize }}</span>
        <Button type="text" size="middle" @click="appStore.setFontSize(appStore.fontSize + 2)">A+</Button>
        <Button type="text" size="middle" @click="fullscreen = !fullscreen">⛶</Button>
      </div>
    </header>

    <div class="flex-1 flex min-h-0">
      <aside
        v-show="sidebarOpen && !fullscreen"
        class="reader-sidebar w-60 flex-shrink-0 border-r overflow-y-auto p-3"
      >
        <h3 class="text-sm mb-2 border-b pb-2 reader-muted">目录</h3>
        <ul v-if="chapters.length" class="space-y-1 text-sm">
          <li
            v-for="ch in chapters"
            :key="ch.index"
            class="reader-toc-item py-1 px-2 rounded cursor-pointer"
            :class="{ 'reader-toc-active': activeChapterIndex === ch.index }"
            @click="scrollToChapter(ch.index)"
          >
            {{ ch.title.length > 18 ? ch.title.slice(0, 18) + '…' : ch.title }}
          </li>
        </ul>
        <p v-else class="text-sm reader-muted">无章节标题</p>
      </aside>

      <main class="flex-1 flex flex-col min-w-0">
        <div
          ref="contentRef"
          class="reader-content flex-1 overflow-y-auto px-6 py-4 max-w-3xl mx-auto w-full leading-[1.8]"
          :style="{ fontSize: appStore.fontSize + 'px' }"
        >
          <template v-if="appStore.paginationMode">
            <div class="whitespace-pre-wrap break-words">
              <p v-for="(p, i) in currentPageParas" :key="i" class="mb-5 indent-8 reader-text">{{ p }}</p>
            </div>
          </template>
          <template v-else>
            <div v-for="block in contentBlocks" :key="block.index ?? block.content.slice(0,20)">
              <h2
                v-if="block.type === 'chapter'"
                :id="'ch-' + block.index"
                class="reader-chapter font-semibold mt-8 mb-3 text-lg leading-snug"
              >
                {{ block.content }}
              </h2>
              <p v-else class="mb-5 indent-8 whitespace-pre-wrap reader-text">{{ block.content }}</p>
            </div>
          </template>
        </div>

        <div v-if="!fullscreen" class="reader-footer flex-shrink-0 flex items-center gap-3 px-4 py-2 border-t">
          <div v-if="!appStore.paginationMode" class="flex items-center gap-2">
            <span class="text-xs reader-muted">阅读进度</span>
            <span class="text-xs reader-muted w-10">{{ scrollPercent }}%</span>
          </div>
          <div v-else class="flex items-center gap-2">
            <Button type="text" size="small" @click="prevPage">‹</Button>
            <span class="text-sm reader-muted">第 {{ currentPageIndex + 1 }} / {{ pageList.length }} 页</span>
            <Button type="text" size="small" @click="nextPage">›</Button>
          </div>
          <div class="reader-progress-track flex-1 h-1.5 rounded overflow-hidden">
            <div
              class="reader-progress-fill h-full rounded transition-all"
              :style="{ width: (appStore.paginationMode ? (pageList.length ? ((currentPageIndex + 1) / pageList.length) * 100 : 100) : scrollPercent) + '%' }"
            />
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch, onActivated } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button } from 'ant-design-vue'
import { api } from '@/api'
import { useAppStore } from '@/store/app'
import type { BookDetail } from '@/types/book'
import { parseChapters, buildPageList, parseContentBlocks } from '@/hooks/useBookReader'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()

const book = ref<BookDetail | null>(null)
const contentRef = ref<HTMLDivElement | null>(null)
const sidebarOpen = ref(false)
const fullscreen = ref(false)
const scrollPercent = ref(0)
const activeChapterIndex = ref<number | null>(null)
const currentPageIndex = ref(0)

const chapters = computed(() => (book.value ? parseChapters(book.value.content) : []))
const pageList = computed(() => (book.value ? buildPageList(book.value.content) : []))
const contentBlocks = computed(() =>
  book.value ? parseContentBlocks(book.value.content, chapters.value) : []
)
const currentPageParas = computed(() => {
  const html = pageList.value[currentPageIndex.value] ?? ''
  return html.split(/\n\n+/).filter(Boolean)
})

const bookId = computed(() => Number(route.params.id))

function goBack() {
  flushProgress().then(() => {
    router.replace('/bookshelf')
  })
}

function toggleMode() {
  appStore.togglePaginationMode()
  if (appStore.paginationMode && book.value?.progress?.page_index != null) {
    currentPageIndex.value = Math.min(book.value.progress.page_index, pageList.value.length - 1)
  }
}

const themes = ['light', 'sepia', 'dark'] as const
function cycleTheme() {
  const i = themes.indexOf(appStore.theme)
  const next = themes[(i + 1) % themes.length]
  appStore.setTheme(next)
}

function scrollToChapter(index: number) {
  const el = document.getElementById('ch-' + index)
  el?.scrollIntoView({ behavior: 'smooth' })
}

function prevPage() {
  if (currentPageIndex.value > 0) {
    currentPageIndex.value--
    savePageProgress()
  }
}

function nextPage() {
  if (currentPageIndex.value < pageList.value.length - 1) {
    currentPageIndex.value++
    savePageProgress()
  }
}

let scrollTimer: ReturnType<typeof setTimeout>
function onScroll() {
  const el = contentRef.value
  if (!el || appStore.paginationMode) return
  const { scrollTop, scrollHeight, clientHeight } = el
  scrollPercent.value = scrollHeight <= clientHeight ? 100 : Math.round((scrollTop / (scrollHeight - clientHeight)) * 100)
  const half = scrollTop + clientHeight / 2
  for (let i = chapters.value.length - 1; i >= 0; i--) {
    const node = document.getElementById('ch-' + chapters.value[i].index)
    if (node && node.offsetTop <= half) {
      activeChapterIndex.value = chapters.value[i].index
      return
    }
  }
  activeChapterIndex.value = chapters.value[0]?.index ?? null
  clearTimeout(scrollTimer)
  scrollTimer = setTimeout(() => {
    const total = pageList.value.length
    const pageIndex = total <= 1 ? 0 : Math.min(
      Math.floor((scrollPercent.value / 100) * total),
      total - 1
    )
    api.put(`/api/books/${bookId.value}/progress`, {
      scroll_top: el.scrollTop,
      percent: scrollPercent.value,
      page_index: pageIndex,
    }).catch(() => {})
  }, 500)
}

function savePageProgress() {
  const total = pageList.value.length
  const percent = total <= 1 ? 100 : Math.round(((currentPageIndex.value + 1) / total) * 100)
  api.put(`/api/books/${bookId.value}/progress`, {
    scroll_top: 0,
    percent,
    page_index: currentPageIndex.value,
  }).catch(() => {})
}

function flushProgress() {
  clearTimeout(scrollTimer)
  if (!book.value || !Number(route.params.id)) return Promise.resolve()
  const id = bookId.value
  if (appStore.paginationMode) {
    const total = pageList.value.length
    const percent = total <= 1 ? 100 : Math.round(((currentPageIndex.value + 1) / total) * 100)
    return api.put(`/api/books/${id}/progress`, {
      scroll_top: 0,
      percent,
      page_index: currentPageIndex.value,
    }).catch(() => {})
  }
  const el = contentRef.value
  if (!el) return Promise.resolve()
  const total = pageList.value.length
  const pageIndex = total <= 1 ? 0 : Math.min(
    Math.floor((scrollPercent.value / 100) * total),
    total - 1
  )
  return api.put(`/api/books/${id}/progress`, {
    scroll_top: el.scrollTop,
    percent: scrollPercent.value,
    page_index: pageIndex,
  }).catch(() => {})
}

async function loadBook() {
  const id = bookId.value
  if (!id || !Number(id)) return
  contentRef.value?.removeEventListener('scroll', onScroll)
  clearTimeout(scrollTimer)
  book.value = null
  scrollPercent.value = 0
  currentPageIndex.value = 0
  activeChapterIndex.value = null

  try {
    const data = await api.get<BookDetail>(`/api/books/${id}`)
    const content = data.content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    data.content = content
    book.value = data
    const progress = data.progress
    const pages = buildPageList(content)

    if (appStore.paginationMode) {
      if (progress?.page_index != null && progress.page_index > 0) {
        currentPageIndex.value = Math.min(progress.page_index, pages.length - 1)
      } else if (progress?.percent != null && progress.percent > 0 && pages.length > 0) {
        currentPageIndex.value = Math.min(
          Math.floor((progress.percent / 100) * pages.length),
          pages.length - 1
        )
      }
    } else {
      const progressScrollTop = progress?.scroll_top != null && progress.scroll_top > 0
        ? progress.scroll_top
        : null
      const progressPercent = progress?.percent != null && progress.percent > 0
        ? progress.percent
        : null

      await nextTick()
      const el = contentRef.value
      if (el && (progressScrollTop != null || progressPercent != null)) {
        const restoreScroll = () => {
          const target = contentRef.value
          if (!target) return
          if (progressScrollTop != null) {
            target.scrollTop = progressScrollTop
          } else if (progressPercent != null) {
            const maxScroll = target.scrollHeight - target.clientHeight
            if (maxScroll > 0) {
              target.scrollTop = (progressPercent / 100) * maxScroll
            }
          }
          if (progressPercent != null) scrollPercent.value = progressPercent
          else if (target.scrollHeight > target.clientHeight) {
            scrollPercent.value = Math.round((target.scrollTop / (target.scrollHeight - target.clientHeight)) * 100)
          }
        }
        restoreScroll()
        requestAnimationFrame(() => {
          requestAnimationFrame(restoreScroll)
        })
        setTimeout(restoreScroll, 150)
      }
    }
    contentRef.value?.addEventListener('scroll', onScroll)
    onScroll()
  } catch {
    book.value = null
    router.replace('/bookshelf')
  }
}

onMounted(() => {
  document.body.setAttribute('data-theme', appStore.theme)
  loadBook()
})

watch(bookId, (newId, oldId) => {
  if (oldId !== undefined && String(newId) !== String(oldId)) {
    loadBook()
  }
})

onActivated(() => {
  if (book.value?.id !== bookId.value) {
    loadBook()
  }
})

onUnmounted(() => {
  contentRef.value?.removeEventListener('scroll', onScroll)
  flushProgress()
})

</script>

<style scoped>
/* 默认：浅色 */
.reader-view {
  background: #f3f4f6;
  color: #1f2937;
}
.reader-header {
  background: #fff;
  border-color: #e5e7eb;
}
.reader-title { color: #1f2937; }
.reader-muted { color: #6b7280; }
.reader-sidebar {
  background: #fff;
  border-color: #e5e7eb;
}
.reader-toc-item:hover { background: #fffbeb; }
.reader-toc-active { background: #fef3c7; border-left: 2px solid #d97706; }
.reader-content { background: #f9fafb; color: #1f2937; }
.reader-text { color: #1f2937; }
.reader-chapter { color: #b45309; }
.reader-footer {
  background: #fff;
  border-color: #e5e7eb;
}
.reader-progress-track { background: #e5e7eb; }
.reader-progress-fill { background: #f59e0b; }

/* 护眼/羊皮纸 */
.reader-view[data-theme="sepia"] {
  background: #f4ecd8;
  color: #5b4636;
}
.reader-view[data-theme="sepia"] .reader-header {
  background: rgba(244, 236, 216, 0.95);
  border-color: #c4b59a;
}
.reader-view[data-theme="sepia"] .reader-title { color: #5b4636; }
.reader-view[data-theme="sepia"] .reader-muted { color: #7d6b5c; }
.reader-view[data-theme="sepia"] .reader-sidebar {
  background: #ebe3d0;
  border-color: #c4b59a;
}
.reader-view[data-theme="sepia"] .reader-toc-item:hover { background: rgba(139, 105, 20, 0.1); }
.reader-view[data-theme="sepia"] .reader-toc-active { background: rgba(139, 105, 20, 0.12); border-left-color: #8b6914; }
.reader-view[data-theme="sepia"] .reader-content { background: #f4ecd8; color: #5b4636; }
.reader-view[data-theme="sepia"] .reader-text { color: #5b4636; }
.reader-view[data-theme="sepia"] .reader-chapter { color: #8b6914; }
.reader-view[data-theme="sepia"] .reader-footer {
  background: rgba(244, 236, 216, 0.95);
  border-color: #c4b59a;
}
.reader-view[data-theme="sepia"] .reader-progress-track { background: #ddd4c4; }
.reader-view[data-theme="sepia"] .reader-progress-fill { background: #8b6914; }

/* 深色 */
.reader-view[data-theme="dark"] {
  background: #1a1a1a;
  color: #e0e0e0;
}
.reader-view[data-theme="dark"] .reader-header {
  background: rgba(38, 38, 38, 0.95);
  border-color: #404040;
}
.reader-view[data-theme="dark"] .reader-title { color: #e5e5e5; }
.reader-view[data-theme="dark"] .reader-muted { color: #a3a3a3; }
.reader-view[data-theme="dark"] .reader-sidebar {
  background: #262626;
  border-color: #404040;
}
.reader-view[data-theme="dark"] .reader-toc-item:hover { background: rgba(212, 160, 23, 0.15); }
.reader-view[data-theme="dark"] .reader-toc-active { background: rgba(212, 160, 23, 0.2); border-left: 2px solid #d4a017; }
.reader-view[data-theme="dark"] .reader-content { background: #1a1a1a; color: #e0e0e0; }
.reader-view[data-theme="dark"] .reader-text { color: #e0e0e0; }
.reader-view[data-theme="dark"] .reader-chapter { color: #d4a017; }
.reader-view[data-theme="dark"] .reader-footer {
  background: rgba(38, 38, 38, 0.95);
  border-color: #404040;
}
.reader-view[data-theme="dark"] .reader-progress-track { background: #404040; }
.reader-view[data-theme="dark"] .reader-progress-fill { background: #d4a017; }
</style>
