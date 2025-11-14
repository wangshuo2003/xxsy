<template>
  <div class="forgot-password">
    <van-nav-bar
      title="忘记密码"
      left-arrow
      @click-left="$router.go(-1)"
    />

    <div class="forgot-form">
      <van-form @submit="handleSubmit">
        <van-cell-group inset>
          <van-field
            v-model="form.phone"
            name="phone"
            label="手机号"
            type="tel"
            placeholder="请输入手机号"
            :rules="[
              { required: true, message: '请输入手机号' },
              { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' }
            ]"
          />
          <van-field
            v-model="form.code"
            center
            clearable
            label="验证码"
            placeholder="请输入验证码"
            :rules="[{ required: true, message: '请输入验证码' }]"
          >
            <template #button>
              <van-button
                size="small"
                type="primary"
                :disabled="countdown > 0"
                @click="sendCode"
              >
                {{ countdown > 0 ? `${countdown}s后重试` : '发送验证码' }}
              </van-button>
            </template>
          </van-field>
          <van-field
            v-model="form.password"
            type="password"
            name="password"
            label="新密码"
            placeholder="请设置新密码"
            :rules="[
              { required: true, message: '请设置新密码' }
            ]"
          />
          <van-field
            v-model="form.confirmPassword"
            type="password"
            name="confirmPassword"
            label="确认密码"
            placeholder="请再次输入密码"
            :rules="[
              { required: true, message: '请再次输入密码' },
              { validator: validateConfirmPassword }
            ]"
          />
        </van-cell-group>

        <div class="submit-btn">
          <van-button round block type="primary" native-type="submit" :loading="loading">
            重置密码
          </van-button>
        </div>
      </van-form>

      <div class="login-link">
        记起密码了？
        <van-button type="primary" plain size="mini" @click="$router.push('/login')">
          立即登录
        </van-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showSuccessToast } from 'vant'

const router = useRouter()
const loading = ref(false)
const countdown = ref(0)

const form = reactive({
  phone: '',
  code: '',
  password: '',
  confirmPassword: ''
})

// 验证确认密码
const validateConfirmPassword = () => {
  return form.password === form.confirmPassword
}

// 发送验证码
const sendCode = async () => {
  if (!form.phone) {
    showToast('请输入手机号')
    return
  }

  if (!/^1[3-9]\d{9}$/.test(form.phone)) {
    showToast('请输入正确的手机号')
    return
  }

  try {
    // 模拟发送验证码
    showToast('验证码已发送')
    countdown.value = 60
    const timer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) {
        clearInterval(timer)
      }
    }, 1000)
  } catch (error) {
    showToast('发送失败，请重试')
  }
}

// 提交重置密码
const handleSubmit = async () => {
  loading.value = true
  try {
    // 这里应该调用后端API验证验证码并重置密码
    // 暂时模拟成功
    showSuccessToast('密码重置成功')
    router.push('/login')
  } catch (error) {
    showToast('重置失败，请重试')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.forgot-password {
  min-height: 100vh;
  background-color: #f7f8fa;
}

.forgot-form {
  padding: 20px 16px;
}

.submit-btn {
  margin: 30px 16px 16px;
}

.login-link {
  text-align: center;
  margin-top: 20px;
  color: #666;
  font-size: 14px;
}
</style>