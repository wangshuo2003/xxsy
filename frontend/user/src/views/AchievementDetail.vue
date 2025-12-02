<template>
  <div class="achievement-detail">
    <van-nav-bar
      title="活动成果详情"
      left-arrow
      @click-left="$router.back()"
    />

    <div v-if="loading" class="loading">
      <van-loading size="24px" vertical>加载中...</van-loading>
    </div>

    <div v-else-if="achievement" class="achievement-content">
      <!-- 活动基本信息 -->
      <div class="activity-header">
        <h1 class="activity-title">{{ achievement.activity.name }}</h1>
        <div class="activity-meta">
          <div class="meta-item">
            <van-icon name="clock" />
            <span>{{ formatDate(achievement.activity.time) }}</span>
          </div>
          <div class="meta-item">
            <van-icon name="location" />
            <span>{{ achievement.activity.location }}</span>
          </div>
          <div class="meta-item">
            <van-icon name="label" />
            <span>{{ achievement.activity.type }}</span>
          </div>
        </div>
        <div class="status-badge" :class="getStatusClass(achievement.awardStatus)">
          {{ getStatusText(achievement.awardStatus) }}
        </div>
      </div>

      <!-- 成绩信息 -->
      <div class="score-section">
        <h3 class="section-title">活动成绩</h3>
        <div class="score-stats">
          <div class="stat-card">
            <div class="stat-icon">
              <van-icon name="star" color="#ffd700" size="24" />
            </div>
            <div class="stat-content">
              <div class="stat-label">得分</div>
              <div class="stat-value">{{ achievement.score }}</div>
            </div>
          </div>
          <div class="stat-card" v-if="achievement.rank">
            <div class="stat-icon">
              <van-icon name="medal" color="#c0c0c0" size="24" />
            </div>
            <div class="stat-content">
              <div class="stat-label">排名</div>
              <div class="stat-value">第{{ achievement.rank }}名</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 奖项信息 -->
      <div class="awards-section" v-if="achievement.awards.length > 0">
        <h3 class="section-title">获得奖项</h3>
        <div class="awards-list">
          <div class="award-card" v-for="award in achievement.awards" :key="award.id">
            <div class="award-icon">
              <van-icon name="award" color="#ffd700" size="32" />
            </div>
            <div class="award-content">
              <h4 class="award-name">{{ award.name }}</h4>
              <p class="award-description" v-if="award.description">{{ award.description }}</p>
              <div class="award-meta">
                <span class="award-date">{{ formatDate(award.issuedAt) }}</span>
                <span class="award-type" :class="award.type.toLowerCase()">
                  {{ award.type === 'AUTOMATIC' ? '自动颁发' : '手动颁发' }}
                </span>
                <span class="award-issuer" v-if="award.issuedBy">颁发人：{{ award.issuedBy }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 活动描述 -->
      <div class="description-section" v-if="achievement.activity.description">
        <h3 class="section-title">活动描述</h3>
        <div class="description-content">{{ achievement.activity.description }}</div>
      </div>

      <!-- 参与信息 -->
      <div class="participation-section">
        <h3 class="section-title">参与信息</h3>
        <div class="participation-info">
          <div class="info-item">
            <span class="info-label">报名状态：</span>
            <span class="info-value">{{ getParticipationStatus(achievement.participation.status) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">报名时间：</span>
            <span class="info-value">{{ formatDateTime(achievement.participation.createdAt) }}</span>
          </div>
        </div>
      </div>

      <!-- 状态提示 -->
      <div class="status-notice" v-if="achievement.awardStatus === 'pending'">
        <van-icon name="info" color="#1890ff" />
        <span>活动未结束，奖项将在活动结束后自动发放</span>
      </div>
      <div class="status-notice" v-else-if="achievement.awardStatus === 'pending_settlement'">
        <van-icon name="clock" color="#fa8c16" />
        <span>活动已结束，奖项待结算</span>
      </div>
    </div>

    <div v-else class="error">
      <van-empty description="活动成果不存在或已被删除" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { showToast, showFailToast } from 'vant'
import request from '@/api/request'

const route = useRoute()

const loading = ref(true)
const achievement = ref(null)

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// 格式化日期时间
const formatDateTime = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
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

// 获取参与状态文本
const getParticipationStatus = (status) => {
  const statusMap = {
    'REGISTERED': '已报名',
    'APPROVED': '已通过',
    'REJECTED': '已拒绝'
  }
  return statusMap[status] || status
}

// 加载数据
const loadData = async () => {
  try {
    const activityId = route.params.id
    const response = await request.get(`/activities/${activityId}/achievement`)
    achievement.value = response.data
  } catch (error) {
    console.error('获取活动成果详情失败:', error)
    showFailToast('获取活动成果详情失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.achievement-detail {
  min-height: 100vh;
  background-color: #f7f8fa;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 300px;
}

.achievement-content {
  padding-bottom: 20px;
}

.activity-header {
  background: white;
  padding: 20px;
  margin-bottom: 12px;
  position: relative;
}

.activity-title {
  margin: 0 0 12px 0;
  font-size: 20px;
  font-weight: 600;
  color: #323233;
  line-height: 1.4;
}

.activity-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #646566;
}

.status-badge {
  position: absolute;
  top: 20px;
  right: 20px;
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
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

.score-section,
.awards-section,
.description-section,
.participation-section {
  background: white;
  margin-bottom: 12px;
  padding: 20px;
}

.section-title {
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 600;
  color: #323233;
}

.score-stats {
  display: flex;
  gap: 16px;
}

.stat-card {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #f7f8fa;
  border-radius: 8px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  background: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-content {
  flex: 1;
}

.stat-label {
  font-size: 14px;
  color: #969799;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #323233;
}

.awards-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.award-card {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: #f7f8fa;
  border-radius: 8px;
}

.award-icon {
  width: 48px;
  height: 48px;
  background: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.award-content {
  flex: 1;
}

.award-name {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: #323233;
}

.award-description {
  font-size: 14px;
  color: #646566;
  margin: 0 0 8px 0;
}

.award-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  color: #969799;
}

.award-type {
  padding: 2px 6px;
  border-radius: 4px;
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

.description-content {
  font-size: 14px;
  color: #646566;
  line-height: 1.6;
}

.participation-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-label {
  font-size: 14px;
  color: #969799;
}

.info-value {
  font-size: 14px;
  color: #323233;
  font-weight: 500;
}

.status-notice {
  background: white;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #646566;
}

.error {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 300px;
}
</style>