<template>
  <div class="policies-page">
    <!-- 政策列表 -->
    <div class="policies-list">
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
    </div>

    <!-- 分页 -->
    <div v-if="totalPages > 1" class="policies-pagination">
      <van-button size="small" :disabled="pagination.page <= 1" @click="handleGoToFirst">首页</van-button>
      <van-button size="small" :disabled="pagination.page <= 1" @click="handlePrevPage">上一页</van-button>
      <span class="page-info">第 {{ pagination.page }} / {{ totalPages }} 页</span>
      <van-button size="small" :disabled="pagination.page >= totalPages" @click="handleNextPage">下一页</van-button>
      <van-button size="small" :disabled="pagination.page >= totalPages" @click="handleGoToLast">末页</van-button>
      <div class="jump-section">
        <van-field
          v-model="jumpPageInput"
          type="digit"
          placeholder="页码"
          class="jump-input"
          maxlength="4"
          @keyup.enter="handleJumpPage"
        />
        <van-button size="small" type="primary" @click="handleJumpPage">跳转</van-button>
      </div>
    </div>
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
const favoriteMap = ref({}) // 存储收藏状态和ID的映射
const jumpPageInput = ref('')

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

const fetchPolicies = async () => {
  try {
    loading.value = true

    const params = {
      page: pagination.page,
      limit: pagination.limit,
      isActive: true // 只获取已发布的政策
    }

    const response = await axios.get('/api/policies', { params })

    policies.value = response.data.data
    pagination.total = response.data.pagination.total

    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' })

    // 加载后检查收藏状态
    await loadFavoriteStatus()
  } catch (error) {
    console.error('获取政策列表失败:', error)
    policies.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

const totalPages = computed(() => Math.max(1, Math.ceil((pagination.total || 0) / pagination.limit)))

const handlePrevPage = () => {
  if (pagination.page <= 1) return
  pagination.page -= 1
  fetchPolicies()
}

const handleNextPage = () => {
  if (pagination.page >= totalPages.value) return
  pagination.page += 1
  fetchPolicies()
}

const handleGoToFirst = () => {
  if (pagination.page === 1) return
  pagination.page = 1
  fetchPolicies()
}

const handleGoToLast = () => {
  if (pagination.page === totalPages.value) return
  pagination.page = totalPages.value
  fetchPolicies()
}

const handleJumpPage = () => {
  const target = parseInt(jumpPageInput.value, 10)
  if (Number.isNaN(target)) {
    showToast('请输入正确的页码')
    return
  }
  const normalized = Math.min(Math.max(1, target), totalPages.value)
  if (normalized === pagination.page) return
  pagination.page = normalized
  fetchPolicies()
  jumpPageInput.value = ''
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



const goToDetail = (policyId) => {
  router.push(`/policy/${policyId}`)
}

onMounted(() => {
  fetchPolicies()
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

.policies-pagination {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background-color: #fff;
  margin-top: 16px;
}

.policies-pagination .page-info {
  font-size: 14px;
  color: #666;
}

.jump-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.jump-input {
  width: 80px;
  padding: 0 8px;
}
</style>