<template>
  <div class="min-h-screen bg-gray-50 pb-8">
    <header class="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
      <h1 class="text-lg font-semibold text-gray-800">📖 书架</h1>
      <div class="flex items-center gap-3">
        <span class="text-sm text-gray-500">{{ userStore.userName }}</span>
        <RouterLink v-if="userStore.isAdmin" to="/admin" class="text-sm text-blue-600 hover:underline">管理</RouterLink>
        <Button size="small" @click="handleLogout">退出</Button>
      </div>
    </header>

    <main class="container mx-auto px-4 pt-6">
      <Spin :spinning="loading">
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <!-- 第一个：上传卡片（支持点击与拖拽） -->
          <Card
            class="cursor-pointer border-2 border-dashed transition-all flex flex-col min-h-[180px] justify-center items-center"
            :class="dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/50'"
            @click="triggerUpload"
            @dragover.prevent="dragOver = true"
            @dragleave.prevent="dragOver = false"
            @drop.prevent="onDrop"
          >
            <input
              ref="fileInputRef"
              type="file"
              accept=".txt"
              class="hidden"
              @change="onFileSelect"
            />
            <div class="text-4xl mb-2">➕</div>
            <div class="text-sm font-medium text-gray-600">导入 TXT</div>
            <div class="text-xs text-gray-400 mt-1">点击或拖拽上传</div>
          </Card>

          <!-- 书籍卡片 -->
          <Card
            v-for="book in books"
            :key="book.id"
            class="cursor-pointer hover:shadow-lg transition-shadow min-h-[180px] flex flex-col"
            @click="openBook(book.id)"
          >
            <div class="flex-1 flex flex-col">
              <div class="w-full aspect-[3/4] bg-gradient-to-br from-amber-100 to-amber-200 rounded mb-2 flex items-center justify-center text-amber-800 text-2xl font-serif">
                {{ book.title?.charAt(0) || '书' }}
              </div>
              <div class="text-sm font-medium text-gray-800 truncate" :title="book.title">
                {{ book.title || book.file_name }}
              </div>
              <div class="text-xs text-gray-500 mt-1">
                {{ book.percent != null && book.percent > 0 ? `读到 ${book.percent}%` : formatDate(book.created_at) }}
              </div>
            </div>
          </Card>
        </div>

        <Empty v-if="!loading && books.length === 0" description="暂无书籍，点击「导入 TXT」添加" class="py-12" />
      </Spin>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onActivated } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { Card, Button, Spin, Empty, message } from 'ant-design-vue'
import { useUserStore } from '@/store/user'
import { api } from '@/api'
import type { BookItem } from '@/types/book'

const router = useRouter()
const userStore = useUserStore()
const books = ref<BookItem[]>([])
const loading = ref(true)
const fileInputRef = ref<HTMLInputElement | null>(null)
const dragOver = ref(false)

function formatDate(ts: number) {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function loadBooks() {
  loading.value = true
  try {
    books.value = await api.get<BookItem[]>('/api/books')
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载书架失败')
  } finally {
    loading.value = false
  }
}

function openBook(id: number) {
  router.push({ name: 'Reader', params: { id: String(id) } })
}

function triggerUpload() {
  fileInputRef.value?.click()
}

async function uploadFile(file: File) {
  if (!file.name.toLowerCase().endsWith('.txt')) {
    message.warning('请选择 TXT 文件')
    return
  }
  const text = await file.text()
  const content = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const res = await api.post<{ id: number }>('/api/books', {
    title: file.name.replace(/\.txt$/i, ''),
    file_name: file.name,
    content,
    size: file.size,
  })
  message.success('已加入书架')
  await loadBooks()
  router.push({ name: 'Reader', params: { id: String(res.id) } })
}

async function onFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    await uploadFile(file)
  } catch (err) {
    message.error(err instanceof Error ? err.message : '上传失败')
  }
}

async function onDrop(e: DragEvent) {
  dragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (!file) return
  try {
    await uploadFile(file)
  } catch (err) {
    message.error(err instanceof Error ? err.message : '上传失败')
  }
}

async function handleLogout() {
  await userStore.logout()
  router.replace('/login')
}

onMounted(() => {
  loadBooks()
})

onActivated(() => {
  loadBooks()
})
</script>
