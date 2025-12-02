<template>
  <div class="activity-detail">
    <div v-if="loading" class="loading">
      <van-loading type="spinner" size="24px">加载中...</van-loading>
    </div>

    <div v-else-if="activity" class="content-wrapper">
      <!-- 滚动内容区域 -->
      <div class="scrollable-content">
        <!-- 活动图片 -->
        <div class="activity-image">
          <img :src="activity.coverImage || bingFallback" :alt="activity.name" />
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
      </div>

      <!-- 底部操作栏：固定在内容区域下方 -->
      <div v-if="!showRefundDialog" class="bottom-bar">
        <van-button
          class="favorite-button"
          :class="{ 'favorited': isFavorited }"
          plain
          size="large"
          @click="toggleFavorite"
        >
          {{ isFavorited ? '已收藏' : '收藏' }}
        </van-button>

        <div class="main-actions">
          <!-- 1. 如果有来自URL的订单上下文 -->
          <div v-if="order" style="display: contents;">
            <van-button
              v-if="order.status === 'PENDING'"
              type="warning"
              size="large"
              block
              @click="handlePay"
            >
              立即支付
            </van-button>
            <van-button
              v-else-if="order.status === 'CANCELLED'"
              type="primary"
              size="large"
              block
              @click="handleRegister"
              :loading="registering"
            >
              立即报名
            </van-button>
            <van-button
              v-else-if="order.status === 'PAID' && canApplyForRefund"
              type="danger"
              size="large"
              block
              @click="handleRefund"
              :loading="refunding"
              class="refund-button"
            >
              申请退款
            </van-button>
            <van-button
              v-else-if="order.status === 'PAID' && !canApplyForRefund"
              type="success"
              size="large"
              block
              disabled
            >
              已付款
            </van-button>
            <van-button
              v-else-if="order.status === 'REFUNDING'"
              type="warning"
              size="large"
              block
              @click="handleCancelRefund"
              :loading="cancelingRefund"
            >
              取消退款
            </van-button>
            <van-button
              v-else-if="order.status === 'REFUNDED'"
              type="default"
              size="large"
              block
              disabled
            >
              已退款
            </van-button>
          </div>

          <!-- 2. 如果没有订单上下文，走默认报名逻辑 -->
          <div v-else style="display: contents;">
            <van-button
              v-if="isFull(activity)"
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
            <van-button
              v-else-if="!userStore.isLoggedIn || (activity.isApproved && activity.isActive)"
              type="primary"
              size="large"
              block
              @click="handleRegister"
              :loading="registering"
            >
              立即报名
            </van-button>
          </div>
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
import { ref, onMounted, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { showToast, showSuccessToast, showConfirmDialog } from 'vant'
import axios from 'axios'
import request from '@/api/request'
import { getBingFallback } from '@/utils/bingFallback'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const bingFallback = getBingFallback()

const activity = ref(null)
const loading = ref(true)
const registering = ref(false)
const canceling = ref(false) // 取消报名loading状态
const refunding = ref(false) // 退款loading状态
const cancelingRefund = ref(false) // 取消退款loading状态
const order = ref(null) // 从URL获取的特定订单
const userOrders = ref([]) // 用户的订单列表，用于查找特定订单
const isFavorited = ref(false) // 是否已收藏
const favoriteId = ref(null) // 收藏的ID
const showRefundDialog = ref(false)
const refundReason = ref('')

const loadUserOrdersForActivity = async () => {
  if (!userStore.isLoggedIn || !activity.value) return null
  try {
    const ordersResponse = await request.get('/orders', {
      params: { page: 1, limit: 500, activityId: activity.value.id }
    })
    userOrders.value = ordersResponse.data || []

    // 已有订单号时直接匹配
    if (route.params.orderId) {
      order.value = userOrders.value.find(o => o.orderNo === route.params.orderId) || null
      return order.value
    }

    // 未带订单号，自动匹配最近的待支付或已支付订单
    const targetOrder = userOrders.value
      .filter(o => o.activityId === activity.value.id && ['PENDING', 'PAID', 'REFUNDING'].includes(o.status))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]

    if (targetOrder) {
      order.value = targetOrder
      try {
        await router.replace(`/activity/${activity.value.id}/${targetOrder.orderNo}`)
      } catch (err) {
        console.error('更新订单上下文失败:', err)
      }
    }

    return targetOrder
  } catch (error) {
    console.error('获取用户订单列表失败:', error)
    return null
  }
}

const findLatestPendingOrder = async () => {
  if (!activity.value) return null

  // 先利用已有订单列表
  if (userOrders.value.length) {
    const cached = userOrders.value
      .filter(o => o.activityId === activity.value.id && o.status === 'PENDING')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
    if (cached) return cached
  }

  // 没有缓存再拉取
  return loadUserOrdersForActivity()
}

const redirectToPayment = async (targetOrder, toastMessage = null) => {
  if (!targetOrder) return false

  order.value = targetOrder
  userOrders.value = [targetOrder, ...userOrders.value.filter(o => o.id !== targetOrder.id)]

  if (targetOrder.orderNo) {
    try {
      await router.replace(`/activity/${activity.value.id}/${targetOrder.orderNo}`)
    } catch (err) {
      console.error('更新订单上下文失败:', err)
    }
  }

  if (toastMessage) {
    showSuccessToast(toastMessage)
  }

  router.push({
    path: '/payment',
    query: {
      type: 'activity',
      id: activity.value.id,
      name: activity.value.name,
      price: activity.value.price || 0,
      image: activity.value.coverImage || bingFallback,
      orderId: targetOrder.id,
      orderNo: targetOrder.orderNo
    }
  })

  return true
}

