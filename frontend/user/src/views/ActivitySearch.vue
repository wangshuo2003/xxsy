<template>
  <div class="activity-search-page">
    <div class="results-content">
      <ActivityList
        :activities="filteredActivities"
        :loading="loading"
        :has-more="hasMore"
        @load-more="loadMore"
        @refresh="refreshResults"
      />
      <van-empty
        v-if="!loading && filteredActivities.length === 0"
        description="未找到相关活动"
      />
      <div class="load-more-wrapper" v-if="filteredActivities.length">
        <van-button block type="primary" plain size="small" :loading="loading" :disabled="!hasMore" @click="loadMore">
          {{ hasMore ? '加载更多' : '没有更多了' }}
        </van-button>
      </div>
    </div>

    <div class="search-controls">
      <div class="search-row">
        <van-field
          v-model="searchKeyword"
          placeholder="输入关键字搜索活动"
          clearable
          @keyup.enter="handleSearch"
        />
        <van-popover
          v-model:show="showFilterPicker"
          placement="top-start"
          trigger="click"
          :actions="filterActions"
          @select="onSelectFilter"
        >
          <template #reference>
            <van-button class="filter-button" plain type="primary">
              {{ currentFilterLabel }}
            </van-button>
          </template>
        </van-popover>
        <van-button type="primary" class="search-button" @click="handleSearch">
          搜索
        </van-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { useUserStore } from '@/stores/user'
import ActivityList from '../components/ActivityList.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const searchKeyword = ref(route.query.keyword || '')
const categoryFilter = ref(route.query.filter || 'all')
const activities = ref([])
const loading = ref(false)
const page = ref(1)
const pageSize = 10
const hasMore = ref(true)
const userRegistrations = ref([])
const showFilterPicker = ref(false)

const filterOptions = [
  { text: '全部活动', value: 'all' },
  { text: '赛事', value: '赛事' },
  { text: '研学', value: '研学' },
  { text: '实践', value: '实践' },
  { text: '公益', value: '公益' }
]
const filterActions = filterOptions.map(opt => ({ text: opt.text, value: opt.value }))
const currentFilterLabel = computed(() => {
  return filterOptions.find(opt => opt.value === categoryFilter.value)?.text || '全部活动'
})

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

const fetchUserRegistrations = async () => {
  if (!userStore.isLoggedIn) {
    userRegistrations.value = []
    return
  }

  try {
    const response = await axios.get('/api/activities/my-registrations', {
      params: {
        page: 1,
        limit: 1000
      },
      headers: {
        Authorization: `Bearer ${userStore.token}`
      }
    })
    userRegistrations.value = response.data.data || []
  } catch (error) {
    console.error('获取报名状态失败:', error)
    userRegistrations.value = []
  }
}

const fetchActivities = async (isLoadMore = false) => {
  if (loading.value) return

  loading.value = true
  try {
    console.log('搜索请求', {
      keyword: searchKeyword.value,
      filter: categoryFilter.value,
      page: page.value,
      pageSize,
      isLoadMore
    })
    const params = {
      page: page.value,
      limit: pageSize,
      isApproved: true,
      search: searchKeyword.value || undefined
    }

    if (categoryFilter.value && categoryFilter.value !== 'all') {
      params.type = categoryFilter.value
    }

    const response = await axios.get('/api/activities', { params })
    const newActivities = response.data.data || []
    const totalFromApi = response.data.pagination?.total
    const total = typeof totalFromApi === 'number' ? totalFromApi : (page.value * pageSize + (newActivities.length === pageSize ? pageSize : 0))
    console.log('搜索分页', {
      keyword: searchKeyword.value,
      filter: categoryFilter.value,
      page: page.value,
      pageSize,
      received: newActivities.length,
      total
    })

    if (isLoadMore) {
      activities.value = [...activities.value, ...newActivities]
    } else {
      activities.value = newActivities
    }

    const loaded = activities.value.length
    hasMore.value = (page.value * pageSize) < total || (newActivities.length === pageSize)
    console.log('搜索 hasMore', { page: page.value, total, loaded, hasMore: hasMore.value })
  } catch (error) {
    console.error('获取搜索结果失败:', error)
    if (!isLoadMore) {
      activities.value = []
    }
  } finally {
    loading.value = false
  }
}

const loadMore = () => {
  if (loading.value) return
  console.log('搜索加载更多', { nextPage: page.value + 1 })
  page.value++
  fetchActivities(true)
}

const refreshResults = async () => {
  page.value = 1
  hasMore.value = true
  await Promise.all([
    fetchActivities(false),
    fetchUserRegistrations()
  ])
}

const handleSearch = () => {
  router.replace({
    path: '/activities/search',
    query: {
      keyword: searchKeyword.value || '',
      filter: categoryFilter.value || 'all'
    }
  })
  page.value = 1
  hasMore.value = true
  fetchActivities()
}

const onSelectFilter = (action) => {
  categoryFilter.value = action.value
  showFilterPicker.value = false
}

watch(
  () => [route.query.keyword, route.query.filter],
  ([newKeyword, newFilter]) => {
    searchKeyword.value = newKeyword || ''
    categoryFilter.value = newFilter || 'all'
    page.value = 1
    hasMore.value = true
    fetchActivities()
  }
)

onMounted(async () => {
  await Promise.all([
    fetchActivities(),
    fetchUserRegistrations()
  ])
})
</script>

<style scoped>
.activity-search-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f7f8fa;
}

.results-content {
  flex: 1;
  padding-bottom: 12px;
}

.search-controls {
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  background-color: #fff;
  border-top: 1px solid #f0f0f0;
  position: sticky;
  bottom: calc(50px + env(safe-area-inset-bottom));
  z-index: 5;
  margin-top: auto;
}

.load-more-wrapper {
  padding: 12px 16px 0;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-hint {
  padding: 6px 0 0;
  color: #999;
  font-size: 12px;
}

.search-row :deep(.van-field) {
  flex: 1;
  background-color: #f7f8fa;
  border-radius: 8px;
  padding: 0 8px;
}

.search-button {
  flex-shrink: 0;
}

.filter-button {
  flex-shrink: 0;
  min-width: 100px;
}
</style>
