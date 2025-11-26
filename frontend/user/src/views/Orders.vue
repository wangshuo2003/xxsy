<template>
  <div class="orders-page">
    <van-nav-bar title="我的订单" left-arrow @click-left="handleGoBack" />

    <div class="status-tabs">
      <div
        v-for="tab in statusTabs"
        :key="tab.value"
        :class="['status-tab', { active: filterStatus === tab.value }]"
        @click="setFilterStatus(tab.value)"
      >
        {{ tab.label }}
      </div>
    </div>

    <div v-if="loading" class="loading">
      <van-loading size="24px" vertical>加载中...</van-loading>
    </div>

    <div v-else-if="filteredOrders.length === 0" class="empty">
      <van-empty description="暂无订单" />
    </div>

    <div v-else class="orders-list">
      <div
        v-for="order in filteredOrders"
        :key="order.id"
        class="order-card"
        @click="goToOrderDetail(order)"
      >
        <div class="order-header">
          <span class="order-number">订单号：{{ order.orderNo }}</span>
          <span :class="['order-status', getStatusClass(order.status)]">
            {{ getStatusText(order.status) }}
          </span>
        </div>

        <div class="order-content">
          <img
            :src="getOrderImage(order)"
            :alt="getOrderName(order)"
            class="order-image"
          />
          <div class="order-details">
            <h4>{{ getOrderName(order) }}</h4>
            <p class="order-type">{{ getOrderType(order) }}</p>
            <p v-if="order.status === 'REFUNDING'" class="refund-status-text">退款审核中</p>
            <p v-else-if="order.status === 'REFUNDED'" class="refund-status-text refunded">已退款</p>
            <p class="order-time">下单时间：{{ formatDateTime(order.createdAt) }}</p>
            <p v-if="order.status === 'PAID'" class="payment-time">付款时间：{{ formatDateTime(order.updatedAt) }}</p>
          </div>
        </div>

        <div class="order-footer">
          <span class="order-amount">¥{{ order.amount.toFixed(2) }}</span>
          <div class="order-actions">
            <van-button
              v-if="order.status === 'PENDING'"
              size="small"
              type="primary"
              @click.stop="handlePay(order)"
            >
              立即支付
            </van-button>
            <van-button
              v-if="order.status === 'PENDING'"
              size="small"
              @click.stop="handleCancel(order)"
            >
              取消订单
            </van-button>
            <van-button
              v-if="order.status === 'PAID'"
              size="small"
              @click.stop="handleViewDetails(order)"
            >
              查看详情
            </van-button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="totalPages > 1" class="orders-pagination">
      <van-button size="small" :disabled="currentPage <= 1" @click="handleGoToFirst">首页</van-button>
      <van-button size="small" :disabled="currentPage <= 1" @click="handlePrevPage">上一页</van-button>
      <span class="page-info">第 {{ currentPage }} / {{ totalPages }} 页</span>
      <van-button size="small" :disabled="currentPage >= totalPages" @click="handleNextPage">下一页</van-button>
      <van-button size="small" :disabled="currentPage >= totalPages" @click="handleGoToLast">末页</van-button>
      <div class="jump-section">
        <van-field
          v-model="jumpPageInput"
          type="digit"
          placeholder="页码"
          class="jump-input"
          maxlength="4"
          @keyup.enter="handleJumpPage"
        />
        <van-button size="small" type="primary" @click="handleJumpPage">跳转</van-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showToast, showSuccessToast, showConfirmDialog } from 'vant'
import request from '@/api/request'
import { getBingFallback } from '@/utils/bingFallback'

const router = useRouter()
const route = useRoute()

const loading = ref(true)
const orders = ref([])
const filterStatus = ref('all')
const currentPage = ref(1)
const itemsPerPage = 10
const totalOrders = ref(0)
const jumpPageInput = ref('')
const bingFallback = getBingFallback()

const statusTabs = [
  { label: '全部', value: 'all' },
  { label: '已支付', value: 'PAID' },
  { label: '未支付', value: 'PENDING' },
  { label: '退款', value: 'REFUND' }
]

const filteredOrders = computed(() => orders.value)

const setFilterStatus = (status) => {
  if (filterStatus.value === status) return
  filterStatus.value = status
  currentPage.value = 1
  
  // 更新URL查询参数
  router.replace({
    path: '/orders',
    query: { ...route.query, tab: status }
  })
  
  fetchOrders()
}

