<template>
  <div class="home">
    <!-- 轮播图 -->
    <div class="swipe-container">
      <van-swipe ref="swipeRef" class="swipe" :autoplay="autoplayDuration" indicator-color="white">
        <van-swipe-item v-for="carousel in carousels" :key="carousel.id">
          <a :href="carousel.linkUrl" v-if="carousel.linkUrl && carousel.linkUrl !== '#'">
            <img :src="carousel.imageUrl" :alt="carousel.title" />
          </a>
          <img v-else :src="carousel.imageUrl" :alt="carousel.title" />
        </van-swipe-item>
      </van-swipe>
      <van-button class="swipe-nav prev" @click="prev" round icon="arrow-left" />
      <van-button class="swipe-nav next" @click="next" round icon="arrow" />
    </div>

    <!-- 消息 -->
    <div class="section">
      <div class="section-header" @click="goToMessages">
        <h3>消息</h3>
        <van-button plain type="primary" size="small">查看全部</van-button>
      </div>

      <div v-if="latestChats.length">
        <van-list>
          <van-cell
            v-for="chat in latestChats"
            :key="chat.id"
            icon="chat-o"
            is-link
            @click="goToChat(chat)"
          >
            <template #title>
              <div class="activity-title">{{ chat.name }}</div>
            </template>
            <template #label>
              <div class="policy-time">{{ chat.preview || '点击查看消息' }}</div>
            </template>
            <template #value>
              <span class="policy-time">{{ chat.preview || '点击查看消息' }}</span>
            </template>
          </van-cell>
        </van-list>
      </div>
      <div v-else class="empty-state">
        <van-empty description="暂无新消息" />
      </div>
    </div>

    <!-- 最新活动 -->
    <div class="section">
      <div class="section-header">
        <h3>最新活动</h3>
        <van-button plain type="primary" size="small" to="/activities">查看更多</van-button>
      </div>
      <van-list>
        <van-cell v-for="activity in activities" :key="activity.id" :to="`/activity/${activity.id}`" is-link>
          <template #title>
            <div class="activity-title">{{ activity.name }}</div>
          </template>
          <template #label>
            <div class="activity-time">{{ formatActivityTime(activity.time) }}</div>
            <div class="activity-location">{{ activity.location }}</div>
          </template>
        </van-cell>
      </van-list>
    </div>

    <!-- 政策通知 -->
    <div class="section">
      <div class="section-header">
        <h3>政策通知</h3>
        <van-button plain type="primary" size="small" to="/policies">查看更多</van-button>
      </div>
      <van-list>
        <van-cell v-for="policy in policies" :key="policy.id" :to="`/policy/${policy.id}`" is-link>
          <template #title>
            <div class="policy-title">{{ policy.title }}</div>
          </template>
          <template #label>
            <div class="policy-time">{{ formatDate(policy.createdAt) }}</div>
          </template>
        </van-cell>
      </van-list>
    </div>

    <!-- 成果展示 -->
    <div class="section" v-if="userStore.isLoggedIn">
      <div class="section-header">
        <h3>成果展示</h3>
        <van-button plain type="primary" size="small" to="/achievements">查看更多</van-button>
      </div>
      <div v-if="certificates.length > 0">
        <van-list>
          <van-cell v-for="certificate in certificates" :key="certificate.id" @click="goToCertificate(certificate.id)" is-link>
            <template #title>
              <div class="certificate-title">{{ certificate.title }}</div>
            </template>
            <template #label>
              <div class="certificate-issuer">{{ certificate.issuer || '暂无颁发机构' }} · {{ formatDate(certificate.issueDate || certificate.createdAt) }}</div>
            </template>
          </van-cell>
        </van-list>
      </div>
      <div v-else class="empty-state">
        <van-empty description="暂无证书" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { useUserStore } from '@/stores/user'
import { prefetchBingToday, getBingCarouselCache, getBingFallback } from '@/utils/bingFallback'

const router = useRouter()
const userStore = useUserStore()
const carousels = ref([])
const policies = ref([])
const certificates = ref([])
const chatPreviews = ref([])
const activities = ref([])
const swipeRef = ref(null)
const autoplayDuration = ref(3000)
let autoplayTimeout = null
const THREAD_STORAGE_KEY = 'chatThreads'
const defaultCarousels = [
  {
    id: 'demo-1',
    title: '校园风光示例',
    imageUrl: '/demo-carousel-1.jpg',
    linkUrl: '#'
  },
  {
    id: 'demo-2',
    title: '研学活动示例',
    imageUrl: '/demo-carousel-2.jpg',
    linkUrl: '#'
  },
  {
    id: 'demo-3',
    title: '实践课堂示例',
    imageUrl: '/demo-carousel-3.jpg',
    linkUrl: '#'
  }
]

