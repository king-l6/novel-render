<template>
  <div class="min-h-screen bg-gray-50 pb-8">
    <header class="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
      <h1 class="text-lg font-semibold text-gray-800">管理员</h1>
      <div class="flex items-center gap-3">
        <RouterLink to="/bookshelf" class="text-sm text-blue-600 hover:underline">← 返回书架</RouterLink>
        <Button size="small" @click="handleLogout">退出</Button>
      </div>
    </header>

    <main class="container mx-auto px-4 pt-6 max-w-4xl">
      <Alert
        v-if="!userStore.isAdmin && !loadingMe"
        type="warning"
        show-icon
        class="mb-4"
        message="仅管理员可访问此页面"
        description="请使用管理员账号登录，或返回书架。"
      >
        <template #action>
          <RouterLink to="/bookshelf" class="text-blue-600 hover:underline">返回书架</RouterLink>
        </template>
      </Alert>

      <template v-else>
        <Spin :spinning="loadingMe">
          <Card class="mb-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-base font-semibold text-gray-800">用户列表</h2>
              <Button type="primary" @click="openAddUser">添加用户</Button>
            </div>
            <Table
              :columns="userColumns"
              :data-source="users"
              :pagination="{ pageSize: 10 }"
              row-key="id"
              size="small"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'is_admin'">
                  {{ record.is_admin ? '是' : '否' }}
                </template>
                <template v-else-if="column.key === 'created_at'">
                  {{ formatDate(record.created_at) }}
                </template>
                <template v-else-if="column.key === 'action'">
                  <div class="flex flex-wrap gap-1">
                    <Button size="small" @click="showUserBooks(record)">书籍</Button>
                    <Button size="small" @click="openEditUser(record)">编辑</Button>
                    <Button size="small" danger @click="deleteUser(record)">删除</Button>
                  </div>
                </template>
              </template>
            </Table>
          </Card>

          <Card v-if="selectedUserId != null" class="mb-6">
            <h2 class="text-base font-semibold text-gray-800 mb-4">
              用户「{{ selectedUserName }}」的书架
            </h2>
            <Table
              :columns="bookColumns"
              :data-source="userBooks"
              :loading="loadingBooks"
              :pagination="{ pageSize: 10 }"
              row-key="id"
              size="small"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'size'">
                  {{ (record.size / 1024).toFixed(1) }} KB
                </template>
                <template v-else-if="column.key === 'created_at'">
                  {{ formatDate(record.created_at) }}
                </template>
                <template v-else-if="column.key === 'action'">
                  <Button size="small" danger @click="deleteBook(record)">删除</Button>
                </template>
              </template>
            </Table>
          </Card>
        </Spin>
      </template>
    </main>

    <Modal
      v-model:open="modalVisible"
      :title="editingUser ? '编辑用户' : '添加用户'"
      :confirm-loading="modalSubmitting"
      ok-text="确定"
      cancel-text="取消"
      @ok="submitUser"
    >
      <Form layout="vertical" :model="formState">
        <FormItem label="用户名" name="username" required>
          <Input
            v-model:value="formState.username"
            placeholder="用户名"
            :disabled="!!editingUser"
          />
        </FormItem>
        <FormItem v-if="!editingUser" label="密码" name="password" required>
          <Input v-model:value="formState.password" type="password" placeholder="密码" />
        </FormItem>
        <FormItem v-else label="新密码" name="password">
          <Input v-model:value="formState.password" type="password" placeholder="留空则不修改" />
        </FormItem>
        <FormItem name="is_admin">
          <Checkbox v-model:checked="formState.is_admin">管理员</Checkbox>
        </FormItem>
      </Form>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import {
  Card,
  Table,
  Button,
  Spin,
  Alert,
  Modal,
  Form,
  FormItem,
  Input,
  Checkbox,
  message,
} from 'ant-design-vue'
import type { TableColumnsType } from 'ant-design-vue'
import { useUserStore } from '@/store/user'
import { api } from '@/api'
import type { AdminUser, AdminBook } from '@/types/admin'

