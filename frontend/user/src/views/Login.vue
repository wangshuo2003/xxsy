<template>
  <div class="login-container">
    <div class="login-header">
      <h1 class="login-title">教育实践平台</h1>
      <p class="login-subtitle">用户端登录</p>
    </div>

    <div class="login-form">
      <div class="login-fields">
        <van-cell-group inset>
          <van-field
            v-model="loginForm.username"
            name="username"
            label="用户名"
            placeholder="请输入用户名"
          />
          <van-field
            v-model="loginForm.password"
            type="password"
            name="password"
            label="密码"
            placeholder="请输入密码"
            @keyup.enter="handleLogin"
          />
          <van-field
            v-if="showCaptcha"
            v-model="captchaInput"
            name="captcha"
            label="验证码"
            placeholder="请输入验证码"
            maxlength="4"
            type="text"
            inputmode="numeric"
            @keyup.enter="handleLogin"
          >
            <template #button>
              <img
                v-if="captchaText"
                class="captcha-img"
                :src="captchaText"
                alt="验证码"
                @click="generateCaptcha"
              />
            </template>
          </van-field>
        </van-cell-group>
        <div style="margin: 16px;">
          <van-button
            round
            block
            type="primary"
            native-type="button"
            :loading="loading"
            :disabled="loginDisabled"
            @click="handleLogin"
          >
            登录
          </van-button>
        </div>
      </div>

      <div class="demo-accounts">
        <van-collapse v-model="activeNames">
          <van-collapse-item title="演示账号" name="1">
            <p>学生用户：s / 1</p>
          </van-collapse-item>
        </van-collapse>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showSuccessToast, showFailToast } from 'vant'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const activeNames = ref(['1'])
const failedCount = ref(Number(localStorage.getItem('loginFailedCount')) || 0)
const captchaText = ref('')
const captchaInput = ref('')
const captchaId = ref('')
const showCaptcha = computed(() => failedCount.value >= 3)

const loginForm = reactive({
  username: '',
  password: ''
})

const loginDisabled = computed(() => {
  if (loading.value) return true
  if (!showCaptcha.value) return false
  return !/^\d{4}$/.test(captchaInput.value.trim())
})

const generateCaptcha = async () => {
  try {
    const res = await fetch('/api/auth/captcha')
    const data = await res.json()
    captchaId.value = data.id
    captchaText.value = data.imageUrl
    captchaInput.value = ''
  } catch (e) {
    showFailToast('获取验证码失败，请稍后重试')
  }
}

watch(showCaptcha, {
  immediate: true,
  handler: (val) => {
    if (val) {
      generateCaptcha()
    } else {
      captchaId.value = ''
      captchaText.value = ''
      captchaInput.value = ''
    }
  }
})

watch(failedCount, (val) => {
  localStorage.setItem('loginFailedCount', String(val))
})

onMounted(() => {
  if (showCaptcha.value) {
    generateCaptcha()
  }
})

const handleLogin = async () => {
  loading.value = true
  try {
    if (!loginForm.username) {
      showFailToast('请输入用户名')
      loading.value = false
      return
    }
    if (!loginForm.password) {
      showFailToast('请输入密码')
      loading.value = false
      return
    }
    if (showCaptcha.value && captchaInput.value.trim().length !== 4) {
      showFailToast('请输入4位验证码')
      loading.value = false
      return
    }
    const payload = {
      ...loginForm,
      captchaId: showCaptcha.value ? captchaId.value : undefined,
      captchaCode: showCaptcha.value ? captchaInput.value : undefined
    }
    await userStore.login(payload)
    showSuccessToast('登录成功')
    failedCount.value = 0
    localStorage.setItem('loginFailedCount', '0')
    captchaInput.value = ''
    captchaId.value = ''
    router.push('/home')
  } catch (error) {
    const msg = error?.response?.data?.error || '用户名或密码错误'
    showFailToast(msg)
    failedCount.value += 1
    if (showCaptcha.value) {
      generateCaptcha()
    }
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

.captcha-img {
  height: 32px;
  cursor: pointer;
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
