<template>
  <div class="base-detail">
    <div v-if="loading" class="loading">
      <van-loading size="24px" vertical>加载中...</van-loading>
    </div>

    <div v-else-if="base" class="base-content">
      <!-- 基地封面图片 -->
      <div class="base-cover">
        <img :src="getBaseImage(base)" :alt="base.name" />
        <div class="base-status">
          <van-tag v-if="base.isActive && base.isApproved" type="success" size="small">
            营业中
          </van-tag>
          <van-tag v-else type="warning" size="small">
            {{ base.isApproved ? '筹备中' : '待审核' }}
          </van-tag>
        </div>
      </div>

      <!-- 基地基本信息 -->
      <div class="base-header">
        <h1 class="base-title">{{ base.name }}</h1>
        <div class="base-type">{{ base.type }}</div>

        <div class="base-info-grid">
          <div class="info-item">
            <van-icon name="location" />
            <span>{{ base.address }}</span>
          </div>
          <div v-if="base.contact" class="info-item">
            <van-icon name="phone" />
            <span>{{ base.contact }}</span>
          </div>
          <div v-if="base.manager" class="info-item">
            <van-icon name="manager" />
            <span>管理员：{{ base.manager.name }}</span>
          </div>
        </div>
      </div>

      <!-- 基地详细描述 -->
      <div class="base-body">
        <div class="section">
          <h3>基地介绍</h3>
          <div class="base-description" v-html="formatContent(base.description)"></div>
        </div>

        <!-- 近期活动 -->
        <div v-if="base.activities && base.activities.length > 0" class="section">
          <h3>近期活动</h3>
          <div class="activity-list">
            <div
              v-for="activity in base.activities"
              :key="activity.id"
              class="activity-item"
              @click="viewActivity(activity)"
            >
              <div class="activity-info">
                <h4 class="activity-name">{{ activity.name }}</h4>
                <div class="activity-meta">
                  <span class="activity-time">
                    <van-icon name="clock" />
                    {{ formatDateTime(activity.time) }}
                  </span>
                  <span class="activity-location">
                    <van-icon name="location" />
                    {{ activity.location }}
                  </span>
                </div>
                <div class="activity-status">
                  <van-tag
                    :type="activity.isApproved ? 'success' : 'warning'"
                    size="small"
                  >
                    {{ activity.isApproved ? '已审核' : '待审核' }}
                  </van-tag>
                </div>
              </div>
              <van-icon name="arrow" />
            </div>
          </div>
        </div>
      </div>

      <!-- 底部操作栏 -->
      <div class="base-actions">
        <van-button
          v-if="canApplyActivity"
          type="primary"
          block
          size="large"
          @click="showActivityDialog = true"
        >
          申请活动
        </van-button>
        <van-button
          v-else-if="!userStore.isLoggedIn"
          type="primary"
          block
          size="large"
          @click="$router.push('/login')"
        >
          请先登录
        </van-button>
        <van-button
          v-else
          block
          size="large"
          disabled
        >
          暂无可申请活动
        </van-button>
      </div>
    </div>

    <div v-else class="error">
      <van-empty description="基地不存在或已被删除" />
    </div>

    <!-- 活动申请弹窗 -->
    <van-dialog
      v-model:show="showActivityDialog"
      title="申请活动"
      show-cancel-button
      @confirm="handleActivityApply"
    >
      <div class="activity-form">
        <van-field
          v-model="activityForm.name"
          label="活动名称"
          placeholder="请输入活动名称"
          required
        />
        <van-field
          v-model="activityForm.description"
          label="活动描述"
          type="textarea"
          placeholder="请描述活动内容"
          rows="3"
        />
        <van-field
          v-model="activityForm.time"
          label="活动时间"
          type="datetime-local"
          required
        />
        <van-field
          v-model="activityForm.location"
          label="活动地点"
          placeholder="请输入活动地点"
          required
        />
        <van-field
          v-model="activityForm.maxPeople"
          label="人数限制"
          type="number"
          placeholder="请输入最大人数"
        />
      </div>
    </van-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeMount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast, showSuccessToast } from 'vant'
