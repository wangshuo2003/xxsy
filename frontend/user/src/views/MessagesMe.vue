<template>
  <div class="me-page">
    <van-nav-bar title="我的信息" left-arrow @click-left="goBack" />

    <div v-if="loading" class="loading">
      <van-loading size="20px">加载中...</van-loading>
    </div>

    <div v-else class="content">
      <div class="user-card">
        <div class="avatar">
          <van-image :src="user?.avatar || fallback" round width="70" height="70" fit="cover" />
        </div>
        <div class="info">
          <div class="name">{{ user?.name || '未填写' }}</div>
          <div class="id">ID：{{ user?.username || '未知' }}</div>
          <div class="phone">手机号：{{ user?.phone || '未填写' }}</div>
        </div>
      </div>

      <van-cell-group inset>
        <van-cell title="姓名" :value="user?.name || '未填写'" is-link @click="goEdit('name')" />
        <van-cell title="ID" :value="user?.username || '未填写'" is-link @click="goEdit('username')" />
        <van-cell title="年龄" :value="user?.age ?? '未填写'" is-link @click="goEdit('age')" />
        <van-cell title="手机号" :value="user?.phone || '未填写'" is-link @click="goEdit('phone')" />
        <van-cell title="个性签名" :value="user?.signature || '未填写'" is-link @click="goEdit('signature')" />
      </van-cell-group>

      <div class="actions">
        <van-button type="primary" block round @click="goEdit('all')">编辑信息</van-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { getBingFallback } from '@/utils/bingFallback'

const router = useRouter()
const userStore = useUserStore()
const loading = ref(true)
const user = ref(null)
const fallback = getBingFallback()

const fetchUser = async () => {
  try {
    if (!userStore.user) {
      await userStore.getUserInfo()
    }
    user.value = userStore.user
  } catch (e) {
    console.error('加载用户信息失败', e)
  } finally {
    loading.value = false
  }
}

onMounted(fetchUser)

const goBack = () => {
  router.replace({ path: '/messages', query: { tab: 'more' } })
}

const goEdit = (field) => {
  router.push({ path: `/messages/me/edit/${field}` })
}
</script>

<style scoped>
.me-page {
  min-height: 100vh;
  background: #f7f8fa;
}

.loading {
  padding: 32px;
  text-align: center;
}

.content {
  padding: 12px;
}

.user-card {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
  align-items: center;
  margin-bottom: 12px;
}

.avatar {
  flex-shrink: 0;
}

.info .name {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 4px;
}

.info .id,
.info .phone {
  font-size: 13px;
  color: #666;
}

.actions {
  margin-top: 16px;
}
</style>
