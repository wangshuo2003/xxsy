<template>
  <div class="register">
    <van-nav-bar
      title="用户注册"
      left-arrow
      @click-left="$router.go(-1)"
    />

    <div class="register-form">
      <van-form @submit="handleRegister">
        <van-cell-group inset>
          <van-field
            v-model="form.name"
            name="name"
            label="姓名"
            placeholder="请输入学生姓名"
            :rules="[{ required: true, message: '请输入学生姓名' }]"
          />
          <van-field
            v-model="form.grade"
            name="grade"
            label="年级"
            placeholder="请输入年级"
            :rules="[{ required: true, message: '请输入年级' }]"
          />
          <van-field
            v-model="form.school"
            name="school"
            label="学校全称"
            placeholder="请输入学校全称"
            :rules="[{ required: true, message: '请输入学校全称' }]"
          />
          <van-field
            v-model="form.phone"
            name="phone"
            label="家长手机号"
            type="tel"
            placeholder="请输入家长手机号"
            :rules="[
              { required: true, message: '请输入家长手机号' },
              {
                pattern: /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/,
                message: '请输入有效的手机号（3-20位）'
              },
              {
                validator: (val) => val.trim().length >= 3 && val.trim().length <= 20,
                message: '手机号长度应在3-20个字符之间'
              }
            ]"
          />
          <van-field
            v-model="form.password"
            type="password"
            name="password"
            label="密码"
            placeholder="请设置登录密码"
            :rules="[
              { required: true, message: '请设置登录密码' }
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

        <div class="register-btn">
          <van-button round block type="primary" native-type="submit" :loading="loading">
            注册
          </van-button>
        </div>
      </van-form>

      <div class="login-link">
        已有账号？
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
import axios from 'axios'

const router = useRouter()
const loading = ref(false)

const form = reactive({
  name: '',
  grade: '',
  school: '',
  phone: '',
  password: '',
  confirmPassword: ''
})

// 验证确认密码
const validateConfirmPassword = () => {
  return form.password === form.confirmPassword
}

// 处理注册
const handleRegister = async () => {
  loading.value = true
  try {
    const { confirmPassword, ...registerData } = form
    await axios.post('/api/auth/register', {
      ...registerData,
      username: registerData.phone, // 使用手机号作为用户名
      role: 'STUDENT'
    })
    showSuccessToast('注册成功')
    router.push('/login')
  } catch (error) {
    showToast(error.response?.data?.error || '注册失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.register {
  min-height: 100vh;
  background-color: #f7f8fa;
}

.register-form {
  padding: 20px 16px;
}

.register-btn {
  margin: 30px 16px 16px;
}

.login-link {
  text-align: center;
  margin-top: 20px;
  color: #666;
  font-size: 14px;
}
</style>