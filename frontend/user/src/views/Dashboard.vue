<template>
  <div class="dashboard">
    <!-- 轮播图 -->
    <Carousels />

    <!-- 欢迎信息 -->
    <div class="welcome-section">
      <van-cell-group inset>
        <van-cell center>
          <template #title>
            <span class="welcome-title">欢迎回来，{{ userStore.userName || '用户' }}！</span>
          </template>
          <template #label>
            <span class="welcome-subtitle">{{ getRoleText(userStore.userRole) }}</span>
          </template>
          <template #right-icon>
            <van-icon name="smile-o" size="24" color="#667eea" />
          </template>
        </van-cell>
      </van-cell-group>
    </div>

    <!-- 快捷功能 -->
    <div class="quick-actions">
      <van-grid :column-num="4" :gutter="12">
        <van-grid-item
          v-for="action in quickActions"
          :key="action.name"
          :icon="action.icon"
          :text="action.text"
          @click="handleQuickAction(action)"
        />
      </van-grid>
    </div>

    <!-- 最新活动 -->
    <div class="recent-section">
      <van-cell-group inset>
        <van-cell title="最新活动" is-link value="查看更多" @click="$router.push('/activities')" />
      </van-cell-group>

      <div class="recent-list">
        <van-card
          v-for="activity in recentActivities"
          :key="activity.id"
          :title="activity.name"
          :desc="activity.base?.name"
          :thumb="activity.coverImage || '/default-activity.jpg'"
          @click="viewActivity(activity)"
        >
          <template #tags>
            <van-tag
              :type="activity.isApproved ? 'success' : 'warning'"
              size="small"
            >
              {{ activity.isApproved ? '已通过' : '待审核' }}
            </van-tag>
          </template>
          <template #footer>
            <span class="activity-time">{{ formatDate(activity.time) }}</span>
          </template>
        </van-card>
      </div>
    </div>

    <!-- 推荐服务 -->
    <div class="services-section">
      <van-cell-group inset>
        <van-cell title="推荐服务" is-link value="查看更多" @click="$router.push('/services')" />
      </van-cell-group>

      <div class="services-grid">
        <van-card
          v-for="service in hotServices"
          :key="service.id"
          :title="service.title"
          :desc="service.description"
          :price="'¥' + service.price"
          :thumb="service.coverImage || '/default-service.jpg'"
          @click="viewService(service)"
        >
          <template #tags>
            <van-tag v-if="service.isHot" type="danger" size="small">热门</van-tag>
            <van-tag type="primary" size="small">{{ service.tags }}</van-tag>
          </template>
        </van-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showSuccessToast } from 'vant'
import { useUserStore } from '@/stores/user'
import Carousels from './Carousels.vue'
import request from '@/api/request'

const router = useRouter()
const userStore = useUserStore()

const recentActivities = ref([])
const hotServices = ref([])

const quickActions = [
  { name: 'activities', text: '活动报名', icon: 'calendar-o' },
  { name: 'services', text: '服务预约', icon: 'service-o' },
  { name: 'orders', text: '我的订单', icon: 'orders-o' },
  { name: 'profile', text: '个人中心', icon: 'user-o' }
]

const getRoleText = (role) => {
  const roleMap = {
    'SUPER_ADMIN': '超级管理员',
    'ACTIVITY_ADMIN': '活动管理员',
    'STUDENT': '学生用户'
  }
  return roleMap[role] || '用户'
}

const formatDate = (date) => {
  if (!date) return '时间待定'
  return new Date(date).toLocaleDateString('zh-CN')
}

const handleQuickAction = (action) => {
  router.push(`/${action.name}`)
}

const viewActivity = (activity) => {
  router.push(`/activities/${activity.id}`)
}

const viewService = (service) => {
  router.push(`/services/${service.id}`)
}

const loadRecentActivities = async () => {
  try {
    const response = await request.get('/activities?limit=3')
    recentActivities.value = response.data || []
  } catch (error) {
    console.error('Failed to load recent activities:', error)
  }
}

const loadHotServices = async () => {
  try {
    const response = await request.get('/services?limit=3&isHot=true')
    hotServices.value = response.data || []
  } catch (error) {
    console.error('Failed to load hot services:', error)
  }
}

onMounted(() => {
  loadRecentActivities()
  loadHotServices()
})
</script>

<style scoped>
.dashboard {
  padding-bottom: 20px;
}

.welcome-section {
  margin: 16px 0;
}

.welcome-title {
  font-size: 18px;
  font-weight: bold;
  color: #333;
}

.welcome-subtitle {
  font-size: 14px;
  color: #666;
  margin-top: 4px;
}

.quick-actions {
  margin: 16px 0;
}

.recent-section, .services-section {
  margin: 20px 0;
}

.recent-list, .services-grid {
  padding: 0 16px;
}

.recent-list .van-card, .services-grid .van-card {
  margin-bottom: 12px;
}

.activity-time {
  font-size: 12px;
  color: #999;
}
</style>