// 监听路由参数变化
watch(() => route.query.tab, (newTab) => {
  if (newTab && newTab !== filterStatus.value) {
    filterStatus.value = newTab
    currentPage.value = 1
    fetchOrders()
  }
})

// 获取订单列表
const fetchOrders = async () => {
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      limit: itemsPerPage
    }
    if (filterStatus.value !== 'all') {
      params.status = filterStatus.value
    } else {
      // 在【全部】页面，按修改时间倒序排列（满足：付款后订单时间被修改，排在前面）
      params.sortBy = 'updatedAt'
    }

    const response = await request.get('/orders', { params })

    const extractOrders = (payload) => {
      if (Array.isArray(payload)) return payload
      if (Array.isArray(payload?.data)) return payload.data
      if (Array.isArray(payload?.records)) return payload.records
      if (Array.isArray(payload?.list)) return payload.list
      if (Array.isArray(payload?.data?.data)) return payload.data.data
      return []
    }

    let ordersArray = extractOrders(response)
    const pagination = response.pagination || {}
    const total = typeof pagination.total === 'number' ? pagination.total : ordersArray.length
    const pageCount = pagination.pages || Math.max(1, Math.ceil((total || 1) / itemsPerPage))

    if (ordersArray.length === 0 && total > 0 && currentPage.value > pageCount) {
      currentPage.value = pageCount
      return fetchOrders()
    }

    orders.value = ordersArray.map(order => ({ ...order }))
    totalOrders.value = total
  } catch (error) {
    console.error('获取订单失败:', error)
    showToast('获取订单失败')
  } finally {
    loading.value = false
  }
}

// 获取订单名称
const getOrderName = (order) => {
  if (order.activity) {
    return order.activity.name
  }
  if (order.service) {
    return order.service.title
  }
  return '未知订单'
}

// 获取订单类型
const getOrderType = (order) => {
  if (order.activity) {
    const typeMap = {
      '研学': '研学活动',
      '公益': '公益活动',
      '实践': '实践活动',
      '赛事': '赛事活动'
    }
    const activityType = order.activity.type
    return typeMap[activityType] || (activityType ? `${activityType}活动` : '活动订单')
  }
  if (order.service) {
    return '特色服务'
  }
  return '未知类型'
}

// 获取订单图片
const getOrderImage = (order) => {
  if (order.service?.coverImage) {
    return order.service.coverImage
  }
  // Activity没有coverImage字段，使用默认图片
  if (order.activity) {
    return bingFallback
  }
  return bingFallback
}

// 获取状态文本
const getStatusText = (status) => {
  const statusMap = {
    'PENDING': '待支付',
    'PAID': '已支付',
    'CANCELLED': '已取消',
    'REFUNDING': '退款处理中',
    'REFUNDED': '已退款'
  }
  return statusMap[status] || status
}

// 获取状态样式类
const getStatusClass = (status) => {
  const classMap = {
    'PENDING': 'status-pending',
    'PAID': 'status-paid',
    'CANCELLED': 'status-cancelled',
    'REFUNDING': 'status-refunding',
    'REFUNDED': 'status-refunded'
  }
  return classMap[status] || ''
}

