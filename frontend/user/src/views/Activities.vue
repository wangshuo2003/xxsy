<template>
  <div class="activities-page">
    <div class="activities-content">
      <!-- 活动类型标签 -->
      <van-tabs v-model:active="activeTab" @change="onTabChange" sticky>
        <van-tab title="赛事" name="赛事">
          <ActivityList :activities="filteredActivities" :loading="loading" :has-more="false" :infinite="false" @refresh="refreshActivities" />
          <div v-if="totalPages > 1" class="activities-pagination">
            <van-button size="small" :disabled="page <= 1" @click="handleGoToFirst">首页</van-button>
            <van-button size="small" :disabled="page <= 1" @click="handlePrevPage">上一页</van-button>
            <span class="page-info">第 {{ page }} / {{ totalPages }} 页</span>
            <van-button size="small" :disabled="page >= totalPages" @click="handleNextPage">下一页</van-button>
            <van-button size="small" :disabled="page >= totalPages" @click="handleGoToLast">末页</van-button>
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
        </van-tab>
        <van-tab title="研学" name="研学">
          <ActivityList :activities="filteredActivities" :loading="loading" :has-more="false" :infinite="false" @refresh="refreshActivities" />
          <div v-if="totalPages > 1" class="activities-pagination">
            <van-button size="small" :disabled="page <= 1" @click="handleGoToFirst">首页</van-button>
            <van-button size="small" :disabled="page <= 1" @click="handlePrevPage">上一页</van-button>
            <span class="page-info">第 {{ page }} / {{ totalPages }} 页</span>
            <van-button size="small" :disabled="page >= totalPages" @click="handleNextPage">下一页</van-button>
            <van-button size="small" :disabled="page >= totalPages" @click="handleGoToLast">末页</van-button>
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
        </van-tab>
        <van-tab title="实践" name="实践">
          <ActivityList :activities="filteredActivities" :loading="loading" :has-more="false" :infinite="false" @refresh="refreshActivities" />
          <div v-if="totalPages > 1" class="activities-pagination">
            <van-button size="small" :disabled="page <= 1" @click="handleGoToFirst">首页</van-button>
            <van-button size="small" :disabled="page <= 1" @click="handlePrevPage">上一页</van-button>
            <span class="page-info">第 {{ page }} / {{ totalPages }} 页</span>
            <van-button size="small" :disabled="page >= totalPages" @click="handleNextPage">下一页</van-button>
            <van-button size="small" :disabled="page >= totalPages" @click="handleGoToLast">末页</van-button>
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
        </van-tab>
        <van-tab title="公益" name="公益">
          <ActivityList :activities="filteredActivities" :loading="loading" :has-more="false" :infinite="false" @refresh="refreshActivities" />
          <div v-if="totalPages > 1" class="activities-pagination">
            <van-button size="small" :disabled="page <= 1" @click="handleGoToFirst">首页</van-button>
            <van-button size="small" :disabled="page <= 1" @click="handlePrevPage">上一页</van-button>
            <span class="page-info">第 {{ page }} / {{ totalPages }} 页</span>
            <van-button size="small" :disabled="page >= totalPages" @click="handleNextPage">下一页</van-button>
            <van-button size="small" :disabled="page >= totalPages" @click="handleGoToLast">末页</van-button>
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
        </van-tab>
      </van-tabs>
    </div>

    <div class="search-floating-btn">
      <van-button round type="primary" icon="search" @click="handleSearch">搜索</van-button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { useUserStore } from '@/stores/user'
import ActivityList from '../components/ActivityList.vue'
import { showToast } from 'vant'

const userStore = useUserStore()
const route = useRoute()
const router = useRouter()
const activeTab = ref('赛事')
const activities = ref([])
const userRegistrations = ref([]) // 用户报名的活动ID列表
const loading = ref(false)
const page = ref(1)
const pageSize = 10
const totalActivities = ref(0)
const jumpPageInput = ref('')
const hasMore = ref(false) // Keep for compatibility but not used for logic
const searchKeyword = ref('')
const categoryFilter = ref('all')
const appliedCategoryFilter = ref(null)
const filterOptions = [
  { text: '全部活动', value: 'all' },
  { text: '赛事', value: '赛事' },
  { text: '研学', value: '研学' },
  { text: '实践', value: '实践' },
  { text: '公益', value: '公益' }
]
const showFilterPicker = ref(false)
const filterActions = filterOptions.map(opt => ({ text: opt.text, value: opt.value }))
const currentFilterLabel = computed(() => {
  return filterOptions.find(opt => opt.value === categoryFilter.value)?.text || '全部活动'
})
// 始终展示加载按钮（有数据时），便于手动翻页；用 hasMore 控制禁用/文案
const showLoadMore = computed(() => filteredActivities.value.length > 0)

// 合并活动列表和报名状态
const filteredActivities = computed(() => {
  return activities.value.map(activity => {
    const userRegistration = userRegistrations.value.find(reg => reg.id === activity.id)
    return {
      ...activity,
      registrationStatus: userRegistration?.registrationStatus,
      registrationId: userRegistration?.registrationId,
      registeredAt: userRegistration?.registeredAt,
      order: userRegistration?.order || null
    }
  })
})

