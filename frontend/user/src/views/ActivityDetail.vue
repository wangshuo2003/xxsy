<template>
  <div class="activity-detail">
    <div v-if="loading" class="loading">
      <van-loading type="spinner" size="24px">加载中...</van-loading>
    </div>

    <div v-else-if="activity" class="content">
      <!-- 活动图片 -->
      <div class="activity-image">
        <img :src="activity.coverImage || '/default-activity.jpg'" :alt="activity.name" />
      </div>

      <!-- 活动信息 -->
      <div class="activity-info">
        <h1>{{ activity.name }}</h1>

        <div class="tags">
          <van-tag type="primary" size="large">{{ activity.type }}</van-tag>
          <van-tag
            :type="getStatusType(activity)"
            size="large"
            style="margin-left: 8px;"
          >
            {{ getStatusText(activity) }}
          </van-tag>
        </div>

        <div class="info-grid">
          <div class="info-item">
            <van-icon name="clock-o" size="16" />
            <span>{{ formatDateTime(activity.time) }}</span>
          </div>
          <div class="info-item">
            <van-icon name="location-o" size="16" />
            <span>{{ activity.location }}</span>
          </div>
          <div class="info-item" v-if="activity.base?.name">
            <van-icon name="hotel-o" size="16" />
            <span>{{ activity.base.name }}</span>
          </div>
          <div class="info-item" v-if="activity.maxPeople">
            <van-icon name="friends-o" size="16" />
            <span>{{ activity._count?.users || 0 }}/{{ activity.maxPeople }}人</span>
          </div>
          <div class="info-item price-item">
            <van-icon name="gold-coin-o" size="16" />
            <span class="price">¥{{ activity.price || 0 }}</span>
          </div>
        </div>

        <!-- 活动描述 -->
        <div class="description" v-if="activity.description">
          <h3>活动介绍</h3>
          <div class="description-content" v-html="activity.description"></div>
        </div>
      </div>

      <!-- 底部操作栏 -->
      <div class="bottom-bar">
        <van-button
          class="favorite-button"
          :class="{ 'favorited': isFavorited }"
          plain
          size="small"
          @click="toggleFavorite"
        >
          {{ isFavorited ? '已收藏' : '收藏' }}
        </van-button>

        <div class="main-actions">
          <van-button
            v-if="hasPendingRefund(activity)"
            type="warning"
            size="large"
            block
            disabled
          >
            退款审核中
          </van-button>
          <van-button
            v-else-if="hasPaidForActivity(activity) && canRefund(activity)"
            type="warning"
            size="large"
            block
            @click="handleRefund"
            :loading="refunding"
            class="refund-button"
          >
            申请退款
          </van-button>
          <van-button
            v-else-if="hasPaidForActivity(activity)"
            type="success"
            size="large"
            block
            disabled
          >
            已付款
          </van-button>
          <van-button
            v-else-if="hasRefundCompleted(activity)"
            type="default"
            size="large"
            block
            disabled
          >
            已退款
          </van-button>
          <van-button
            v-else-if="canRegister(activity) || isRegisteredUnpaid(activity)"
            :type="getButtonType(activity)"
            size="large"
            block
            @click="handleRegister"
            :loading="registering"
          >
            {{ getButtonText(activity) }}
          </van-button>
          <van-button
            v-else-if="isRegistered(activity) && !isRegisteredUnpaid(activity)"
            :type="getButtonType(activity)"
            size="large"
            block
            @click="activity.price && activity.price > 0 ? handleCancelRegistration() : null"
            :loading="canceling && activity.price && activity.price > 0"
            :disabled="!activity.price || activity.price === 0"
            :class="activity.price && activity.price > 0 ? 'cancel-registration-btn' : ''"
          >
            {{ getButtonText(activity) }}
          </van-button>
          <van-button
            v-else-if="isFull(activity)"
            size="large"
            block
            disabled
          >
            人数已满
          </van-button>
          <van-button
            v-else-if="isExpired(activity)"
            size="large"
            block
            disabled
          >
            已结束
          </van-button>
        </div>
      </div>
    </div>

    <div v-else class="error">
      <van-empty description="活动不存在或已被删除" />
    </div>
  </div>

  <van-dialog
    v-model:show="showRefundDialog"
    title="申请退款"
    show-cancel-button
    confirm-button-text="提交申请"
    cancel-button-text="取消"
    :confirm-button-loading="refunding"
    :close-on-click-overlay="false"
    @confirm="submitRefundRequest"
    @cancel="handleCloseRefundDialog"
  >
    <div class="refund-dialog-content">
      <van-field
        v-model="refundReason"
        type="textarea"
        rows="3"
        maxlength="100"
        show-word-limit
        placeholder="请输入退款原因（选填）"
        class="refund-dialog-field"
      />
      <p class="refund-dialog-tip">提交后需管理员审核，审核通过后金额将退回至账户余额。</p>
    </div>
  </van-dialog>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { showToast, showSuccessToast, showConfirmDialog } from 'vant'