const router = useRouter()
const userStore = useUserStore()

const loadingMe = ref(true)
const users = ref<AdminUser[]>([])
const selectedUserId = ref<number | null>(null)
const selectedUserName = ref('')
const userBooks = ref<AdminBook[]>([])
const loadingBooks = ref(false)
const modalVisible = ref(false)
const modalSubmitting = ref(false)
const editingUser = ref<AdminUser | null>(null)

const formState = ref({
  username: '',
  password: '',
  is_admin: false,
})

const userColumns: TableColumnsType = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
  { title: '用户名', dataIndex: 'username', key: 'username' },
  { title: '管理员', key: 'is_admin', width: 80 },
  { title: '注册时间', key: 'created_at', width: 110 },
  { title: '操作', key: 'action', width: 200 },
]

const bookColumns: TableColumnsType = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
  { title: '书名', dataIndex: 'title', key: 'title', ellipsis: true },
  { title: '大小', key: 'size', width: 90 },
  { title: '添加时间', key: 'created_at', width: 110 },
  { title: '操作', key: 'action', width: 80 },
]

function formatDate(ts: number) {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function ensureAdmin() {
  loadingMe.value = true
  await userStore.fetchMe()
  loadingMe.value = false
  if (!userStore.isAdmin) return
  await loadUsers()
}

async function loadUsers() {
  try {
    users.value = await api.get<AdminUser[]>('/api/admin/users')
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载用户列表失败')
  }
}

function openAddUser() {
  editingUser.value = null
  formState.value = { username: '', password: '', is_admin: false }
  modalVisible.value = true
}

function openEditUser(u: AdminUser) {
  editingUser.value = u
  formState.value = {
    username: u.username,
    password: '',
    is_admin: u.is_admin,
  }
  modalVisible.value = true
}

async function submitUser() {
  const { username, password, is_admin } = formState.value
  const uname = String(username).trim()
  if (!uname) {
    message.warning('请输入用户名')
    return
  }
  if (!editingUser.value && !password) {
    message.warning('请输入密码')
    return
  }
  modalSubmitting.value = true
  try {
    if (editingUser.value) {
      await api.patch(`/api/admin/users/${editingUser.value.id}`, {
        username: uname,
        ...(password ? { password } : {}),
        is_admin,
      })
      message.success('已更新')
    } else {
      await api.post('/api/admin/users', {
        username: uname,
        password,
        is_admin,
      })
      message.success('已添加')
    }
    modalVisible.value = false
    await loadUsers()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '操作失败')
  } finally {
    modalSubmitting.value = false
  }
}

async function deleteUser(u: AdminUser) {
  if (!confirm(`确定删除用户「${u.username}」？其书籍将一并删除。`)) return
  try {
    await api.delete(`/api/admin/users/${u.id}`)
    message.success('已删除')
    if (selectedUserId.value === u.id) {
      selectedUserId.value = null
      userBooks.value = []
    }
    await loadUsers()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '删除失败')
  }
}

async function showUserBooks(u: AdminUser) {
  selectedUserId.value = u.id
  selectedUserName.value = u.username
  await loadUserBooks()
}

async function loadUserBooks() {
  if (selectedUserId.value == null) return
  loadingBooks.value = true
  try {
    userBooks.value = await api.get<AdminBook[]>(
      `/api/admin/users/${selectedUserId.value}/books`
    )
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载书籍失败')
  } finally {
    loadingBooks.value = false
  }
}

async function deleteBook(b: AdminBook) {
  if (!confirm('确定删除此书？')) return
  try {
    await api.delete(`/api/admin/books/${b.id}`)
    message.success('已删除')
    await loadUserBooks()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '删除失败')
  }
}

function handleLogout() {
  userStore.logout()
  router.replace('/login')
}

onMounted(() => {
  ensureAdmin()
})
</script>
