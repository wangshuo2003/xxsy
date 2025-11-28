<template>
  <div class="add-contact">
    <van-nav-bar title="添加联系人" left-arrow @click-left="handleBack" />

    <van-form @submit="handleSubmit">
      <van-cell-group inset>
        <van-field
          v-model="userId"
          label="用户ID"
          placeholder="输入对方用户ID"
          required
          :rules="[{ required: true, message: '请输入用户ID' }]"
        />
        <van-field
          v-model="alias"
          label="备注"
          placeholder="可选，填写昵称/备注"
        />
      </van-cell-group>
      <div class="btn-wrap">
        <van-button round block type="primary" native-type="submit" :loading="loading">
          添加
        </van-button>
      </div>
    </van-form>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from 'axios'
import { showToast } from 'vant'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const userId = ref('')
const alias = ref('')
const loading = ref(false)

const handleBack = () => router.back()

onMounted(() => {
  if (route.query.prefill) {
    userId.value = route.query.prefill
  }
})

const handleSubmit = async () => {
  if (!userId.value.trim()) return
  loading.value = true
  const payload = { toUser: userId.value.trim(), message: alias.value.trim() || undefined }
  const headers = userStore.token ? { Authorization: `Bearer ${userStore.token}` } : {}
  try {
    await axios.post('/api/messages/requests', payload, { headers })
    showToast('已发送好友申请')
    router.back()
  } catch (e) {
    console.error('添加联系人失败', e)
    showToast(e.response?.data?.error || '添加失败')
    router.back()
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.add-contact {
  min-height: 100vh;
  background: #f7f8fa;
  padding-bottom: 24px;
}

.btn-wrap {
  padding: 16px 20px;
}
</style>