import axios from 'axios'
import request from '@/api/request'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const activity = ref(null)
const loading = ref(true)
const registering = ref(false)
const canceling = ref(false) // 取消报名loading状态
const refunding = ref(false) // 退款loading状态
const userRegistration = ref(null) // 用户的报名信息
const isFavorited = ref(false) // 是否已收藏
const favoriteId = ref(null) // 收藏的ID
const userOrders = ref([]) // 用户的订单列表
const showRefundDialog = ref(false)
const refundReason = ref('')

// 获取用户订单
const fetchUserOrders = async () => {
  try {
    const response = await request.get('/orders', {
      params: { page: 1, limit: 100 }
    })
    userOrders.value = response.data || []
  } catch (error) {
    console.error('获取用户订单失败:', error)
    userOrders.value = []
  }
}

// 获取活动详情
const fetchActivityDetail = async () => {
  try {
    const response = await axios.get(`/api/activities/${route.params.id}`)
    activity.value = response.data.data

    // 如果用户已登录，检查报名状态、收藏状态和订单状态
    if (userStore.isLoggedIn) {
      await Promise.all([
        checkRegistrationStatus(),
        checkFavoriteStatus(),
        fetchUserOrders()
      ])
    }
  } catch (error) {
    console.error('获取活动详情失败:', error)
    showToast('获取活动详情失败')
  } finally {
    loading.value = false
  }
}

// 检查用户报名状态
const checkRegistrationStatus = async () => {
  try {
    // 获取用户的所有报名活动
    const response = await axios.get('/api/activities/my-registrations', {
      params: {
        page: 1,
        limit: 100  // 获取足够多的记录
      },
      headers: {
        'Authorization': `Bearer ${userStore.token}`
      }
    })

    // 查找当前活动的报名记录
    const registrations = response.data.data || []
    userRegistration.value = registrations.find(act => act.id === parseInt(route.params.id))
  } catch (error) {
    console.error('获取报名状态失败:', error)
    // 忽略错误，用户未报名
    userRegistration.value = null
  }
}

// 检查收藏状态
const checkFavoriteStatus = async () => {
  try {
    const response = await request.get('/favorites/check', {
      params: {
        targetType: 'activity',
        targetId: parseInt(route.params.id)
      }
    })
    isFavorited.value = response.isFavorited
    favoriteId.value = response.favoriteId
  } catch (error) {
    console.error('检查收藏状态失败:', error)
  }
}

// 切换收藏状态
const toggleFavorite = async () => {
  // 检查用户是否登录
  if (!userStore.isLoggedIn) {
    showToast('请先登录')
    router.push('/login')
    return
  }

  try {
    if (isFavorited.value) {
      // 取消收藏
      if (favoriteId.value) {
        await request.delete(`/favorites/${favoriteId.value}`)
        showSuccessToast('已取消收藏')
        isFavorited.value = false
        favoriteId.value = null
      }
    } else {
      // 添加收藏
      const response = await request.post('/favorites', {
        targetType: 'activity',
        targetId: parseInt(route.params.id)
      })
      showSuccessToast('收藏成功')
      isFavorited.value = true
      favoriteId.value = response.data.id
    }
  } catch (error) {
    console.error('收藏操作失败:', error)
    showToast('操作失败，请重试')
  }
}

