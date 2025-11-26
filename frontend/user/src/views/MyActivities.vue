<template>
  <div class="my-activities">
    <van-tabs v-model:active="activeTab" @change="handleTabChange">
      <van-tab title="全部" name="all" />
      <van-tab title="待审核" name="REGISTERED" />
      <van-tab title="已通过" name="APPROVED" />
      <van-tab title="已拒绝" name="REJECTED" />
    </van-tabs>

    <div class="activities-content">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="没有更多了"
        @load="loadMore"
      >
        <van-card
          v-for="activity in activities"
          :key="activity.id"
          class="activity-card"
          :title="activity.name"
          :thumb="activity.coverImage || bingFallback"
          @click="goToDetail(activity.id)"
        >
          <template #tags>
            <van-tag type="primary" size="small">{{ activity.type }}</van-tag>
            <van-tag
              :type="getRegistrationStatusType(activity.registrationStatus)"
              size="small"
              style="margin-left: 4px;"
            >
              {{ getRegistrationStatusText(activity.registrationStatus) }}
            </van-tag>
          </template>

          <template #desc>
            <div class="activity-info">
              <div class="info-item" v-if="activity.base?.name">
                <van-icon name="hotel-o" size="14" />
                <span>{{ activity.base.name }}</span>
              </div>
              <div class="info-item">
                <van-icon name="clock-o" size="14" />
                <span>{{ formatDateTime(activity.time) }}</span>
              </div>
              <div class="info-item">
                <van-icon name="location-o" size="14" />
                <span>{{ activity.location }}</span>
              </div>
              <div class="info-item" v-if="activity.registeredAt">
                <van-icon name="records" size="14" />
                <span>报名于 {{ formatDateTime(activity.registeredAt) }}</span>
              </div>
              <div class="info-item" v-if="activity.price !== undefined && activity.price !== null">
                <van-icon name="gold-coin-o" size="14" />
                <span class="price">¥{{ activity.price || 0 }}</span>
              </div>
              <div class="info-item" v-if="activity._count?.users !== undefined">
                <van-icon name="friends-o" size="14" />
                <span>{{ activity._count.users }}/{{ activity.maxPeople || '不限' }}人</span>
              </div>
              <div class="info-item" v-if="activity.order && activity.order.amount !== undefined">
                <van-icon name="balance-pay" size="14" />
                <span class="order-amount" :class="{ 'paid': activity.order.status === 'PAID', 'pending': activity.order.status === 'PENDING' }">
                  订单金额: ¥{{ activity.order.amount || 0 }}
                  <van-tag :type="activity.order.status === 'PAID' ? 'success' : 'warning'" size="mini" style="margin-left: 4px;">
                    {{ activity.order.status === 'PAID' ? '已支付' : '待支付' }}
                  </van-tag>
                </span>
              </div>
            </div>
          </template>

          <template #footer>
            <div class="activity-footer">
              <van-button
                v-if="canPayNow(activity)"
                size="small"
                type="success"
                plain
                @click.stop="handlePayNow(activity)"
                :loading="activity.paying"
              >
                立即支付
              </van-button>
              <van-button
                size="small"
                type="primary"
                plain
                @click.stop="goToDetail(activity.id)"
              >
                查看详情
              </van-button>
              <van-button
                v-if="canCancelRegistration(activity)"
                size="small"
                type="danger"
                plain
                @click.stop="handleCancelRegistration(activity)"
                :loading="activity.cancelling"
              >
                取消报名
              </van-button>
            </div>
          </template>
        </van-card>
      </van-list>

      <van-empty
        v-if="!loading && activities.length === 0"
        description="暂无报名活动"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showConfirmDialog } from 'vant'
import axios from 'axios'
import { useUserStore } from '@/stores/user'
import { getBingFallback } from '@/utils/bingFallback'

const router = useRouter()
const userStore = useUserStore()
const bingFallback = getBingFallback()

const activeTab = ref('all')
const activities = ref([])
const loading = ref(false)
const finished = ref(false)
const page = ref(1)
const limit = 10

// 获取活动列表
const fetchActivities = async (reset = false) => {
  if (reset) {
    page.value = 1
    activities.value = []
    finished.value = false
  }

  loading.value = true
  try {
    const params = {
      page: page.value,
      limit
    }

    if (activeTab.value !== 'all') {
      params.status = activeTab.value
    }

    const response = await axios.get('/api/activities/my-registrations', {
      params,
      headers: {
        'Authorization': `Bearer ${userStore.token}`
      }
    })

    const newActivities = response.data.data || []

    if (reset) {
      activities.value = newActivities
    } else {
      activities.value = [...activities.value, ...newActivities]
    }

    // 检查是否还有更多数据
    const pagination = response.data.pagination
    if (pagination && page.value >= pagination.pages) {
      finished.value = true
    }

    loading.value = false
  } catch (error) {
    console.error('获取活动列表失败:', error)
    showToast('获取活动列表失败')
    loading.value = false
    finished.value = true
  }
}

