<template>
  <div class="policies-page">
    <!-- 政策列表 -->
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="没有更多了"
        @load="onLoad"
      >
        <div
          v-for="policy in policies"
          :key="policy.id"
          class="policy-item"
        >
          <div class="policy-content" @click="goToDetail(policy.id)">
            <h3 class="policy-title">{{ policy.title }}</h3>
            <div class="policy-meta">
              <span class="policy-date">{{ formatDate(policy.createdAt) }}</span>
              <span v-if="policy.tags" class="policy-tags">{{ policy.tags }}</span>
            </div>
          </div>
          <div class="policy-actions">
            <van-button
              class="favorite-button"
              :class="{ 'favorited': getFavorited(policy.id) }"
              plain
              size="small"
              @click.stop="toggleFavorite(policy.id)"
            >
              {{ getFavorited(policy.id) ? '已收藏' : '收藏' }}
            </van-button>
            <van-icon name="arrow" class="arrow-icon" @click="goToDetail(policy.id)" />
          </div>
        </div>

        <!-- 空状态 -->
        <van-empty
          v-if="!loading && policies.length === 0"
          description="暂无政策通知"
          image="search"
        />
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showSuccessToast } from 'vant'
import axios from 'axios'
import request from '@/api/request'

const router = useRouter()

const policies = ref([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const favoriteMap = ref({}) // 存储收藏状态和ID的映射

const pagination = reactive({
  page: 1,
  limit: 10,
  total: 0
})

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

const getFavorited = (policyId) => {
  return favoriteMap.value[`policy_${policyId}`]?.isFavorited || false
}

const fetchPolicies = async (reset = false) => {
  try {
    if (reset) {
      pagination.page = 1
      policies.value = []
      finished.value = false
    }

    loading.value = true

    const params = {
      page: pagination.page,
      limit: pagination.limit,
      isActive: true // 只获取已发布的政策
    }

    const response = await axios.get('/api/policies', { params })

    if (reset) {
      policies.value = response.data.data
    } else {
      policies.value.push(...response.data.data)
    }

    pagination.total = response.data.pagination.total

    // 检查是否还有更多数据
    if (policies.value.length >= pagination.total) {
      finished.value = true
    }

    pagination.page++

    // 加载后检查收藏状态
    await loadFavoriteStatus()
  } catch (error) {
    console.error('获取政策列表失败:', error)
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

// 加载所有政策的收藏状态
const loadFavoriteStatus = async () => {
  try {
    for (const policy of policies.value) {
      const response = await request.get('/favorites/check', {
        params: {
          targetType: 'policy',
          targetId: policy.id
        }
      })
      const key = `policy_${policy.id}`
      favoriteMap.value[key] = {
        isFavorited: response.isFavorited,
        favoriteId: response.favoriteId
      }
    }
  } catch (error) {
    console.error('加载收藏状态失败:', error)
  }
}

const toggleFavorite = async (policyId) => {
  const key = `policy_${policyId}`
  const favoriteInfo = favoriteMap.value[key]
  const isFavorited = favoriteInfo?.isFavorited || false

  try {
    if (isFavorited) {
      // 取消收藏
      if (favoriteInfo?.favoriteId) {
        await request.delete(`/favorites/${favoriteInfo.favoriteId}`)
        favoriteMap.value[key] = {
          isFavorited: false,
          favoriteId: null
        }
        showSuccessToast('已取消收藏')
      }
    } else {
      // 添加收藏
      const response = await request.post('/favorites', {
        targetType: 'policy',
        targetId: policyId
      })
      favoriteMap.value[key] = {
        isFavorited: true,
        favoriteId: response.data.id
      }
      showSuccessToast('收藏成功')
    }
  } catch (error) {
    console.error('收藏操作失败:', error)
    showToast('操作失败，请重试')
  }
}

const onLoad = () => {
  fetchPolicies()
}

const onRefresh = () => {
  refreshing.value = true
  fetchPolicies(true)
}

const goToDetail = (policyId) => {
  router.push(`/policy/${policyId}`)
}

onMounted(() => {
  fetchPolicies(true)
})
</script>

<style scoped>
.policies-page {
  min-height: 100vh;
  background-color: #f7f8fa;
}

.policy-item {
  background: white;
  padding: 16px;
  border-bottom: 1px solid #ebedf0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: background-color 0.2s;
}

.policy-item:active {
  background-color: #f2f3f5;
}

.policy-content {
  flex: 1;
  margin-right: 12px;
  cursor: pointer;
}

.policy-title {
  font-size: 16px;
  font-weight: 500;
  color: #323233;
  margin: 0 0 8px 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.policy-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #969799;
}

.policy-tags {
  background: #f2f3f5;
  color: #646566;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.policy-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.favorite-icon {
  font-size: 20px;
  color: #969799;
  cursor: pointer;
  transition: all 0.3s ease;
}

.favorite-icon:active {
  transform: scale(0.9);
}

.favorite-icon.favorited {
  color: #ff6b6b;
}

.favorite-button {
  transition: all 0.3s ease;
}

.favorite-button.favorited {
  background-color: #ffd21d !important;
  color: #323233 !important;
  border-color: #ffd21d !important;
}

.arrow-icon {
  color: #c8c9cc;
  font-size: 16px;
  cursor: pointer;
}
</style>