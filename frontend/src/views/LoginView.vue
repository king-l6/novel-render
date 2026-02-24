<template>
  <div class="min-h-screen flex items-center justify-center p-4 bg-gray-50">
    <div class="w-full max-w-sm">
      <h1 class="text-2xl font-bold text-center text-gray-800 mb-2">📖 TXT 阅读器</h1>
      <p class="text-center text-gray-500 mb-6">请先登录</p>
      <Form
        :model="formState"
        layout="vertical"
        @finish="onSubmit"
      >
        <FormItem
          name="username"
          label="用户名"
          :rules="[{ required: true, message: '请输入用户名' }]"
        >
          <Input
            v-model:value="formState.username"
            placeholder="用户名"
            size="large"
            allow-clear
          />
        </FormItem>
        <FormItem
          name="password"
          label="密码"
          :rules="[{ required: true, message: '请输入密码' }]"
        >
          <InputPassword
            v-model:value="formState.password"
            placeholder="密码"
            size="large"
            allow-clear
          />
        </FormItem>
        <FormItem>
          <Button
            type="primary"
            html-type="submit"
            size="large"
            block
            :loading="loading"
            class="mt-2"
          >
            登录
          </Button>
        </FormItem>
      </Form>
      <Alert
        v-if="errorMsg"
        type="error"
        :message="errorMsg"
        show-icon
        class="mt-4"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Form, FormItem, Input, InputPassword, Button, Alert, message } from 'ant-design-vue'
import { useUserStore } from '@/store/user'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const formState = reactive({ username: '', password: '' })
const loading = ref(false)
const errorMsg = ref('')

async function onSubmit() {
  loading.value = true
  errorMsg.value = ''
  try {
    await userStore.login(formState.username, formState.password)
    message.success('登录成功')
    const redirect = (route.query.redirect as string) || '/bookshelf'
    router.replace(redirect)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '登录失败'
    errorMsg.value = msg === 'Failed to fetch' || msg.includes('fetch')
      ? '无法连接服务器，请确认已用 http://local.bilibili.co:3000 打开并已启动服务'
      : msg
  } finally {
    loading.value = false
  }
}
</script>