// 获取用户报名状态
const fetchUserRegistrations = async () => {
  if (!userStore.isLoggedIn) {
    userRegistrations.value = []
    return
  }

  try {
    const response = await axios.get('/api/activities/my-registrations', {
      params: {
        page: 1,
        limit: 1000  // 获取所有报名记录
      },
      headers: {
        'Authorization': `Bearer ${userStore.token}`
      }
    })

    userRegistrations.value = response.data.data || []
  } catch (error) {
    console.error('获取报名状态失败:', error)
    userRegistrations.value = []
  }
}

// 刷新活动列表
const refreshActivities = async () => {
  page.value = 1
  hasMore.value = true
  await Promise.all([
    fetchActivities(false),
    fetchUserRegistrations()
  ])
}

// 标签切换处理
const onTabChange = (name) => {
  activeTab.value = name
  appliedCategoryFilter.value = null
  // 更新URL查询参数
  router.replace({
    path: '/activities',
    query: { tab: name }
  })
  // 重置分页并加载新数据
  page.value = 1
  hasMore.value = true
  activities.value = []
  fetchActivities()
}

const totalPages = computed(() => Math.max(1, Math.ceil((totalActivities.value || 0) / pageSize)))

const handlePrevPage = () => {
  if (page.value <= 1) return
  page.value -= 1
  fetchActivities()
}

const handleNextPage = () => {
  if (page.value >= totalPages.value) return
  page.value += 1
  fetchActivities()
}

const handleGoToFirst = () => {
  if (page.value === 1) return
  page.value = 1
  fetchActivities()
}

const handleGoToLast = () => {
  if (page.value === totalPages.value) return
  page.value = totalPages.value
  fetchActivities()
}

const handleJumpPage = () => {
  const target = parseInt(jumpPageInput.value, 10)
  if (Number.isNaN(target)) {
    showToast('请输入正确的页码')
    return
  }
  const normalized = Math.min(Math.max(1, target), totalPages.value)
  if (normalized === page.value) return
  page.value = normalized
  fetchActivities()
  jumpPageInput.value = ''
}

const loadMore = () => {
  // Deprecated
}

const handleSearch = () => {
  router.push({
    path: '/activities/search',
    query: {
      keyword: searchKeyword.value || '',
      filter: categoryFilter.value || 'all'
    }
  })
}

// 获取活动数据
const fetchActivities = async () => {
  if (loading.value) return

  loading.value = true
  try {
    console.log('请求活动列表', {
      tab: activeTab.value,
      page: page.value,
      pageSize,
      appliedCategory: appliedCategoryFilter.value,
      activeTab: activeTab.value
    })
    const params = {
      page: page.value,
      limit: pageSize,
      isApproved: true, // 只显示已通过审核的活动
      search: searchKeyword.value || undefined
    }

    if (appliedCategoryFilter.value) {
      if (appliedCategoryFilter.value !== 'all') {
        params.type = appliedCategoryFilter.value
      }
    } else {
      params.type = activeTab.value
    }

    const response = await axios.get('/api/activities', { params })

    const newActivities = response.data.data || []
    const pagination = response.data.pagination || {}
    
    activities.value = newActivities
    totalActivities.value = pagination.total || newActivities.length

    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' })

  } catch (error) {
    console.error('获取活动列表失败:', error)
    activities.value = []
    totalActivities.value = 0
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  // 从URL查询参数中读取标签页状态
  const urlTab = route.query.tab
  if (urlTab && ['赛事', '研学', '实践', '公益'].includes(urlTab)) {
    activeTab.value = urlTab
  }
  console.log('页面初始化', { tab: activeTab.value })
  // 如果URL中没有指定标签页，使用默认的"赛事活动"

  await Promise.all([
    fetchActivities(),
    fetchUserRegistrations()
  ])
})
const onSelectFilter = (action) => {
  categoryFilter.value = action.value
  showFilterPicker.value = false
}
</script>

<style scoped>
.activities-page {
  min-height: 100vh;
  background-color: #f7f8fa;
  display: flex;
  flex-direction: column;
}

.activities-content {
  flex: 1;
}
.load-more-btn {
  flex: 1;
  margin-right: 8px;
}
.load-more-wrapper {
  padding: 12px 16px 0;
}

.search-floating-btn {
  position: fixed;
  right: 16px;
  bottom: calc(60px + env(safe-area-inset-bottom));
  z-index: 99;
}

.search-floating-btn .van-button {
  box-shadow: 0 2px 12px rgba(25, 137, 250, 0.4);
  padding: 0 20px;
  height: 44px;
}





:deep(.van-tabs__nav) {
  background-color: white;
}

:deep(.van-tab) {
  color: #666;
}

:deep(.van-tab--active) {
  color: #1989fa;
  font-weight: 600;
}

:deep(.van-tabs__line) {
  background-color: #1989fa;
}

.activities-pagination {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background-color: #fff;
}

.activities-pagination .page-info {
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
