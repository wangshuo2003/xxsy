<template>
  <div class="activities-page">
    <div class="activities-content">
      <!-- 活动类型标签 -->
      <van-tabs v-model:active="activeTab" @change="onTabChange" sticky>
        <van-tab title="赛事" name="赛事">
          <ActivityList :activities="filteredActivities" :loading="loading" @load-more="loadMore" @refresh="refreshActivities" />
        </van-tab>
        <van-tab title="研学" name="研学">
          <ActivityList :activities="filteredActivities" :loading="loading" @load-more="loadMore" @refresh="refreshActivities" />
        </van-tab>
        <van-tab title="实践" name="实践">
          <ActivityList :activities="filteredActivities" :loading="loading" @load-more="loadMore" @refresh="refreshActivities" />
        </van-tab>
        <van-tab title="公益" name="公益">
          <ActivityList :activities="filteredActivities" :loading="loading" @load-more="loadMore" @refresh="refreshActivities" />
        </van-tab>
      </van-tabs>
    </div>

    <div class="activities-search-bottom">
      <div class="search-row">
        <van-button type="primary" class="search-button" @click="handleSearch">搜索</van-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { useUserStore } from '@/stores/user'
import ActivityList from '../components/ActivityList.vue'

const userStore = useUserStore()
const route = useRoute()
const router = useRouter()
const activeTab = ref('赛事')
const activities = ref([])
const userRegistrations = ref([]) // 用户报名的活动ID列表
const loading = ref(false)
const page = ref(1)
const pageSize = 10
const hasMore = ref(true)
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

// 加载更多数据
const loadMore = () => {
  if (!loading.value && hasMore.value) {
    page.value++
    fetchActivities(true)
  }
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
const fetchActivities = async (isLoadMore = false) => {
  if (loading.value) return

  loading.value = true
  try {
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

    if (isLoadMore) {
      activities.value = [...activities.value, ...newActivities]
    } else {
      activities.value = newActivities
    }

    // 检查是否还有更多数据
    if (newActivities.length < pageSize) {
      hasMore.value = false
    }
  } catch (error) {
    console.error('获取活动列表失败:', error)
    if (!isLoadMore) {
      activities.value = []
    }
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

.activities-search-bottom {
  display: flex;
  flex-direction: column;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  background-color: transparent;
  border-top: none;
  position: sticky;
  bottom: calc(50px + env(safe-area-inset-bottom));
  z-index: 5;
  margin-top: auto;
}

.search-row {
  display: flex;
  justify-content: flex-end;
}

.search-button {
  min-width: 120px;
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
</style>
