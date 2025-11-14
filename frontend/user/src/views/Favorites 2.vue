<template>
  <div class="favorites-page">
    <!-- 类型切换 -->
    <div class="type-tabs">
      <van-tabs v-model:active="activeType" @change="handleTypeChange">
        <van-tab title="通知" name="policy" />
        <van-tab title="活动" name="activity" />
      </van-tabs>
    </div>

    <!-- 收藏列表 -->
    <van-loading v-if="loading" class="loading" />

    <div v-else-if="favorites.length === 0" class="empty-state">
      <van-empty description="暂无收藏">
        <van-button type="primary" size="small" @click="$router.push('/activities')">
          去浏览活动
        </van-button>
      </van-empty>
    </div>

    <div v-else class="favorites-list">
      <!-- 政策收藏 -->
      <template v-if="filteredPolicies.length > 0">
        <div class="section-title">通知</div>
        <div
          v-for="item in filteredPolicies"
          :key="`policy-${item.id}`"
          class="favorite-item"
          @click="goToPolicy(item.detail.id)"
        >
          <div class="item-content">
            <div class="item-header">
              <van-icon name="description" class="item-icon" />
              <div class="item-title">{{ item.detail.title }}</div>
              <van-button
                class="delete-button"
                icon="delete"
                type="danger"
                plain
                size="small"
                @click.stop="removeFavorite(item.id)"
              />
            </div>
            <div class="item-description" v-if="item.detail.description">
              {{ item.detail.description.slice(0, 100) }}{{ item.detail.description.length > 100 ? '...' : '' }}
            </div>
            <div class="item-meta">
              <span class="item-date">收藏于 {{ formatDate(item.createdAt) }}</span>
            </div>
          </div>
        </div>
      </template>

      <!-- 活动收藏 -->
      <template v-if="filteredActivities.length > 0">
        <div class="section-title">活动</div>
        <div
          v-for="item in filteredActivities"
          :key="`activity-${item.id}`"
          class="favorite-item"
          @click="goToActivity(item.detail.id)"
        >
          <div class="item-content">
            <div class="item-header">
              <van-icon name="calendar" class="item-icon" />
              <div class="item-title">{{ item.detail.name }}</div>
              <van-button
                class="delete-button"
                icon="delete"
                type="danger"
                plain
                size="small"
                @click.stop="removeFavorite(item.id)"
              />
            </div>
            <div class="item-description" v-if="item.detail.description">
              {{ item.detail.description.slice(0, 100) }}{{ item.detail.description.length > 100 ? '...' : '' }}
            </div>
            <div class="item-meta">
              <span class="item-location">{{ item.detail.location }}</span>
              <span class="item-date">{{ formatActivityTime(item.detail.time) }}</span>
              <span class="item-date">收藏于 {{ formatDate(item.createdAt) }}</span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showSuccessToast, showConfirmDialog } from 'vant'
import request from '@/api/request'

const router = useRouter()

const activeType = ref('policy')
const loading = ref(false)
const favorites = ref([])

// 根据类型过滤收藏
const filteredPolicies = computed(() => {
  return favorites.value.filter(item => item.targetType === 'policy')
})

const filteredActivities = computed(() => {
  return favorites.value.filter(item => item.targetType === 'activity')
})

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// 格式化活动时间
const formatActivityTime = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 加载收藏数据
const loadFavorites = async () => {
  loading.value = true
  try {
    const params = { type: activeType.value }
    const response = await request.get('/favorites', { params })
    favorites.value = response.data || []
  } catch (error) {
    console.error('获取收藏列表失败:', error)
    showToast('获取收藏列表失败')
  } finally {
    loading.value = false
  }
}

// 切换类型
const handleTypeChange = () => {
  loadFavorites()
}

// 跳转到政策详情
const goToPolicy = (policyId) => {
  router.push(`/policy/${policyId}`)
}

// 跳转到活动详情
const goToActivity = (activityId) => {
  router.push(`/activity/${activityId}`)
}

// 取消收藏
const removeFavorite = async (favoriteId) => {
  try {
    await showConfirmDialog({
      title: '确认取消收藏',
      message: '确定要取消收藏这个内容吗？',
    })

    await request.delete(`/favorites/${favoriteId}`)
    showSuccessToast('取消收藏成功')

    // 重新加载数据
    loadFavorites()
  } catch (error) {
    if (error.message !== 'cancel') {
      console.error('取消收藏失败:', error)
      showToast('取消收藏失败')
    }
  }
}

onMounted(() => {
  loadFavorites()
})
</script>

<style scoped>
.favorites-page {
  min-height: 100vh;
  background-color: #f7f8fa;
  padding-bottom: 60px;
}

.type-tabs {
  background: white;
  margin-bottom: 8px;
}

.loading {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

.empty-state {
  padding: 40px 0;
  text-align: center;
}

.favorites-list {
  padding: 0 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #323233;
  margin: 16px 0 8px 0;
  padding-left: 4px;
}

.favorite-item {
  background: white;
  border-radius: 8px;
  margin-bottom: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s;
}

.favorite-item:active {
  transform: scale(0.98);
}

.item-content {
  padding: 16px;
}

.item-header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
}

.item-icon {
  color: #1989fa;
  font-size: 18px;
  margin-top: 2px;
}

.item-title {
  flex: 1;
  font-size: 16px;
  font-weight: 500;
  color: #323233;
  line-height: 1.4;
}

.delete-button {
  flex-shrink: 0;
}

.item-description {
  font-size: 14px;
  color: #646566;
  line-height: 1.5;
  margin-bottom: 8px;
}

.item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  color: #969799;
}

.item-location {
  display: flex;
  align-items: center;
  gap: 4px;
}

.item-date {
  color: #969799;
}
</style>