// 加载更多
const loadMore = () => {
  if (!finished.value) {
    page.value++
    fetchActivities()
  }
}

// 切换标签页
const handleTabChange = () => {
  fetchActivities(true)
}

// 格式化日期时间
const formatDateTime = (dateTimeString) => {
  const date = new Date(dateTimeString)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

// 获取报名状态类型
const getRegistrationStatusType = (status) => {
  const typeMap = {
    'REGISTERED': 'warning',
    'APPROVED': 'success',
    'REJECTED': 'danger'
  }
  return typeMap[status] || 'default'
}

// 获取报名状态文本
const getRegistrationStatusText = (status) => {
  const textMap = {
    'REGISTERED': '待审核',
    'APPROVED': '已通过',
    'REJECTED': '已拒绝'
  }
  return textMap[status] || '未知'
}

// 检查是否可以取消报名
const canCancelRegistration = (activity) => {
  // 只有待审核和已通过的状态可以取消报名
  return activity.registrationStatus === 'REGISTERED' || activity.registrationStatus === 'APPROVED'
}

// 检查是否可以立即支付
const canPayNow = (activity) => {
  // 有未支付订单且报名状态为已通过时可以支付，但订单金额必须大于0
  const hasOrder = !!activity.order
  const isPendingOrder = activity.order && activity.order.status === 'PENDING'
  const isApprovedRegistration = activity.registrationStatus === 'APPROVED'
  const hasAmountToPay = activity.order && activity.order.amount > 0

  const canPay = hasOrder && isPendingOrder && isApprovedRegistration && hasAmountToPay

  
  return canPay
}

// 处理取消报名
const handleCancelRegistration = async (activity) => {
  try {
    await showConfirmDialog({
      title: '确认取消',
      message: `确定要取消"${activity.name}"的报名吗？`,
    })

    // 设置loading状态
    activity.cancelling = true

    await axios.delete(`/api/activities/${activity.id}/register`, {
      headers: {
        'Authorization': `Bearer ${userStore.token}`
      }
    })

    showToast('已取消报名')

    // 重新获取活动列表
    fetchActivities(true)
  } catch (error) {
    if (error.message !== 'cancel') {
      console.error('取消报名失败:', error)
      showToast(error.response?.data?.error || '取消报名失败')
    }
  } finally {
    // 清除loading状态
    activity.cancelling = false
  }
}

// 处理立即支付
const handlePayNow = async (activity) => {
  try {
    if (!activity.order) {
      showToast('订单信息不存在')
      return
    }

    // 设置loading状态
    activity.paying = true

    // 调用支付接口
    await axios.put(`/api/orders/${activity.order.id}/pay`, {}, {
      headers: {
        'Authorization': `Bearer ${userStore.token}`
      }
    })

    showToast('支付成功')

    // 重新获取活动列表
    fetchActivities(true)
  } catch (error) {
    console.error('支付失败:', error)
    showToast(error.response?.data?.error || '支付失败')
  } finally {
    // 清除loading状态
    activity.paying = false
  }
}

// 跳转到详情页
const goToDetail = (activityId) => {
  router.push(`/activity/${activityId}`)
}

onMounted(() => {
  fetchActivities(true)
})
</script>

<style scoped>
.my-activities {
  min-height: 100vh;
  background-color: #f7f8fa;
}

.activities-content {
  padding: 16px;
}

.activity-card {
  margin-bottom: 12px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  background-color: white;
  cursor: pointer;
  transition: all 0.3s ease;
}

.activity-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.activity-card :deep(.van-card__thumb) {
  width: 100px;
  height: 100px;
  border-radius: 8px;
  overflow: hidden;
}

.activity-card :deep(.van-card__content) {
  padding: 12px;
}

.activity-info {
  margin-top: 8px;
}

.info-item {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
  color: #666;
  font-size: 12px;
}

.info-item .van-icon {
  margin-right: 4px;
  color: #999;
}

.activity-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.activity-footer :deep(.van-button) {
  min-width: 70px;
}

.price {
  color: #ff6034;
  font-weight: 600;
}

.order-amount {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.order-amount.paid {
  color: #07c160;
}

.order-amount.pending {
  color: #ff976a;
}
</style>