const fetchPageData = async () => {
  loading.value = true
  try {
    // 1. 获取活动详情
    const activityResponse = await axios.get(`/api/activities/${route.params.id}`)
    activity.value = activityResponse.data.data

    // 2. 如果用户已登录，处理特定于用户的数据
    if (userStore.isLoggedIn) {
      const promises = [checkFavoriteStatus(), loadUserOrdersForActivity()]
      await Promise.all(promises)
    }
  } catch (error) {
    console.error('获取活动详情失败:', error)
    activity.value = null // 清空活动数据
    showToast('获取活动详情失败')
  } finally {
    loading.value = false
  }
}

// 检查收藏状态
const checkFavoriteStatus = async () => {
  const activityId = parseInt(route.params.id)
  if (!activityId || Number.isNaN(activityId)) {
    return
  }

  try {
    const response = await request.get('/favorites/check', {
      params: {
        targetType: 'activity',
        targetId: activityId
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

// 处理报名/支付
const handleRegister = async () => {
  // 检查用户是否登录
  if (!userStore.isLoggedIn) {
    showToast('请先登录')
    router.push('/login')
    return
  }

  // 正常报名流程
  try {
    registering.value = true

    // 后端报名接口会创建订单
    const registerResponse = await axios.post(
      `/api/activities/${activity.value.id}/register`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${userStore.token}`
        }
      }
    )

    const createdOrder = registerResponse.data?.data?.order
    const price = activity.value.price || 0

    if (price > 0) {
      let targetOrder = createdOrder
      if (!targetOrder) {
        targetOrder = await findLatestPendingOrder()
      }

      if (await redirectToPayment(targetOrder, '报名成功，前往支付')) {
        return
      }

      showToast('报名成功，但暂未找到订单，请稍后在“我的订单”查看')
      router.push('/orders')
      return
    }

    // 免费活动
    showSuccessToast('报名成功')
    await fetchPageData()

  } catch (error) {
    console.error('报名失败:', error)
    showToast(error.response?.data?.error || '报名失败，请稍后重试')
  } finally {
    registering.value = false
  }
}

const handlePay = () => {
  if (!order.value) return
  redirectToPayment(order.value)
}

// 检查是否可以退款
const canApplyForRefund = computed(() => {
  if (!order.value || !activity.value || order.value.status !== 'PAID') {
    return false
  }
  // 活动开始前24小时以上才可退款
  const activityTime = new Date(activity.value.time)
  const now = new Date()
  const timeDiff = activityTime.getTime() - now.getTime()
  return timeDiff > 24 * 60 * 60 * 1000
})

const handleRefund = () => {
  refundReason.value = ''
  showRefundDialog.value = true
}

const submitRefundRequest = async () => {
  if (!order.value) {
    showToast('找不到可退款的订单')
    return
  }
  if (refunding.value) return

  if (order.value.status !== 'PAID') {
    showToast('订单状态不正确，无法退款')
    return
  }

  try {
    refunding.value = true
    await request.post(`/orders/${order.value.id}/refund`, {
      reason: refundReason.value.trim() || '用户申请退款'
    })
    showSuccessToast('退款申请已提交')
    showRefundDialog.value = false
    await fetchPageData() // 刷新页面数据
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

const handleCancelRefund = async () => {
  if (!order.value) {
    showToast('找不到可取消的订单')
    return
  }
  if (cancelingRefund.value) return

  if (order.value.status !== 'REFUNDING') {
    showToast('订单状态不正确，无法取消退款')
    return
  }

  // 显示确认对话框
  showConfirmDialog({
    title: '确认取消',
    message: '确定要取消退款申请吗？取消后订单将恢复为已支付状态。',
    confirmButtonText: '确定取消',
    cancelButtonText: '再想想'
  }).then(async () => {
    try {
      cancelingRefund.value = true
      await request.delete(`/orders/${order.value.id}/refund`)
      showSuccessToast('退款申请已取消')
      await fetchPageData() // 刷新页面数据
    } catch (error) {
      console.error('取消退款失败:', error)
      showToast(error.response?.data?.error || '取消退款失败，请稍后重试')
    } finally {
      cancelingRefund.value = false
    }
  }).catch(() => {
    // 用户点击了取消，不执行任何操作
  })
}

onMounted(() => {
  fetchPageData()
})

watch(() => route.params.orderId, (newOrderId, oldOrderId) => {
  if (newOrderId !== oldOrderId) {
    fetchPageData()
  }
})
</script>

<style scoped>
.activity-detail {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background-color: #f7f8fa;
  display: flex;
  flex-direction: column;
}

.content-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  position: relative;
  overflow: hidden;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

.scrollable-content {
  flex: 1;
  height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  background-color: white;
  padding-bottom: calc(140px + env(safe-area-inset-bottom));
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
  margin-bottom: 20px; /* 为底部间距 */
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
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
  z-index: 2;
  display: flex;
  align-items: stretch;
  gap: 12px;
  flex-shrink: 0;
}

:deep(.van-overlay) {
  z-index: 20 !important;
}

:deep(.van-dialog) {
  z-index: 21 !important;
}

.main-actions {
  flex: 1;
  display: flex;
  gap: 12px;
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
  flex: 1;
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
  background-color: #ee0a24 !important;
  color: white !important;
  border-color: #ee0a24 !important;
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
