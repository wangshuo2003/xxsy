<template>
  <div class="login-container">
    <div class="login-header">
      <h1 class="login-title">教育实践平台</h1>
      <p class="login-subtitle">用户端登录</p>
    </div>

    <div class="login-form">
      <van-form @submit="handleLogin">
        <van-cell-group inset>
          <van-field
            v-model="loginForm.username"
            name="username"
            label="用户名"
            placeholder="请输入用户名/手机号"
            :rules="[{ required: true, message: '请填写用户名' }]"
          />
          <van-field
            v-model="loginForm.password"
            type="password"
            name="password"
            label="密码"
            placeholder="请输入密码"
            :rules="[{ required: true, message: '请填写密码' }]"
          />
        </van-cell-group>
        <div style="margin: 16px;">
          <van-button round block type="primary" native-type="submit" :loading="loading">
            登录
          </van-button>
        </div>
      </van-form>

      <div class="demo-accounts">
        <van-collapse v-model="activeNames">
          <van-collapse-item title="演示账号" name="1">
            <p>学生用户：studenta / 1</p>
          </van-collapse-item>
        </van-collapse>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { showSuccessToast, showFailToast } from 'vant'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const activeNames = ref(['1'])

const loginForm = reactive({
  username: '',
  password: ''
})

const handleLogin = async () => {
  loading.value = true
  try {
    await userStore.login(loginForm)
    showSuccessToast('登录成功')
    router.push('/home')
  } catch (error) {
    showFailToast(error.response?.data?.error || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  flex-direction: column;
  padding: 20px;
}

.login-header {
  text-align: center;
  margin-top: 60px;
  margin-bottom: 40px;
}

.login-title {
  color: white;
  font-size: 28px;
  margin: 0;
  font-weight: bold;
}

.login-subtitle {
  color: rgba(255, 255, 255, 0.8);
  font-size: 16px;
  margin: 8px 0 0 0;
}

.login-form {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.demo-accounts {
  margin-top: 20px;
  font-size: 12px;
}

.demo-accounts p {
  margin: 4px 0;
  color: #666;
}
</style>