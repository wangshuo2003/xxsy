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
              disabled
            >
              退款审核中
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
import { ref, onMounted, computed, watch } from 'vue'
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
const order = ref(null) // 从URL获取的特定订单
const userOrders = ref([]) // 用户的订单列表，用于查找特定订单
const isFavorited = ref(false) // 是否已收藏
const favoriteId = ref(null) // 收藏的ID
const showRefundDialog = ref(false)
const refundReason = ref('')

const fetchPageData = async () => {
  loading.value = true
  try {
    // 1. 获取活动详情
    const activityResponse = await axios.get(`/api/activities/${route.params.id}`)
    activity.value = activityResponse.data.data

    // 2. 如果用户已登录，处理特定于用户的数据
    if (userStore.isLoggedIn) {
      const promises = [checkFavoriteStatus()]

      // 如果有 orderId，我们需要获取订单列表来查找它
      if (route.params.orderId) {
        promises.push(
          (async () => {
            try {
              const ordersResponse = await request.get('/orders', { params: { page: 1, limit: 500 } }) // 获取足够多的订单
              userOrders.value = ordersResponse.data || []
              order.value = userOrders.value.find(o => o.orderNo === route.params.orderId)
            } catch (e) {
              console.error('获取用户订单列表失败:', e)
            }
          })()
        )
      } else {
        // 如果没有orderId，可能需要检查用户是否已通过其他方式报名（例如免费活动）
        // 为简化起见，我们暂时只处理有orderId和完全未报名的情况
        // 可以根据需要在这里添加检查用户报名的逻辑
      }
      
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

// 处理报名/支付
const handleRegister = async () => {
  // 检查用户是否登录
  if (!userStore.isLoggedIn) {
    showToast('请先登录')
    router.push('/login')
    return
  }
  
  const isReregister = order.value?.status === 'CANCELLED'

  // 正常报名流程
  try {
    registering.value = true

    // 后端报名接口会创建订单
    await axios.post(
      `/api/activities/${activity.value.id}/register`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${userStore.token}`
        }
      }
    )

    // 报名成功后，对于付费活动，根据场景决定是跳转还是提示
    if (activity.value.price && activity.value.price > 0) {
      // 重新获取所有页面数据，特别是订单列表
      await fetchPageData()
      
      // 在已取消订单页重新报名，则直接跳转到新订单
      if (isReregister) {
        const newOrder = userOrders.value
          .filter(o => o.activityId === activity.value.id && o.status === 'PENDING')
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
        
        if (newOrder) {
          // 步骤1: 替换当前历史记录为新订单的URL
          await router.replace(`/activity/${activity.value.id}/${newOrder.orderNo}`)
          // 步骤2: 跳转到支付页面（这会成为历史记录里的新的一页）
          router.push({
            path: '/payment',
            query: {
              type: 'activity',
              id: activity.value.id,
              name: activity.value.name,
              price: activity.value.price,
              image: activity.value.coverImage || '/default-activity.jpg',
              orderId: newOrder.id, // 支付页面需要数字ID
              orderNo: newOrder.orderNo // 也加上字符串订单号
            }
          })
          return // 完成跳转，结束函数
        }
      }

      // 对于其他情况（如首次报名），显示弹窗提示
      await showConfirmDialog({
        title: '报名成功',
        message: '您的订单已创建，请前往“我的订单”页面完成支付。',
        confirmButtonText: '查看订单',
        cancelButtonText: '关闭',
      }).then((result) => {
        if (result) {
          router.push('/orders')
        }
      })

    } else {
      // 免费活动
      showSuccessToast('报名成功')
      await fetchPageData()
    }

  } catch (error) {
    console.error('报名失败:', error)
    showToast(error.response?.data?.error || '报名失败，请稍后重试')
  } finally {
    registering.value = false
  }
}

const handlePay = () => {
  if (!order.value) return;

  const price = activity.value.price || 0
  router.push({
    path: '/payment',
    query: {
      type: 'activity',
      id: activity.value.id,
      name: activity.value.name,
      price: price,
      image: activity.value.coverImage || '/default-activity.jpg',
      orderId: order.value.id // 传递订单ID用于更新支付状态
    }
  })
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