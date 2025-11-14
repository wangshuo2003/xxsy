<template>
  <div class="home">
    <!-- 轮播图 -->
    <van-swipe class="swipe" :autoplay="3000" indicator-color="white">
      <van-swipe-item v-for="carousel in carousels" :key="carousel.id">
        <a :href="carousel.linkUrl" v-if="carousel.linkUrl && carousel.linkUrl !== '#'">
          <img :src="carousel.imageUrl" :alt="carousel.title" />
        </a>
        <img v-else :src="carousel.imageUrl" :alt="carousel.title" />
      </van-swipe-item>
    </van-swipe>

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
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()
const carousels = ref([])
const policies = ref([])
const certificates = ref([])
const activities = ref([])

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
    const response = await axios.get('/api/carousels?isActive=true&limit=5')
    carousels.value = response.data.data || []
  } catch (error) {
    console.error('获取轮播图失败:', error)
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

onMounted(() => {
  fetchCarousels()
  fetchActivities()
  fetchPolicies()
  fetchCertificates()
})
</script>

<style scoped>
.home {
  background-color: #f7f8fa;
  min-height: 100vh;
  padding-bottom: 80px;
}

.swipe {
  height: 200px;
}

.swipe img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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
  margin-bottom: 16px;
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