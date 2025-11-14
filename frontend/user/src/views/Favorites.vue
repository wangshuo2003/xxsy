<template>
  <div class="favorites-page">
    <div class="type-tabs">
      <van-tabs v-model:active="activeType" @change="handleTypeChange">
        <van-tab title="活动" name="activity" />
        <van-tab title="通知" name="policy" />
      </van-tabs>
    </div>

    <van-loading v-if="loading" class="loading" />

    <div v-else-if="favorites.length === 0" class="empty-state">
      <van-empty :description="emptyDescription">
        <van-button type="primary" size="small" @click="goToRecommendations">
          {{ emptyButtonText }}
        </van-button>
      </van-empty>
    </div>

    <div v-else class="favorites-list">
      <template v-if="activeType === 'policy'">
        <div
          v-for="item in favorites"
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
            <div class="item-description" v-if="item.detail.content">
              {{ item.detail.content.slice(0, 100) }}{{ item.detail.content.length > 100 ? '...' : '' }}
            </div>
            <div class="item-meta">
              <span class="item-date">收藏于 {{ formatDate(item.createdAt) }}</span>
            </div>
          </div>
        </div>
      </template>

      <template v-else>
        <div
          v-for="item in favorites"
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
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showToast, showSuccessToast, showConfirmDialog } from 'vant'
import request from '@/api/request'

const props = defineProps({
  initialType: {
    type: String,
    default: 'activity',
    validator: (value) => ['activity', 'policy'].includes(value)
  }
})

const router = useRouter()
const route = useRoute()

const routeType = computed(() =>
  route.path.includes('policies') ? 'policy' : 'activity'
)
const activeType = ref(routeType.value || props.initialType || 'activity')
const loading = ref(false)
const favorites = ref([])

const emptyDescription = computed(() =>
  activeType.value === 'activity' ? '暂无活动收藏' : '暂无通知收藏'
)
const emptyButtonText = computed(() =>
  activeType.value === 'activity' ? '去浏览活动' : '去浏览通知'
)

const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

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

const loadFavorites = async () => {
  loading.value = true
  try {
    const response = await request.get('/favorites', {
      params: { type: activeType.value }
    })
    favorites.value = response.data || []
  } catch (error) {
    console.error('获取收藏列表失败:', error)
    showToast('获取收藏列表失败')
  } finally {
    loading.value = false
  }
}

const handleTypeChange = (name) => {
  const current = routeType.value
  if (name === current) return
  router.replace(name === 'activity' ? '/favorites/activities' : '/favorites/policies')
}

const goToPolicy = (policyId) => {
  router.push(`/policy/${policyId}`)
}

const goToActivity = (activityId) => {
  router.push(`/activity/${activityId}`)
}

const goToRecommendations = () => {
  router.push(activeType.value === 'activity' ? '/activities' : '/policies')
}

const removeFavorite = async (favoriteId) => {
  try {
    await showConfirmDialog({
      title: '确认取消收藏',
      message: '确定要取消收藏这个内容吗？'
    })

    await request.delete(`/favorites/${favoriteId}`)
    showSuccessToast('取消收藏成功')
    loadFavorites()
  } catch (error) {
    if (error.message !== 'cancel') {
      console.error('取消收藏失败:', error)
      showToast('取消收藏失败')
    }
  }
}

const scrollToTop = () => {
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }
}

onMounted(() => {
  loadFavorites().then(scrollToTop)
})

watch(routeType, (type, prev) => {
  if (type !== prev) {
    activeType.value = type
    loadFavorites().then(scrollToTop)
  }
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
  position: sticky;
  top: 0;
  z-index: 10;
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