// 格式化日期时间
const formatDateTime = (dateTimeString) => {
  const date = new Date(dateTimeString)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

// 处理支付
const handlePay = async (order) => {
  const query = {
    type: order.activity ? 'activity' : 'service',
    id: order.activity?.id || order.service?.id,
    name: getOrderName(order),
    price: order.amount.toFixed(2),
    image: getOrderImage(order),
    orderId: order.id // 传递订单ID用于更新支付状态
  }

  router.push({
    path: '/payment',
    query
  })
}

// 处理取消订单
const handleCancel = async (order) => {
  try {
    await showConfirmDialog({
      title: '确认取消',
      message: '确定要取消这个订单吗？取消后将无法恢复。',
    })

    await request.put(`/orders/${order.id}/cancel`)
    showSuccessToast('订单已取消')

    // 重新获取订单列表
    await fetchOrders()
  } catch (error) {
    if (error.message !== 'cancel') {
      console.error('取消订单失败:', error)
      showToast(error.response?.data?.error || '取消失败')
    }
  }
}

// 查看订单详情
const handleViewDetails = (order) => {
  // 点击查看详情按钮跳转到对应的活动详情页面
  if (order.activity) {
    router.push(`/activity/${order.activity.id}/${order.orderNo}`)
  } else if (order.service) {
    showToast('服务详情功能开发中')
  }
}

// 跳转到订单详情
const goToOrderDetail = (order) => {
  // 点击订单跳转到对应的活动详情页面
  if (order.activity) {
    router.push(`/activity/${order.activity.id}/${order.orderNo}`)
  } else if (order.service) {
    showToast('服务详情功能开发中')
  }
}

// 返回上一页
const handleGoBack = () => {
  // 从订单页返回时，统一落到“我的”，避免回到支付页
  router.push('/profile')
}

const totalPages = computed(() => Math.max(1, Math.ceil((totalOrders.value || 0) / itemsPerPage)))

const handlePrevPage = () => {
  if (currentPage.value <= 1) return
  currentPage.value -= 1
  fetchOrders()
}

const handleNextPage = () => {
  if (currentPage.value >= totalPages.value) return
  currentPage.value += 1
  fetchOrders()
}

const handleGoToFirst = () => {
  if (currentPage.value === 1) return
  currentPage.value = 1
  fetchOrders()
}

const handleGoToLast = () => {
  if (currentPage.value === totalPages.value) return
  currentPage.value = totalPages.value
  fetchOrders()
}

const handleJumpPage = () => {
  const target = parseInt(jumpPageInput.value, 10)
  if (Number.isNaN(target)) {
    showToast('请输入正确的页码')
    return
  }
  const normalized = Math.min(Math.max(1, target), totalPages.value)
  if (normalized === currentPage.value) return
  currentPage.value = normalized
  fetchOrders()
  jumpPageInput.value = ''
}

onMounted(() => {
  // 初始化时从URL获取tab状态
  const tab = route.query.tab
  if (tab && ['all', 'PAID', 'PENDING', 'REFUND'].includes(tab)) {
    filterStatus.value = tab
  }
  fetchOrders()
})
</script>

<style scoped>
.orders-page {
  min-height: 100vh;
  background-color: #f7f8fa;
  padding-bottom: 60px; /* 为底部导航栏留出空间 */
}

.status-tabs {
  display: flex;
  background: white;
  padding: 12px 16px;
  gap: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.status-tab {
  flex: 1;
  text-align: center;
  padding: 8px 0;
  border-radius: 20px;
  font-size: 14px;
  color: #666;
  background-color: #f5f5f5;
  cursor: pointer;
  transition: all 0.2s ease;
}

.status-tab.active {
  color: #fff;
  background-color: #1989fa;
  font-weight: 600;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 300px;
}

.empty {
  padding: 60px 20px;
}

.orders-list {
  padding: 16px;
}

.orders-pagination {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 12px;
  padding: 0 16px 24px;
}

.orders-pagination .page-info {
  font-size: 14px;
  color: #666;
}

.jump-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.jump-input {
  width: 80px;
}

.order-card {
  background: white;
  border-radius: 8px;
  margin-bottom: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: transform 0.2s ease;
}

.order-card:active {
  transform: scale(0.98);
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.order-number {
  font-size: 14px;
  color: #666;
}

.order-status {
  font-size: 14px;
  font-weight: 600;
}

.status-pending {
  color: #ff976a;
}

.status-paid {
  color: #07c160;
}

.status-cancelled {
  color: #969799;
}

.status-refunding {
  color: #ffb300;
}

.status-refunded {
  color: #1989fa;
}

.order-content {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.order-image {
  width: 60px;
  height: 60px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
}

.order-details {
  flex: 1;
}

.order-details h4 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
  line-height: 1.4;
}

.order-type {
  margin: 4px 0;
  font-size: 13px;
  color: #666;
}

.refund-status-text {
  font-size: 12px;
  color: #ffb300;
  margin: 0;
}

.refund-status-text.refunded {
  color: #07c160;
}

.order-time {
  margin: 4px 0 0 0;
  font-size: 12px;
  color: #999;
}

.payment-time {
  margin: 2px 0 0 0;
  font-size: 12px;
  color: #07c160;
  font-weight: 500;
}

.order-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.order-amount {
  font-size: 18px;
  font-weight: 700;
  color: #ff6034;
}

.order-actions {
  display: flex;
  gap: 8px;
}
</style>