// 获取 Bing 壁纸（通过后端代理避免 CORS），默认当天 n 张
const fetchBingWallpapers = async (idx = 0, n = 4) => {
  try {
    const res = await axios.get('/api/external/bing-wallpapers', { params: { idx, n } })
    return res.data?.data || []
  } catch (error) {
    console.error('获取 Bing 壁纸失败:', error)
    return []
  }
}

const loadLocalThreads = () => {
  try {
    const raw = localStorage.getItem(THREAD_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch (e) {
    return {}
  }
}

const pauseAutoplay = () => {
  if (autoplayTimeout) {
    clearTimeout(autoplayTimeout)
  }
  autoplayDuration.value = 0
  autoplayTimeout = setTimeout(() => {
    autoplayDuration.value = 3000
  }, 8000)
}

const prev = () => {
  if (swipeRef.value) {
    swipeRef.value.prev()
    pauseAutoplay()
  }
}

const next = () => {
  if (swipeRef.value) {
    swipeRef.value.next()
    pauseAutoplay()
  }
}

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

// 获取轮播图
const fetchCarousels = async () => {
  try {
    // 先用本地缓存的 Bing 轮播（含今日+前三天），避免重复请求
    const cached = getBingCarouselCache()
    if (cached.length > 0) {
      carousels.value = cached
      // 后台刷新，若成功则更新
      prefetchBingToday().then(({ images }) => {
        if (images && images.length > 0) {
          carousels.value = images
        }
      })
      return
    }

    // 快速预取今日，生成本地 2025xxxx.jpg 后立刻用来显示
    const fastResult = await prefetchBingToday({ fast: true })
    if (fastResult?.images?.length > 0) {
      carousels.value = fastResult.images
    } else if (fastResult?.today) {
      carousels.value = [{
        id: 'bing-today',
        title: 'Bing 今日壁纸',
        imageUrl: fastResult.today,
        linkUrl: '#'
      }]
    } else {
      // 最兜底使用远程/默认
      const fallbackUrl = getBingFallback()
      carousels.value = [{
        id: 'bing-fallback',
        title: 'Bing 今日壁纸',
        imageUrl: fallbackUrl,
        linkUrl: '#'
      }]
    }

    // 请求后台轮播（自定义轮播），若有则使用
    const response = await axios.get('/api/carousels?isActive=true&limit=5')
    const data = response.data.data || []
    const withImages = data.filter(item => item.imageUrl)
    if (withImages.length > 0) {
      carousels.value = withImages
    }

    // 后台拉取完整 4 张，完成后替换
    prefetchBingToday({ forceFull: true }).then(({ images }) => {
      if (images && images.length > 0) {
        carousels.value = images
      }
    })

    if (!carousels.value || carousels.value.length === 0) {
      carousels.value = defaultCarousels
    }
  } catch (error) {
    console.error('获取轮播图失败:', error)
    const { images, today } = await prefetchBingToday({ fast: true })
    if (images && images.length > 0) {
      carousels.value = images
    } else if (today) {
      carousels.value = [{
        id: 'bing-today',
        title: 'Bing 今日壁纸',
        imageUrl: today,
        linkUrl: '#'
      }]
    } else {
      carousels.value = defaultCarousels
    }
  }
}

// 获取政策通知
const fetchPolicies = async () => {
  try {
    const response = await axios.get('/api/policies?isActive=true&limit=5')
    policies.value = response.data.data || []
  } catch (error) {
    console.error('获取政策通知失败:', error)
  }
}

// 获取用户证书
const fetchCertificates = async () => {
  if (!userStore.isLoggedIn) {
    certificates.value = []
    return
  }

  try {
    const response = await axios.get('/api/certificates/my?limit=5', {
      headers: {
        'Authorization': `Bearer ${userStore.token}`
      }
    })
    certificates.value = response.data.data || []
  } catch (error) {
    console.error('获取证书失败:', error)
    certificates.value = []
  }
}

// 获取最近 3 条聊天
const fetchRecentChats = async () => {
  if (!userStore.token) {
    chatPreviews.value = []
    return
  }

  try {
    const localThreads = loadLocalThreads()
    const res = await axios.get('/api/messages/contacts', {
      params: { limit: 3, sortBy: 'updatedAt' },
      headers: { Authorization: `Bearer ${userStore.token}` }
    })
    const list = Array.isArray(res?.data?.data) ? res.data.data : []

    const headers = { Authorization: `Bearer ${userStore.token}` }

    const enriched = await Promise.all(
      list.map(async (item) => {
        const id = item.id || item.contactId || item.userId
        if (!id) return null

        const apiTs = new Date(item.updatedAt || item.lastTime || Date.now()).getTime()
        const apiText = item.lastMessage || item.preview || ''

        const thread = Array.isArray(localThreads[id]) ? localThreads[id] : []
        const lastLocal = thread.length ? thread[thread.length - 1] : null
        const localTs = lastLocal?.time ? new Date(lastLocal.time).getTime() : 0
        const localText = lastLocal?.text || ''

        let ts = apiTs
        let preview = apiText

        if (localTs > ts) {
          ts = localTs
          preview = localText
        }

        // 如果仍然没有预览，单独请求该会话的最后一条消息
        if (!preview) {
          try {
            const resMsg = await axios.get(`/api/messages/contacts/${encodeURIComponent(id)}/messages`, {
              params: { limit: 1, sortBy: 'createdAt', order: 'desc' },
              headers
            })
            const msg = Array.isArray(resMsg?.data?.data) ? resMsg.data.data[0] : null
            if (msg) {
              preview = msg.content || preview
              ts = new Date(msg.createdAt || ts).getTime()
            }
          } catch (e) {
            console.error('拉取会话最新消息失败', id, e)
          }
        }

        return {
          id,
          name: item.name || item.nickname || '好友',
          preview: preview || '暂无消息',
          ts
        }
      })
    )

    chatPreviews.value = enriched
      .filter(Boolean)
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .slice(0, 3)
      .map(item => ({
        ...item,
        time: formatDate(item.ts || Date.now())
      }))
  } catch (error) {
    console.error('获取聊天摘要失败:', error)
    chatPreviews.value = []
  }
}

// 获取最新活动
const fetchActivities = async () => {
  try {
    const response = await axios.get('/api/activities?isActive=true&isApproved=true&limit=5')
    activities.value = response.data.data || []
  } catch (error) {
    console.error('获取活动失败:', error)
    activities.value = []
  }
}

// 跳转到证书详情
const goToCertificate = (id) => {
  router.push(`/achievements?id=${id}`)
}

const goToMessages = () => {
  router.push('/messages')
}

const goToChat = (chat) => {
  router.push({ path: '/chat', query: { with: chat.id, name: chat.name } })
}

const latestChats = computed(() => chatPreviews.value)

onMounted(() => {
  fetchCarousels()
  fetchActivities()
  fetchPolicies()
  fetchCertificates()
  fetchRecentChats()
})
</script>

<style scoped>
.home {
  background-color: #f7f8fa;
  min-height: auto;
  padding-bottom: 16px;
}

.swipe-container {
  position: relative;
}

.swipe {
  height: 200px;
}

.swipe img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.swipe-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 2;
  width: 28px;
  height: 28px;
  background-color: rgba(0, 0, 0, 0.3);
  border: none;
  color: white;
}

.swipe-nav.prev {
  left: 10px;
}

.swipe-nav.next {
  right: 10px;
}

.nav-grid {
  margin: 16px;
  background-color: white;
  border-radius: 8px;
  padding: 16px 0;
}

.nav-grid .van-grid-item {
  color: #666;
}

.nav-grid .van-grid-item span {
  display: block;
  font-size: 12px;
  margin-top: 4px;
}

.section {
  margin: 16px;
  background-color: white;
  border-radius: 8px;
  padding: 16px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 15px 0px 15px;
  cursor: pointer;
  
}

.section-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.policy-title {
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.policy-time {
  font-size: 12px;
  color: #999;
}

.activity-title {
  font-size: 14px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-time {
  font-size: 12px;
  color: #999;
}

.activity-location {
  font-size: 12px;
  color: #666;
  margin-top: 2px;
}

.base-title {
  font-size: 14px;
  font-weight: 500;
}

.base-address {
  font-size: 12px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.certificate-title {
  font-size: 14px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.certificate-issuer {
  font-size: 12px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-state {
  padding: 20px 0;
  text-align: center;
}
</style>
