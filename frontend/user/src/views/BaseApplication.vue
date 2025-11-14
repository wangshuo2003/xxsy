<template>
  <div class="base-application">
    <div class="application-content">
      <van-form @submit="handleSubmit">
        <van-cell-group inset>
          <van-field
            v-model="form.name"
            name="name"
            label="基地名称"
            placeholder="请输入基地名称"
            :rules="[{ required: true, message: '请输入基地名称' }]"
          />

          <van-field
            v-model="form.type"
            name="type"
            label="基地类型"
            placeholder="请选择基地类型"
            readonly
            is-link
            @click="showTypePicker = true"
            :rules="[{ required: true, message: '请选择基地类型' }]"
          />

          <van-field
            v-model="form.address"
            name="address"
            label="基地地址"
            placeholder="请输入详细地址"
            :rules="[{ required: true, message: '请输入基地地址' }]"
          />

          <van-field
            v-model="form.contact"
            name="contact"
            label="联系方式"
            placeholder="请输入联系电话"
            :rules="[{ required: true, message: '请输入联系方式' }]"
          />

          <van-field
            v-model="form.description"
            name="description"
            label="基地描述"
            type="textarea"
            placeholder="请详细描述基地情况、设施条件、特色服务等"
            :rows="6"
            maxlength="500"
            show-word-limit
            :rules="[{ required: true, message: '请输入基地描述' }]"
          />
        </van-cell-group>

        <!-- 申请说明 -->
        <div class="application-notice">
          <van-notice-bar
            left-icon="info"
            background="#e1f3d8"
            color="#67c23a"
          >
            申请提交后，我们将尽快审核，请耐心等待结果
          </van-notice-bar>
        </div>

        <!-- 提交按钮 -->
        <div class="submit-section">
          <van-button
            type="primary"
            block
            size="large"
            native-type="submit"
            :loading="submitting"
          >
            提交申请
          </van-button>
        </div>
      </van-form>
    </div>

    <!-- 基地类型选择器 -->
    <van-popup v-model:show="showTypePicker" position="bottom">
      <van-picker
        :columns="typeColumns"
        @confirm="onTypeConfirm"
        @cancel="showTypePicker = false"
      />
    </van-popup>
  </div>
</template>

<script setup>
import { ref, reactive, onBeforeMount } from 'vue'
import { useRouter } from 'vue-router'
import { showSuccessToast, showFailToast, showToast } from 'vant'
import { useUserStore } from '@/stores/user'
import request from '@/api/request'

const router = useRouter()
const userStore = useUserStore()

const submitting = ref(false)
const showTypePicker = ref(false)

const form = reactive({
  name: '',
  type: '',
  address: '',
  contact: '',
  description: ''
})

const typeColumns = [
  '教育实践基地',
  '研学基地',
  '实训基地',
  '创业基地',
  '其他'
]

const onTypeConfirm = ({ selectedValues }) => {
  form.type = selectedValues[0]
  showTypePicker.value = false
}

// 权限检查 - 学生用户不能申请基地
onBeforeMount(async () => {
  // 如果用户未登录，先获取用户信息
  if (!userStore.user) {
    try {
      await userStore.getUserInfo()
    } catch (error) {
      console.error('获取用户信息失败:', error)
    }
  }

  // 检查用户角色，如果是学生则跳转到首页
  if (userStore.userRole === 'STUDENT') {
    showToast('学生用户无权限访问此功能')
    router.replace('/home')
    return
  }
})

const handleSubmit = async () => {
  try {
    submitting.value = true

    await request.post('/bases/apply', form)

    showSuccessToast('基地申请提交成功，等待审核')

    // 重置表单
    Object.assign(form, {
      name: '',
      type: '',
      address: '',
      contact: '',
      description: ''
    })

    // 跳转到基地列表
    router.push('/bases')
  } catch (error) {
    showFailToast(error.response?.data?.error || '申请提交失败')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.base-application {
  min-height: 100vh;
  background-color: #f7f8fa;
}

.application-content {
  padding: 16px;
  padding-bottom: 100px;
}

.application-notice {
  margin: 16px 0;
}

.submit-section {
  margin-top: 24px;
}
</style>