// 格式化日期时间
const formatDateTime = (dateTimeString) => {
  const date = new Date(dateTimeString)
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

// 获取状态类型
const getStatusType = (activity) => {
  if (!activity.isApproved) return 'warning'
  if (!activity.isActive) return 'default'
  if (isExpired(activity)) return 'danger'
  return 'success'
}

// 获取状态文本
const getStatusText = (activity) => {
  if (!activity.isApproved) return '待审核'
  if (!activity.isActive) return '已下架'
  if (isExpired(activity)) return '已结束'
  return '进行中'
}

// 检查活动是否已过期
const isExpired = (activity) => {
  return new Date(activity.time) < new Date()
}

// 检查活动是否已报满
const isFull = (activity) => {
  return activity.maxPeople && activity._count?.users >= activity.maxPeople
}

// 检查是否可以报名
const canRegister = (activity) => {
  return (
    activity.isApproved &&
    activity.isActive &&
    !isExpired(activity) &&
    !isRegistered(activity) &&
    !isFull(activity)
  )
}

// 检查用户是否已报名
const isRegistered = (activity) => {
  return userRegistration.value !== null && userRegistration.value !== undefined
}

// 检查是否已报名但未支付
const isRegisteredUnpaid = (activity) => {
  return isRegistered(activity) && !hasPaidForActivity(activity) && (activity.price && activity.price > 0)
}

const findOrderForActivity = (activityId) => {
  return userOrders.value.find(order => order.activityId === activityId)
}

// 检查是否已支付
const hasPaidForActivity = (activity) => {
  if (activity.price === 0 || !activity.price) {
    return false
  }
  const order = findOrderForActivity(activity.id)
  if (!order) return false
  if (order.status === 'REFUNDED') return false
  return ['PAID', 'REFUNDING', 'COMPLETED'].includes(order.status)
}

const hasPendingRefund = (activity) => {
  const order = findOrderForActivity(activity.id)
  return order?.status === 'REFUNDING'
}

const hasRefundCompleted = (activity) => {
  const order = findOrderForActivity(activity.id)
  return order?.status === 'REFUNDED'
}

// 获取按钮文本
const getButtonText = (activity) => {
  const order = findOrderForActivity(activity.id)
  if (order?.status === 'REFUNDING') {
    return '退款审核中'
  }
  if (order?.status === 'REFUNDED') {
    return '已退款'
  }
  if (hasPaidForActivity(activity)) {
    return '已付款'
  } else if (isRegisteredUnpaid(activity)) {
    return '立即支付'
  } else if (isRegistered(activity)) {
    if (activity.price === 0 || !activity.price) {
      const statusMap = {
        'REGISTERED': '已报名待审核',
        'APPROVED': '报名已通过',
        'REJECTED': '报名已拒绝'
      }
      return statusMap[userRegistration.value?.status] || '已报名'
    } else {
      return '取消报名'
    }
  } else {
    return '立即报名'
  }
}

// 获取按钮类型
const getButtonType = (activity) => {
  const order = findOrderForActivity(activity.id)
  if (order?.status === 'REFUNDING') {
    return 'warning'
  }
  if (order?.status === 'REFUNDED') {
    return 'default'
  }
  if (hasPaidForActivity(activity)) {
    return 'success'
  } else if (isRegisteredUnpaid(activity)) {
    return 'warning'
  } else if (isRegistered(activity)) {
    if (activity.price === 0 || !activity.price) {
      const typeMap = {
        'REGISTERED': 'warning',
        'APPROVED': 'success',
        'REJECTED': 'danger'
      }
      return typeMap[userRegistration.value?.status] || 'default'
    } else {
      return 'danger'
    }
  } else {
    return 'primary'
  }
}

// 处理报名/支付
const handleRegister = async () => {
  // 检查用户是否登录
  if (!userStore.isLoggedIn) {
    showToast('请先登录')
    router.push('/login')
    return
  }

  // 如果已报名但未支付，跳转到支付页面
  if (isRegisteredUnpaid(activity.value)) {
    const price = activity.value.price || 0
    router.push({
      path: '/payment',
      query: {
        type: 'activity',
        id: activity.value.id,
        name: activity.value.name,
        price: price,
        image: activity.value.coverImage || '/default-activity.jpg'
      }
    })
    return
  }

  // 正常报名流程
  try {
    registering.value = true

    const response = await axios.post(
      `/api/activities/${activity.value.id}/register`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${userStore.token}`
        }
      }
    )

    // 报名成功后提示需要支付（如果活动有费用）
    if (activity.value.price && activity.value.price > 0) {
      showToast('报名成功，请完成支付')
    } else {
      showToast('报名成功')
    }

    // 重新获取活动详情和报名状态
    await checkRegistrationStatus()
    await fetchActivityDetail()

    // 添加调试信息
    console.log('=== 报名后调试信息 ===')
    console.log('活动ID:', activity.value?.id)
    console.log('活动价格:', activity.value?.price)
    console.log('用户报名状态:', userRegistration.value)
    console.log('用户订单列表:', userOrders.value)
    console.log('是否已报名:', isRegistered(activity.value))
    console.log('是否已支付:', hasPaidForActivity(activity.value))
    console.log('是否需要支付:', isRegisteredUnpaid(activity.value))
    console.log('按钮文本:', getButtonText(activity.value))
    console.log('========================')
  } catch (error) {
    console.error('报名失败:', error)
    showToast(error.response?.data?.error || '报名失败，请稍后重试')
  } finally {
    registering.value = false
  }
}

// 处理取消报名
const handleCancelRegistration = async () => {
  try {
    await showConfirmDialog({
      title: '确认取消',
      message: '确定要取消报名吗？',
    })

    canceling.value = true

    await axios.delete(
      `/api/activities/${activity.value.id}/register`,
      {
        headers: {
          'Authorization': `Bearer ${userStore.token}`
        }
      }
    )

    showToast('已取消报名')

    // 清空报名信息并重新获取活动详情
    userRegistration.value = null
    await fetchActivityDetail()
  } catch (error) {
    if (error.message !== 'cancel') {
      console.error('取消报名失败:', error)
      showToast(error.response?.data?.error || '取消报名失败，请稍后重试')
    }
  } finally {
    canceling.value = false
  }
}

// 检查是否可以退款
const canRefund = (activity) => {
  if (!hasPaidForActivity(activity)) return false

  const paidOrder = findOrderForActivity(activity.id)
  if (!paidOrder || paidOrder.status !== 'PAID') return false

  const activityTime = new Date(activity.time)
  const now = new Date()
  const timeDiff = activityTime - now

  return timeDiff > 24 * 60 * 60 * 1000
}

const handleRefund = () => {
  refundReason.value = ''
  showRefundDialog.value = true
}

const submitRefundRequest = async () => {
  if (!activity.value) return
  if (refunding.value) return
  const paidOrder = findOrderForActivity(activity.value.id)

  if (!paidOrder || paidOrder.status !== 'PAID') {
    showToast('找不到可退款的订单')
    return
  }

  try {
    refunding.value = true
    await request.post(`/orders/${paidOrder.id}/refund`, {
      reason: refundReason.value.trim() || '用户申请退款'
    })
    showSuccessToast('退款申请已提交')
    showRefundDialog.value = false
    await fetchUserOrders()
  } catch (error) {
    console.error('退款失败:', error)
    showToast(error.response?.data?.error || '退款失败，请稍后重试')
  } finally {
    refunding.value = false
  }
}

const handleCloseRefundDialog = () => {
  if (!refunding.value) {
    showRefundDialog.value = false
  }
}

onMounted(() => {
  fetchActivityDetail()
})
</script>

<style scoped>
.activity-detail {
  min-height: 100vh;
  background-color: #f7f8fa;
  padding-bottom: 80px;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

.content {
  background-color: white;
}

.activity-image {
  width: 100%;
  height: 250px;
  overflow: hidden;
}

.activity-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.activity-info {
  padding: 16px;
}

.activity-info h1 {
  margin: 0 0 12px 0;
  font-size: 20px;
  font-weight: 600;
  color: #333;
  line-height: 1.4;
}

.tags {
  margin-bottom: 16px;
}

.info-grid {
  margin-bottom: 20px;
}

.info-item {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  color: #666;
  font-size: 14px;
}

.info-item .van-icon {
  margin-right: 8px;
  color: #999;
}

.description {
  border-top: 1px solid #f0f0f0;
  padding-top: 16px;
}

.description h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.description-content {
  color: #666;
  line-height: 1.6;
  font-size: 14px;
}

.description-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
}

.price-item {
  color: #ff6034;
  font-weight: 600;
}

.price {
  font-size: 18px;
  font-weight: 700;
  color: #ff6034;
}

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: white;
  padding: 12px 16px;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 12px;
}

.main-actions {
  flex: 1;
  display: flex;
}

.favorite-btn {
  cursor: pointer;
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.favorite-btn:active {
  transform: scale(0.9);
}

.favorite-button {
  transition: all 0.3s ease;
  min-width: 80px;
}

.favorite-button.favorited {
  background-color: #ffd21d !important;
  color: #323233 !important;
  border-color: #ffd21d !important;
}

.paid-button {
  background-color: #07c160 !important;
  color: white !important;
  border-color: #07c160 !important;
  margin-bottom: 8px;
}

.refund-button {
  background-color: #ff976a !important;
  color: white !important;
  border-color: #ff976a !important;
}

.error {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 50vh;
}

.refund-dialog-content {
  padding: 12px 0;
}

.refund-dialog-tip {
  font-size: 12px;
  color: #999;
  margin: 8px 0 0;
}

.refund-dialog-field {
  margin-bottom: 8px;
}

</style>