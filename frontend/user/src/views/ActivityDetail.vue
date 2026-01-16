<template>
  <div class="activity-detail">
    <div v-if="loading" class="loading">
      <van-loading type="spinner" size="24px">加载中...</van-loading>
    </div>

    <div v-else-if="activity" class="content-wrapper">
      <!-- 滚动内容区域 -->
      <div class="scrollable-content" ref="scrollContainerRef">
        <!-- 活动图片 -->
        <div class="activity-image">
          <img :src="activity.coverImage || bingFallback" :alt="activity.name" />
        </div>

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

          <div class="description" v-if="activity.description">
            <h3>活动介绍</h3>
            <div class="description-content" v-html="activity.description"></div>
          </div>

          <div
            v-if="order && ['REFUNDING', 'REFUNDED'].includes(order.status)"
            ref="refundInfoRef"
            class="refund-info"
          >
            <h3 class="refund-info-title">退款状态</h3>
            <p v-if="order.status === 'REFUNDING'" class="refund-info-text">
              退款申请已提交，正在审核中。
            </p>
            <p v-else class="refund-info-text refunded">
              已退款，金额将退回至账户余额。
            </p>
          </div>
          
          <!-- 用于滚动定位的锚点，高度设置为底部栏高度 + 缓冲，防止被遮挡 -->
          <div id="refund-anchor" style="height: 60px; width: 100%; pointer-events: none;"></div>
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
    :lock-scroll="false"
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
import { ref, onMounted, watch, computed, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { showToast, showSuccessToast, showConfirmDialog } from 'vant'
import request from '@/api/request'
import { getBingFallback } from '@/utils/bingFallback'
import { clearCache } from '@/utils/apiOptimizer'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const bingFallback = getBingFallback()

const activity = ref(null)
const loading = ref(true)
const registering = ref(false)
const canceling = ref(false)
const refunding = ref(false)
const cancelingRefund = ref(false)
const order = ref(null)
const userOrders = ref([])
const isFavorited = ref(false)
const favoriteId = ref(null)
const showRefundDialog = ref(false)
const refundReason = ref('')
const refundInfoRef = ref(null)
const scrollContainerRef = ref(null)

const loadUserOrdersForActivity = async () => {
  if (!userStore.isLoggedIn || !activity.value) return null
  try {
    const ordersResponse = await request.get('/orders', {
      params: { page: 1, limit: 500, activityId: activity.value.id }
    })
    
    // 修正：后端返回的是 { data: [], pagination: {} }
    if (ordersResponse.data && Array.isArray(ordersResponse.data.data)) {
      userOrders.value = ordersResponse.data.data
    } else if (Array.isArray(ordersResponse.data)) {
      userOrders.value = ordersResponse.data
    } else {
      userOrders.value = []
    }

    // 已有订单号时直接匹配
    if (route.params.orderId) {
      if (Array.isArray(userOrders.value)) {
        order.value = userOrders.value.find(o => o.orderNo === route.params.orderId) || null
      }
      return order.value
    }

    // 未带订单号，自动匹配最近的待支付或已支付订单
    if (Array.isArray(userOrders.value)) {
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
    }
    return null
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

const fetchPageData = async (showLoading = true) => {
  if (showLoading) {
    loading.value = true
  }
  try {
    // 1. 获取活动详情
    const activityResponse = await request.get(`/activities/${route.params.id}`)
    activity.value = activityResponse.data

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
    if (showLoading) {
      loading.value = false
    }
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
  console.log('handleRegister: 开始处理报名')
  
  try {
    // 检查用户是否登录
    if (!userStore.isLoggedIn) {
      showToast('请先登录')
      router.push('/login')
      return
    }

    registering.value = true
    const toast = showToast({ message: '正在处理报名...', forbidClick: true, duration: 0 })

    // 后端报名接口会创建订单
    console.log('handleRegister: 发起API请求')
    const registerResponse = await request.post(`/activities/${activity.value.id}/register`)
    console.log('handleRegister: API响应', registerResponse)
    
    // 清除缓存，确保其他页面（如列表页）状态最新
    if (userStore.user?.id) {
      clearCache(`user-orders-${userStore.user.id}`)
      clearCache(`user-registrations-${userStore.user.id}`)
    }
    
    // 兼容可能的数据结构
    const responseData = registerResponse.data || registerResponse
    const createdOrder = responseData.order || responseData.data?.order
    const price = activity.value.price || 0

    if (price > 0) {
      let targetOrder = createdOrder
      if (!targetOrder) {
        console.log('handleRegister: 未在响应中找到订单，尝试查找最新待支付订单')
        targetOrder = await findLatestPendingOrder()
      }

      if (targetOrder) {
        console.log('handleRegister: 找到订单，准备跳转支付', targetOrder)
        toast.close() // 关闭处理中的提示
        await redirectToPayment(targetOrder, '报名成功，正在跳转支付...')
        return
      }

      console.warn('handleRegister: 报名成功但未找到订单信息')
      toast.close()
      showToast('报名成功，但暂未找到订单，请稍后在“我的订单”查看')
      router.push('/orders')
      return
    }

    // 免费活动
    toast.close()
    showSuccessToast('报名成功')
    await fetchPageData()

  } catch (error) {
    console.error('报名失败:', error)
    showToast(error.response?.data?.error || '报名失败，请稍后重试')
  } finally {
    registering.value = false
  }
}

const redirectToPayment = async (targetOrder, toastMessage = null) => {
  if (!targetOrder) {
    console.error('redirectToPayment: 缺少订单信息')
    return false
  }

  // 更新本地状态
  order.value = targetOrder
  userOrders.value = [targetOrder, ...userOrders.value.filter(o => o.id !== targetOrder.id)]

  if (toastMessage) {
    showToast({ message: toastMessage, type: 'success', duration: 1500 })
  }

  // 构造参数
  const query = {
    type: 'activity',
    id: activity.value.id,
    name: activity.value.name,
    price: activity.value.price || 0,
    image: activity.value.coverImage || bingFallback,
    orderId: targetOrder.id,
    orderNo: targetOrder.orderNo
  }
  
  console.log('redirectToPayment: 构造支付参数', query)

  // 强制构建完整 URL 并使用 window.location.href 跳转
  // 这种方式最稳妥，避开 Vue Router 在某些环境下的潜在问题
  try {
    const { href } = router.resolve({ path: '/payment', query })
    console.log('redirectToPayment: 目标URL', href)
    
    // 延迟一小会儿确保 Toast 能被看到
    setTimeout(() => {
      window.location.href = href
    }, 500)
    
  } catch (e) {
    console.error('redirectToPayment: URL解析失败', e)
    // 最后的兜底
    router.push({ path: '/payment', query })
  }
  return true
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

const scrollToRefundInfo = () => {
  // 确保在可能的 DOM 更新和 Dialog 动画之后执行
  setTimeout(() => {
    // 1. 尝试找到 Layout.vue 中的滚动容器
    const scrollContainer = document.querySelector('.user-content') || document.documentElement || document.body
    
    // 2. 找到锚点
    const anchor = document.getElementById('refund-anchor')
    
    console.log('Scroll Debug:', {
      container: scrollContainer,
      anchor: anchor,
      scrollHeight: scrollContainer?.scrollHeight,
      clientHeight: scrollContainer?.clientHeight,
      scrollTop: scrollContainer?.scrollTop
    })

    if (anchor) {
      // 优先使用 scrollIntoView
      anchor.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
    
    // 3. 作为双重保障，如果容器可滚动，强制滚到底部
    if (scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight) {
      // 给一点缓冲时间让 scrollIntoView 先生效，如果没生效或不够到底，这里会补刀
      setTimeout(() => {
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: 'smooth'
        })
      }, 100)
    }
  }, 300)
}

const handleRefund = () => {
  refundReason.value = ''
  // 先尝试滚动，让用户看到底部区域（如果页面长的话）
  scrollToRefundInfo()
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
    
    // 刷新数据，但不显示全屏 loading，以免破坏滚动位置
    await fetchPageData(false)
    
    // 关键：提交成功后，状态已变为 REFUNDING，退款信息显示，此时必须滚动到底部
    scrollToRefundInfo()
    
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
  min-height: 100vh;
  background-color: #f7f8fa;
  display: flex;
  flex-direction: column;
  /* 适当的 padding 防止内容被底部固定栏遮挡，也不要太大 */
  padding-bottom: calc(100px + env(safe-area-inset-bottom));
}

.content-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

.scrollable-content {
  flex: 1;
  background-color: white;
  /* padding-bottom moved to activity-detail or kept here? 
     If we keep it here, it works too. Let's remove the bottom padding from here and put it on the container or keep it.
     Let's keep it here but remove height/overflow.
  */
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

.refund-info {
  margin-top: 12px;
  padding: 12px 12px 16px 12px;
  border-top: 1px solid #f0f0f0;
  background-color: #fff7f7;
}

.refund-info-title {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: #d93025;
}

.refund-info-text {
  margin: 0;
  font-size: 14px;
  color: #666;
}

.refund-info-text.refunded {
  color: #07c160;
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
