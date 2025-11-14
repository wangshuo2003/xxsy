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
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showSuccessToast, showConfirmDialog } from 'vant'
import request from '@/api/request'

const router = useRouter()

const loading = ref(true)
const orders = ref([])
const filterStatus = ref('all')

const statusTabs = [
  { label: '全部', value: 'all' },
  { label: '已支付', value: 'PAID' },
  { label: '未支付', value: 'PENDING' },
  { label: '退款', value: 'REFUND' }
]

const filteredOrders = computed(() => {
  if (filterStatus.value === 'PAID') {
    return orders.value.filter(order => order.status === 'PAID' && !order.isRefunded)
  }
  if (filterStatus.value === 'PENDING') {
    return orders.value.filter(order => order.status === 'PENDING')
  }
  if (filterStatus.value === 'REFUND') {
    return orders.value.filter(order => order.isRefunded)
  }
  return orders.value
})

const setFilterStatus = (status) => {
  filterStatus.value = status
}

// 获取订单列表
const fetchOrders = async () => {
  try {
    const response = await request.get('/orders')
    console.log('Orders response:', response) // 添加调试日志
    console.log('Response data type:', typeof response.data)
    console.log('Response data is array:', Array.isArray(response.data))
    console.log('Response data length:', response.data?.length)
    console.log('First order:', response.data?.[0])

    // 确保订单数据是数组
    const ordersArray = Array.isArray(response.data) ? response.data : []
    orders.value = ordersArray

    console.log('Orders value after assignment:', orders.value)
    console.log('Orders is array:', Array.isArray(orders.value))
    console.log('Orders length:', orders.value.length)
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
    return '研学活动'
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
    return '/default-activity.jpg'
  }
  return '/default-product.jpg'
}

// 获取状态文本
const getStatusText = (status) => {
  const statusMap = {
    'PENDING': '待支付',
    'PAID': '已支付',
    'CANCELLED': '已取消'
  }
  return statusMap[status] || status
}

// 获取状态样式类
const getStatusClass = (status) => {
  const classMap = {
    'PENDING': 'status-pending',
    'PAID': 'status-paid',
    'CANCELLED': 'status-cancelled'
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
    router.push(`/activity/${order.activity.id}`)
  } else if (order.service) {
    showToast('服务详情功能开发中')
  }
}

// 跳转到订单详情
const goToOrderDetail = (order) => {
  // 点击订单跳转到对应的活动详情页面
  if (order.activity) {
    router.push(`/activity/${order.activity.id}`)
  } else if (order.service) {
    showToast('服务详情功能开发中')
  }
}

// 返回上一页
const handleGoBack = () => {
  if (window.history.length > 1) {
    router.go(-1)
  } else {
    router.push('/home')
  }
}

onMounted(() => {
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
