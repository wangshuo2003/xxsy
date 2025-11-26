<template>
  <div class="policy-detail">
    <div v-if="loading" class="loading">
      <van-loading size="24px" vertical>加载中...</van-loading>
    </div>

    <div v-else-if="policy" class="policy-content">
      <div class="policy-header">
        <h1 class="policy-title">{{ policy.title }}</h1>
        <div class="policy-meta">
          <van-tag type="primary" size="small">{{ formatTags(policy.tags) }}</van-tag>
          <span class="policy-date">{{ formatDate(policy.createdAt) }}</span>
          <van-button
            class="favorite-button"
            :class="{ 'favorited': isFavorited }"
            plain
            size="small"
            @click="toggleFavorite"
            :loading="favoriteLoading"
          >
            {{ isFavorited ? '已收藏' : '收藏' }}
          </van-button>
        </div>
      </div>

      <div class="policy-body">
        <div class="policy-description" v-html="formatContent(policy.content)"></div>

        <div v-if="policy.videoUrl" class="policy-video">
          <h3>相关视频</h3>
          <video :src="policy.videoUrl" controls style="width: 100%; max-height: 300px;"></video>
        </div>

        <div v-if="policy.fileUrl" class="policy-file">
          <h3>附件下载</h3>
          <van-button type="primary" block @click="downloadFile">
            <van-icon name="description" />
            下载附件
          </van-button>
        </div>
      </div>
    </div>

    <div v-else class="error">
      <van-empty description="政策通知不存在或已被删除" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast, showSuccessToast } from 'vant'
import request from '@/api/request'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const loading = ref(true)
const policy = ref(null)
const isFavorited = ref(false)
const favoriteLoading = ref(false)

const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

const formatTags = (tags) => {
  if (!tags) return '政策通知'
  return tags.split(',').map(tag => tag.trim()).join(' · ')
}

const formatContent = (content) => {
  if (!content) return ''
  return content.replace(/\n/g, '<br>')
}

const downloadFile = () => {
  if (policy.value.fileUrl) {
    window.open(policy.value.fileUrl, '_blank')
  }
}

// 检查收藏状态
const checkFavoriteStatus = async () => {
  if (!userStore.isLoggedIn || !userStore.token) return

  try {
    if (policy.value) {
      const response = await request.get('/favorites/check', {
        params: {
          targetType: 'policy',
          targetId: policy.value.id
        }
      })
      isFavorited.value = response.isFavorited
    }
  } catch (error) {
    console.error('检查收藏状态失败:', error)
  }
}

// 切换收藏状态
const toggleFavorite = async () => {
  if (!policy.value) return

  if (!userStore.isLoggedIn || !userStore.token) {
    showToast('请先登录后再收藏')
    router.push('/login')
    return
  }

  favoriteLoading.value = true
  try {
    if (isFavorited.value) {
      // 取消收藏 - 需要先获取收藏ID
      const response = await request.get('/favorites/check', {
        params: {
          targetType: 'policy',
          targetId: policy.value.id
        }
      })

      if (response.favoriteId) {
        await request.delete(`/favorites/${response.favoriteId}`)
        showSuccessToast('已取消收藏')
        isFavorited.value = false
      }
    } else {
      // 添加收藏
      await request.post('/favorites', {
        targetType: 'policy',
        targetId: policy.value.id
      })
      showSuccessToast('收藏成功')
      isFavorited.value = true
    }
  } catch (error) {
    console.error('收藏操作失败:', error)
    showToast('操作失败，请重试')
  } finally {
    favoriteLoading.value = false
  }
}

const loadPolicy = async () => {
  try {
    const policyId = route.params.id
    const response = await request.get(`/policies/${policyId}`)
    policy.value = response.data

    // 加载政策后检查收藏状态
    await checkFavoriteStatus()
  } catch (error) {
    showToast('加载失败')
    console.error('加载政策详情失败:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadPolicy()
})
</script>

<style scoped>
.policy-detail {
  min-height: 100vh;
  background-color: #f7f8fa;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 300px;
}

.policy-content {
  background: white;
  margin: 12px;
  border-radius: 8px;
  overflow: hidden;
}

.policy-header {
  padding: 20px;
  border-bottom: 1px solid #ebedf0;
}

.policy-title {
  margin: 0 0 12px 0;
  font-size: 20px;
  font-weight: 600;
  color: #323233;
  line-height: 1.4;
}

.policy-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  color: #969799;
}

.policy-body {
  padding: 20px;
}

.policy-description {
  font-size: 16px;
  line-height: 1.8;
  color: #323233;
  margin-bottom: 24px;
}

.policy-video,
.policy-file {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #ebedf0;
}

.policy-video h3,
.policy-file h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #323233;
}

.error {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 300px;
}

.favorite-button {
  transition: all 0.3s ease;
}

.favorite-button:active {
  transform: scale(0.95);
}

.favorite-button.favorited {
  background-color: #ffd21d !important;
  color: #323233 !important;
  border-color: #ffd21d !important;
}
</style>
