<template>
  <div class="achievements-page">
    <van-nav-bar title="活动成果" left-arrow @click-left="$router.back()" />

    <van-loading v-if="loading" class="loading" />

    <div v-else-if="achievements.length === 0" class="empty-state">
      <van-empty description="暂无活动成果">
        <van-button type="primary" size="small" @click="$router.push('/activities')">
          去参加活动
        </van-button>
      </van-empty>
    </div>

    <div v-else class="achievements-list">
      <div
        v-for="achievement in achievements"
        :key="achievement.activity.id"
        class="achievement-card"
        @click="goToDetail(achievement.activity.id)"
      >
        <div class="achievement-header">
          <div class="activity-info">
            <h3 class="activity-name">{{ achievement.activity.name }}</h3>
            <p class="activity-meta">
              <van-icon name="clock" />
              {{ formatDate(achievement.activity.time) }}
            </p>
            <p class="activity-meta">
              <van-icon name="location" />
              {{ achievement.activity.location }}
            </p>
          </div>
          <div class="status-badge" :class="getStatusClass(achievement.awardStatus)">
            {{ getStatusText(achievement.awardStatus) }}
          </div>
        </div>

        <div class="achievement-stats">
          <div class="stat-item">
            <div class="stat-label">得分</div>
            <div class="stat-value">{{ achievement.score }}</div>
          </div>
          <div class="stat-item" v-if="achievement.rank">
            <div class="stat-label">排名</div>
            <div class="stat-value">第{{ achievement.rank }}名</div>
          </div>
          <div class="stat-item" v-if="achievement.awards.length > 0">
            <div class="stat-label">奖项</div>
            <div class="stat-value">{{ achievement.awards.length }}个</div>
          </div>
        </div>

        <div class="awards-list" v-if="achievement.awards.length > 0">
          <div class="award-item" v-for="award in achievement.awards" :key="award.id">
            <van-icon name="award" color="#ffd700" />
            <span class="award-name">{{ award.name }}</span>
            <span class="award-type" :class="award.type.toLowerCase()">
              {{ award.type === 'AUTOMATIC' ? '自动' : '手动' }}
            </span>
          </div>
        </div>

        <div class="achievement-footer">
          <span class="activity-type">{{ achievement.activity.type }}</span>
          <van-icon name="arrow" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showFailToast } from 'vant'
import request from '@/api/request'

const router = useRouter()

// 响应式数据
const loading = ref(false)
const achievements = ref([])

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// 获取状态样式类
const getStatusClass = (status) => {
  const statusMap = {
    'pending': 'status-pending',
    'issued': 'status-issued',
    'settled': 'status-settled',
    'pending_settlement': 'status-pending-settlement'
  }
  return statusMap[status] || 'status-pending'
}

// 获取状态文本
const getStatusText = (status) => {
  const statusMap = {
    'pending': '进行中',
    'issued': '已发奖',
    'settled': '已结算',
    'pending_settlement': '待结算'
  }
  return statusMap[status] || '进行中'
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const response = await request.get('/activities/my-achievements')
    achievements.value = response.data || []
  } catch (error) {
    console.error('获取活动成果失败:', error)
    showFailToast('获取活动成果失败')
  } finally {
    loading.value = false
  }
}

// 跳转到详情页
const goToDetail = (activityId) => {
  router.push(`/achievement/${activityId}`)
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.achievements-page {
  min-height: 100vh;
  background-color: #f7f8fa;
}

.loading {
  display: flex;
  justify-content: center;
  padding: 40px 16px;
}

.empty-state {
  padding: 40px 16px;
  text-align: center;
}

.achievements-list {
  padding: 16px;
}

.achievement-card {
  background: white;
  border-radius: 12px;
  margin-bottom: 16px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: transform 0.2s;
}

.achievement-card:active {
  transform: scale(0.98);
}

.achievement-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.activity-info {
  flex: 1;
}

.activity-name {
  font-size: 18px;
  font-weight: 600;
  color: #323233;
  margin: 0 0 8px 0;
  line-height: 1.4;
}

.activity-meta {
  font-size: 14px;
  color: #646566;
  margin: 4px 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.status-pending {
  background-color: #e6f7ff;
  color: #1890ff;
}

.status-issued {
  background-color: #f6ffed;
  color: #52c41a;
}

.status-settled {
  background-color: #fff7e6;
  color: #fa8c16;
}

.status-pending-settlement {
  background-color: #fff1f0;
  color: #ff4d4f;
}

.achievement-stats {
  display: flex;
  justify-content: space-around;
  margin-bottom: 16px;
  padding: 12px;
  background-color: #f7f8fa;
  border-radius: 8px;
}

.stat-item {
  text-align: center;
}

.stat-label {
  font-size: 12px;
  color: #969799;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: #323233;
}

.awards-list {
  margin-bottom: 12px;
}

.award-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  font-size: 14px;
  color: #323233;
}

.award-name {
  flex: 1;
  font-weight: 500;
}

.award-type {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.award-type.automatic {
  background-color: #e6f7ff;
  color: #1890ff;
}

.award-type.manual {
  background-color: #fff7e6;
  color: #fa8c16;
}

.achievement-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid #ebedf0;
  font-size: 14px;
  color: #969799;
}

.activity-type {
  background-color: #f0f2f5;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}
</style>