import { useUserStore } from '@/stores/user'
import request from '@/api/request'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const loading = ref(true)
const base = ref(null)
const showActivityDialog = ref(false)

const activityForm = ref({
  name: '',
  description: '',
  time: '',
  location: '',
  maxPeople: ''
})

const canApplyActivity = computed(() => {
  return userStore.isLoggedIn && base.value?.isActive && base.value?.isApproved
})

const getBaseImage = (base) => {
  const typeImages = {
    '教育实践基地': '/images/base-education.jpg',
    '研学基地': '/images/base-research.jpg',
    '实训基地': '/images/base-training.jpg',
    '创业基地': '/images/base-business.jpg'
  }
  return typeImages[base.type] || '/images/base-default.jpg'
}

const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

const formatDateTime = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatContent = (content) => {
  if (!content) return '暂无详细介绍'
  return content.replace(/\n/g, '<br>')
}

const loadBase = async () => {
  try {
    const baseId = route.params.id
    const response = await request.get(`/bases/${baseId}`)
    base.value = response.data
  } catch (error) {
    showToast('加载失败')
    console.error('加载基地详情失败:', error)
  } finally {
    loading.value = false
  }
}

const viewActivity = (activity) => {
  showToast('活动详情功能开发中')
}

const handleActivityApply = async () => {
  try {
    if (!activityForm.value.name || !activityForm.value.time || !activityForm.value.location) {
      showToast('请填写必要信息')
      return
    }

    await request.post('/activities', {
      ...activityForm.value,
      baseId: base.value.id,
      time: new Date(activityForm.value.time).toISOString()
    })

    showSuccessToast('活动申请提交成功，等待审核')
    showActivityDialog.value = false

    // 重置表单
    activityForm.value = {
      name: '',
      description: '',
      time: '',
      location: '',
      maxPeople: ''
    }

    // 重新加载基地信息
    await loadBase()
  } catch (error) {
    showToast(error.response?.data?.error || '申请失败')
  }
}

// 权限检查 - 学生用户不能访问基地详情
onBeforeMount(async () => {
  // 如果用户未登录，先获取用户信息
  if (!userStore.user) {
    try {
      await userStore.getUserInfo()
    } catch (error) {
      console.error('获取用户信息失败:', error)
    }
  }

  // 检查用户角色，如果是学生则跳转到首页
  if (userStore.userRole === 'STUDENT') {
    showToast('学生用户无权限访问此功能')
    router.replace('/home')
    return
  }
})

onMounted(() => {
  loadBase()
})
</script>

<style scoped>
.base-detail {
  min-height: 100vh;
  background-color: #f7f8fa;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 300px;
}

.base-content {
  background: white;
  margin-bottom: 60px;
}

.base-cover {
  position: relative;
  height: 200px;
  overflow: hidden;
}

.base-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.base-status {
  position: absolute;
  top: 12px;
  right: 12px;
}

.base-header {
  padding: 20px;
  border-bottom: 1px solid #ebedf0;
}

.base-title {
  margin: 0 0 8px 0;
  font-size: 20px;
  font-weight: 600;
  color: #323233;
  line-height: 1.4;
}

.base-type {
  display: inline-block;
  padding: 4px 8px;
  background-color: #e1f3d8;
  color: #67c23a;
  font-size: 12px;
  border-radius: 4px;
  margin-bottom: 12px;
}

.base-info-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #646566;
}

.base-body {
  padding: 20px;
}

.section {
  margin-bottom: 24px;
}

.section h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #323233;
}

.base-description {
  font-size: 14px;
  line-height: 1.6;
  color: #646566;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.activity-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background-color: #f7f8fa;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.activity-item:active {
  background-color: #ebedf0;
}

.activity-info {
  flex: 1;
}

.activity-name {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 500;
  color: #323233;
}

.activity-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #969799;
}

.activity-time,
.activity-location {
  display: flex;
  align-items: center;
  gap: 4px;
}

.activity-status {
  margin-top: 8px;
}

.base-actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px 20px;
  background: white;
  border-top: 1px solid #ebedf0;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
}

.activity-form {
  padding: 20px 0;
}

.error {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 300px;
}
</style>