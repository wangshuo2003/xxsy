<template>
  <div class="achievement-detail">
    <div v-if="loading" class="loading">
      <van-loading size="24px" vertical>加载中...</van-loading>
    </div>

    <div v-else-if="achievement" class="achievement-content">
      <!-- 成果封面图片 -->
      <div class="achievement-cover">
        <img :src="achievement.coverImage || '/images/default-achievement.jpg'" :alt="achievement.title" />
      </div>

      <!-- 成果基本信息 -->
      <div class="achievement-header">
        <h1 class="achievement-title">{{ achievement.title }}</h1>
        <div class="achievement-meta">
          <span class="achievement-date">{{ formatDate(achievement.createdAt) }}</span>
          <van-tag v-if="achievement.tags" type="primary" size="small">
            {{ achievement.tags }}
          </van-tag>
        </div>
      </div>

      <!-- 成果详细描述 -->
      <div class="achievement-body">
        <div class="achievement-description" v-html="formatContent(achievement.content)"></div>

        <!-- 视频内容 -->
        <div v-if="achievement.videoUrl" class="achievement-video">
          <h3>展示视频</h3>
          <video :src="achievement.videoUrl" controls style="width: 100%; max-height: 300px;"></video>
        </div>

        <!-- 附件下载 -->
        <div v-if="achievement.fileUrl" class="achievement-file">
          <h3>相关资料</h3>
          <van-button type="primary" block @click="downloadFile">
            <van-icon name="description" />
            下载资料
          </van-button>
        </div>
      </div>

      <!-- 点赞和分享 -->
      <div class="achievement-actions">
        <van-button
          :type="isLiked ? 'danger' : 'default'"
          icon="good-job"
          @click="toggleLike"
        >
          {{ isLiked ? '已点赞' : '点赞' }}
        </van-button>
        <van-button
          type="primary"
          icon="share"
          @click="shareAchievement"
        >
          分享
        </van-button>
      </div>
    </div>

    <div v-else class="error">
      <van-empty description="成果不存在或已被删除" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { showToast, showSuccessToast } from 'vant'
import request from '@/api/request'

const route = useRoute()

const loading = ref(true)
const achievement = ref(null)
const isLiked = ref(false)

const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

const formatContent = (content) => {
  if (!content) return ''
  return content.replace(/\n/g, '<br>')
}

const downloadFile = () => {
  if (achievement.value.fileUrl) {
    window.open(achievement.value.fileUrl, '_blank')
  }
}

const toggleLike = () => {
  isLiked.value = !isLiked.value
  showSuccessToast(isLiked.value ? '点赞成功' : '取消点赞')
}

const shareAchievement = () => {
  showToast('分享功能正在开发中，敬请期待')
}

const loadAchievement = async () => {
  try {
    const achievementId = route.params.id
    const response = await request.get(`/achievements/${achievementId}`)
    achievement.value = response.data
  } catch (error) {
    showToast('加载失败')
    console.error('加载成果详情失败:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadAchievement()
})
</script>

<style scoped>
.achievement-detail {
  min-height: 100vh;
  background-color: #f7f8fa;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 300px;
}

.achievement-content {
  background: white;
  margin: 12px;
  border-radius: 8px;
  overflow: hidden;
}

.achievement-cover {
  height: 200px;
  overflow: hidden;
}

.achievement-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.achievement-header {
  padding: 20px;
  border-bottom: 1px solid #ebedf0;
}

.achievement-title {
  margin: 0 0 12px 0;
  font-size: 20px;
  font-weight: 600;
  color: #323233;
  line-height: 1.4;
}

.achievement-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  color: #969799;
}

.achievement-body {
  padding: 20px;
}

.achievement-description {
  font-size: 16px;
  line-height: 1.8;
  color: #323233;
  margin-bottom: 24px;
}

.achievement-video,
.achievement-file {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #ebedf0;
}

.achievement-video h3,
.achievement-file h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #323233;
}

.achievement-actions {
  display: flex;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid #ebedf0;
}

.achievement-actions .van-button {
  flex: 1;
}

.error {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 300px;
}
</style>
