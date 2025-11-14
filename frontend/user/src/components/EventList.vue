<template>
  <div class="event-list">
    <!-- 搜索栏 -->
    <div class="search-bar">
      <van-search
        v-model="searchText"
        placeholder="搜索活动标题或地点"
        @search="handleSearch"
        @clear="handleClear"
      />
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <van-dropdown-menu>
        <van-dropdown-item v-model="selectedTags" title="标签筛选" :options="tagOptions" />
        <van-dropdown-item v-model="sortBy" title="排序" :options="sortOptions" />
      </van-dropdown-menu>
    </div>

    <!-- 活动列表 -->
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="没有更多了"
        @load="onLoad"
      >
        <div
          v-for="event in events"
          :key="event.id"
          class="event-item"
          @click="goToDetail(event.id)"
        >
          <!-- 活动封面 -->
          <div class="event-cover">
            <img
              :src="event.coverImage || '/default-cover.jpg'"
              :alt="event.title"
              class="cover-image"
            />
            <div v-if="event.isHot" class="hot-badge">热门</div>
            <div v-if="isEventExpired(event.registerDeadline)" class="expired-badge">已截止</div>
          </div>

          <!-- 活动信息 -->
          <div class="event-info">
            <h3 class="event-title">{{ event.title }}</h3>
            <div class="event-tags">
              <van-tag v-for="tag in getTagsList(event.tags)" :key="tag" size="small">
                {{ tag }}
              </van-tag>
            </div>
            <div class="event-meta">
              <div class="meta-item">
                <van-icon name="location-o" />
                <span>{{ event.location }}</span>
              </div>
              <div class="meta-item">
                <van-icon name="clock-o" />
                <span>报名截止: {{ formatDate(event.registerDeadline) }}</span>
              </div>
              <div class="meta-item">
                <van-icon name="friends-o" />
                <span>已报名: {{ event._count.orders }}/{{ event.maxPeople || '不限' }}</span>
              </div>
            </div>
            <div class="event-price">
              <span v-if="event.price > 0" class="price">¥{{ event.price }}</span>
              <span v-else class="free">免费</span>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <van-empty
          v-if="!loading && events.length === 0"
          description="暂无活动"
          image="search"
        />
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const props = defineProps({
  eventType: {
    type: String,
    required: true
  }
})

const router = useRouter()

const events = ref([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const searchText = ref('')
const selectedTags = ref('')
const sortBy = ref('createdAt')

const pagination = reactive({
  page: 1,
  limit: 10,
  total: 0
})

const tagOptions = ref([
  { text: '全部标签', value: '' },
  { text: '省白名单赛事', value: '省白名单赛事' },
  { text: '科技创新', value: '科技创新' },
  { text: '文艺体育', value: '文艺体育' },
  { text: '社会实践', value: '社会实践' },
  { text: '公益活动', value: '公益活动' }
])

const sortOptions = ref([
  { text: '最新发布', value: 'createdAt' },
  { text: '报名截止', value: 'registerDeadline' },
  { text: '热门推荐', value: 'isHot' },
  { text: '价格最低', value: 'price_asc' },
  { text: '价格最高', value: 'price_desc' }
])

const getTagsList = (tags) => {
  if (!tags) return []
  return tags.split(',').map(tag => tag.trim()).filter(tag => tag)
}

const formatDate = (dateStr) => {
  if (!dateStr) return '无截止时间'
  const date = new Date(dateStr)
  const now = new Date()

  // 如果已经过期
  if (date < now) {
    return '已截止'
  }

  // 计算剩余时间
  const diff = date - now
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days > 30) {
    return date.toLocaleDateString('zh-CN')
  } else if (days > 0) {
    return `${days}天后截止`
  } else {
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours > 0) {
      return `${hours}小时后截止`
    } else {
      return '即将截止'
    }
  }
}

const isEventExpired = (deadline) => {
  if (!deadline) return false
  return new Date(deadline) < new Date()
}

const fetchEvents = async (reset = false) => {
  try {
    console.log('EventList: fetchEvents called with eventType:', props.eventType, 'reset:', reset)

    if (reset) {
      pagination.page = 1
      events.value = []
      finished.value = false
    }

    loading.value = true

    const params = {
      page: pagination.page,
      limit: pagination.limit,
      eventType: props.eventType
    }

    console.log('EventList: sending params:', params)

    if (searchText.value) {
      params.search = searchText.value
    }

    if (selectedTags.value) {
      params.tags = selectedTags.value
    }

    // 处理排序
    switch (sortBy.value) {
      case 'isHot':
        params.isHot = true
        break
      case 'price_asc':
        params.sortBy = 'price'
        params.order = 'asc'
        break
      case 'price_desc':
        params.sortBy = 'price'
        params.order = 'desc'
        break
      default:
        break
    }

    const response = await axios.get('/api/services/events', { params })

    if (reset) {
      events.value = response.data.data
    } else {
      events.value.push(...response.data.data)
    }

    pagination.total = response.data.pagination.total

    // 检查是否还有更多数据
    if (events.value.length >= pagination.total) {
      finished.value = true
    }

    pagination.page++
  } catch (error) {
    console.error('获取活动列表失败:', error)
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

const onLoad = () => {
  fetchEvents()
}

const onRefresh = () => {
  refreshing.value = true
  fetchEvents(true)
}

const handleSearch = () => {
  fetchEvents(true)
}

const handleClear = () => {
  searchText.value = ''
  fetchEvents(true)
}

const goToDetail = (eventId) => {
  router.push(`/events/${eventId}`)
}

// 监听筛选条件变化
watch([selectedTags, sortBy], () => {
  fetchEvents(true)
})

// 监听eventType变化
watch(() => props.eventType, (newEventType, oldEventType) => {
  console.log('EventList: eventType changed from', oldEventType, 'to', newEventType)
  fetchEvents(true)
}, { immediate: false })

onMounted(() => {
  fetchEvents(true)
})
</script>

<style scoped>
.event-list {
  background-color: #f7f8fa;
  min-height: 100vh;
}

.search-bar {
  background: white;
  padding: 8px 16px;
  border-bottom: 1px solid #ebedf0;
}

.filter-bar {
  background: white;
  border-bottom: 1px solid #ebedf0;
}

.event-item {
  background: white;
  margin: 8px 16px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: transform 0.2s;
}

.event-item:active {
  transform: scale(0.98);
}

.event-cover {
  position: relative;
  height: 160px;
  overflow: hidden;
}

.cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hot-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  background: linear-gradient(135deg, #ff6b6b, #ff4757);
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}

.expired-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
}

.event-info {
  padding: 16px;
}

.event-title {
  font-size: 16px;
  font-weight: bold;
  color: #323233;
  margin: 0 0 8px 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.event-tags {
  margin-bottom: 12px;
}

.event-tags .van-tag {
  margin-right: 4px;
  margin-bottom: 4px;
}

.event-meta {
  margin-bottom: 12px;
}

.meta-item {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: #969799;
  margin-bottom: 4px;
}

.meta-item .van-icon {
  margin-right: 4px;
  font-size: 14px;
}

.event-price {
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.price {
  color: #ff4757;
  font-size: 18px;
  font-weight: bold;
}

.free {
  color: #07c160;
  font-size: 14px;
  font-weight: bold;
}
</style>