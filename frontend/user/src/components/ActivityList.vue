<template>
  <div class="activity-list">
    <!-- 活动列表 -->
    <van-list
      :loading="props.loading"
      :finished="finished"
      :finished-text="props.infinite ? '没有更多了' : ''"
      @load="$emit('load-more')"
    >
      <van-card
        v-for="activity in props.activities"
        :key="activity.id"
        class="activity-card"
        :title="activity.name"
        :thumb="getActivityThumb(activity)"
        @click="goToDetail(activity.id)"
      >
        <template #tags>
          <van-tag type="primary" size="small">{{ activity.type }}</van-tag>
          <van-tag
            :type="getStatusType(activity)"
            size="small"
            style="margin-left: 4px;"
          >
            {{ getStatusText(activity) }}
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
            <div class="info-item">
              <van-icon name="gold-coin-o" size="14" />
              <span>{{ activity.price || 0 }}元</span>
            </div>
            <div class="info-item" v-if="activity.maxPeople">
              <van-icon name="friends-o" size="14" />
              <span>已报名{{ activity._count?.users || 0 }}/{{ activity.maxPeople }}人</span>
            </div>
            <div class="activity-description" v-if="activity.description">
              {{ activity.description }}
            </div>
          </div>
        </template>

        <template #footer>
          <div class="activity-footer">
            <template v-if="props.dataReady">
              <van-button
                class="favorite-button"
                :class="{ 'favorited': isFavorited(activity.id) }"
                plain
                size="small"
                @click.stop="toggleFavorite(activity.id)"
              >
                {{ isFavorited(activity.id) ? '已收藏' : '收藏' }}
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
                v-if="canRegister(activity)"
                size="small"
                type="primary"
                @click.stop="handleRegister(activity)"
                :loading="registering[activity.id]"
              >
                立即报名
              </van-button>
              <van-button
                v-else-if="isRegistered(activity)"
                size="small"
                :type="getRegisteredButtonType(activity)"
                :plain="!isRegisteredUnpaid(activity) && !isRefunding(activity)"
                :disabled="!isRegisteredUnpaid(activity) && !isRefunding(activity) && !isRefunded(activity)"
                @click.stop="handleRegisteredActivityClick(activity)"
                :loading="registering[activity.id]"
              >
                {{ getRegisteredButtonText(activity) }}
              </van-button>
              <van-button
                v-else-if="isFull(activity)"
                size="small"
                disabled
              >
                人数已满
              </van-button>
              <van-button
                v-else-if="isExpired(activity)"
                size="small"
                disabled
              >
                已结束
              </van-button>
            </template>
            <template v-else>
              <div class="button-placeholder"></div>
            </template>
          </div>
        </template>
      </van-card>
    </van-list>

    <!-- 空状态 -->
    <van-empty
      v-if="!props.loading && props.activities.length === 0"
      description="暂无活动"
      image="https://fastly.jsdelivr.net/npm/@vant/assets/custom-empty-image.png"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import axios from 'axios'
import { showSuccessToast, showDialog, showFailToast, showToast } from 'vant'
import request from '@/api/request'
import { getBingFallback } from '@/utils/bingFallback'
import { optimizedRequest, clearCache } from '@/utils/apiOptimizer'

const router = useRouter()
const userStore = useUserStore()

const props = defineProps({
  activities: {
    type: Array,
    default: () => []
  },
  fallbackImage: {
    type: String,
    default: 'https://www.bing.com/th?id=OHR.GuarAlMadagascar_ZH-CN5676201563_1920x1080.jpg'
  },
  dataReady: {
    type: Boolean,
    default: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  hasMore: {
    type: Boolean,
    default: true
  },
  infinite: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['load-more', 'refresh'])

const registering = ref({})
const activityThumbCache = new Map()
const favoriteMap = ref({}) // 存储收藏状态和ID的映射
// 如果禁用了无限滚动，则直接视为 finished，交由外部按钮控制
const finished = computed(() => !props.infinite || !props.hasMore)
const userOrders = ref([]) // 用户的订单列表

const getActivityThumb = (activity) => {
  if (activity.coverImage) return activity.coverImage
  const cached = activityThumbCache.get(activity.id)
  if (cached) return cached
  // 使用今日 Bing 壁纸作为兜底
  const bingUrl = getBingFallback()
  const fallback = bingUrl || props.fallbackImage
  activityThumbCache.set(activity.id, fallback)
  return fallback
}

const findOrderForActivity = (activityId) => {
    // 防御性编程：检查 userOrders.value 是否为数组
    if (!userOrders.value || !Array.isArray(userOrders.value)) {
      // 仅在非空且非数组时报错，避免初始化时的误报
      if (userOrders.value && Object.keys(userOrders.value).length > 0) {
        console.error('ActivityList: userOrders 异常', typeof userOrders.value, userOrders.value)
      }
      return undefined
    }
    
    // 使用 for 循环代替 .find，避免潜在的原型链问题
    for (let i = 0; i < userOrders.value.length; i++) {
      const order = userOrders.value[i]
      if (order && order.activityId === activityId) {
        return order
      }
    }
    return undefined
  }

const getActivityOrder = (activity) => {
  // 优先使用列表数据自带的订单（从 my-registrations 返回），否则再查用户订单列表
  if (activity.order) return activity.order
  return findOrderForActivity(activity.id)
}


// 获取用户订单
const fetchUserOrders = async () => {
  if (!userStore.isLoggedIn) {
    userOrders.value = []
    return
  }

  // 确保有用户ID
  if (!userStore.user?.id) {
    console.warn('ActivityList: 已登录但无用户ID，尝试获取用户信息')
    try {
      await userStore.getUserInfo()
    } catch (e) {
      console.error('ActivityList: 获取用户信息失败', e)
      // 如果获取失败，不中断，但后续可能拿不到订单
    }
  }

  if (!userStore.user?.id) {
     console.error('ActivityList: 仍无用户ID，跳过获取订单')
     return
  }

  try {
    // 使用优化请求，添加缓存和去重
    const response = await optimizedRequest('/orders', {
      method: 'GET',
      params: { page: 1, limit: 50 } // 减少数量，避免大数据量请求
    }, {
      cache: false,
      cacheKey: `user-orders-${userStore.user.id}`,
      cacheDuration: 5 * 60 * 1000, // 5分钟缓存
      deduplication: true
    })

    // 严格校验数据格式
    if (response?.data?.data && Array.isArray(response.data.data)) {
       userOrders.value = response.data.data
    } else if (Array.isArray(response?.data)) {
       userOrders.value = response.data
    } else {
       console.warn('ActivityList: 订单数据格式异常', response)
       userOrders.value = []
    }
  } catch (error) {
    console.error('ActivityList: 获取订单失败', error)
    userOrders.value = []
  }
}

const getLatestPendingOrder = async (activityId) => {
  if (!userStore.isLoggedIn) return null
  await fetchUserOrders()
  
  if (!userOrders.value || !Array.isArray(userOrders.value)) {
    return null
  }
  
  // 安全的过滤和排序
  const pendingOrders = []
  for (const order of userOrders.value) {
    if (order && order.activityId === activityId && order.status === 'PENDING') {
      pendingOrders.push(order)
    }
  }
  
  if (pendingOrders.length === 0) return null
  
  return pendingOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
}

// 当活动列表改变时，加载收藏状态和订单状态
const loadFavoriteStatus = async () => {
  if (!userStore.isLoggedIn) {
    userOrders.value = []
    return
  }

  try {
    // 并行加载收藏状态和订单状态
    await Promise.all([
      (async () => {
        for (const activity of props.activities) {
          const response = await request.get('/favorites/check', {
            params: {
              targetType: 'activity',
              targetId: activity.id
            }
          })
          const key = `activity_${activity.id}`
          favoriteMap.value[key] = {
            isFavorited: response.isFavorited,
            favoriteId: response.favoriteId
          }
        }
      })(),
      fetchUserOrders()
    ])
  } catch (error) {
    console.error('加载状态失败:', error)
  }
}

// 检查活动是否已被收藏
const isFavorited = (activityId) => {
  return favoriteMap.value[`activity_${activityId}`]?.isFavorited || false
}

// 切换收藏状态
const toggleFavorite = async (activityId) => {
  // 检查用户是否登录
  if (!userStore.isLoggedIn) {
    showDialog({
      message: '请先登录',
      confirmButtonText: '知道了'
    }).then(() => {
      router.push('/login')
    })
    return
  }

  const key = `activity_${activityId}`
  const favoriteInfo = favoriteMap.value[key]
  const isFav = favoriteInfo?.isFavorited || false

  try {
    if (isFav) {
      // 取消收藏
      if (favoriteInfo?.favoriteId) {
        await request.delete(`/favorites/${favoriteInfo.favoriteId}`)
        favoriteMap.value[key] = {
          isFavorited: false,
          favoriteId: null
        }
        showSuccessToast('已取消收藏')
      }
    } else {
      // 添加收藏
      const response = await request.post('/favorites', {
        targetType: 'activity',
        targetId: activityId
      })
      favoriteMap.value[key] = {
        isFavorited: true,
        favoriteId: response.data.id
      }
      showSuccessToast('收藏成功')
    }
  } catch (error) {
    console.error('收藏操作失败:', error)
    showFailToast('操作失败，请重试')
  }
}

// 格式化日期时间
const formatDateTime = (dateTimeString) => {
  const date = new Date(dateTimeString)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
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
  // 如果申请退款中（REFUNDING），不能重新报名，只能取消退款
  if (activity.order?.status === 'REFUNDING') {
    return false
  }

  // 如果已退款（REFUNDED），允许重新报名
  if (activity.order?.status === 'REFUNDED') {
    return (
      activity.isApproved &&
      activity.isActive &&
      !isExpired(activity) &&
      !isFull(activity)
    )
  }

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
  // 检查activity对象中是否有registrationStatus字段，或者有订单信息
  return activity.registrationStatus !== undefined || activity.order !== null
}

// 检查是否已支付
const hasPaidForActivity = (activity) => {
  if (activity.price === 0 || !activity.price) {
    return false
  }
  const order = getActivityOrder(activity)
  if (!order) return false
  if (order.status === 'REFUNDED') return false
  return ['PAID', 'REFUNDING', 'COMPLETED'].includes(order.status)
}

// 检查是否已报名但未支付
const isRegisteredUnpaid = (activity) => {
  // 若已有订单且状态为 PENDING，则视为未支付
  const order = getActivityOrder(activity)
  const hasPendingOrder = order?.status === 'PENDING'
  const unpaidByRegistration = isRegistered(activity) && !hasPaidForActivity(activity) && (activity.price && activity.price > 0)
  return hasPendingOrder || unpaidByRegistration
}

// 检查是否退款审核中
const isRefunding = (activity) => {
  const order = getActivityOrder(activity)
  return order?.status === 'REFUNDING'
}

// 检查是否已退款
const isRefunded = (activity) => {
  const order = getActivityOrder(activity)
  return order?.status === 'REFUNDED'
}

// 获取已报名活动的按钮文本
const getRegisteredButtonText = (activity) => {
  const order = getActivityOrder(activity)
  if (order?.status === 'REFUNDING') {
    return '取消退款'
  } else if (order?.status === 'REFUNDED') {
    return '已退款'
  } else if (hasPaidForActivity(activity)) {
    return '已付款'
  } else if (isRegisteredUnpaid(activity)) {
    return '立即支付'
  } else {
    const statusMap = {
      'REGISTERED': '已报名待审核',
      'APPROVED': '报名已通过',
      'REJECTED': '报名已拒绝'
    }
    return statusMap[activity.registrationStatus] || '已报名'
  }
}

// 获取已报名活动的按钮类型
const getRegisteredButtonType = (activity) => {
  const order = getActivityOrder(activity)
  if (order?.status === 'REFUNDING') {
    return 'warning'
  } else if (order?.status === 'REFUNDED') {
    return 'default'
  } else if (hasPaidForActivity(activity)) {
    return 'success'
  } else if (isRegisteredUnpaid(activity)) {
    return 'warning'
  } else {
    const typeMap = {
      'REGISTERED': 'warning',
      'APPROVED': 'success',
      'REJECTED': 'danger'
    }
    return typeMap[activity.registrationStatus] || 'default'
  }
}

// 处理已报名活动的点击事件
const handleRegisteredActivityClick = async (activity) => {
  // 检查用户是否登录
  if (!userStore.isLoggedIn) {
    showDialog({
      message: '请先登录',
      confirmButtonText: '知道了'
    }).then(() => {
      router.push('/login')
    })
    return
  }

  // 如果未支付，跳转到支付页面
  if (isRegisteredUnpaid(activity)) {
    const price = activity.price || 0
    router.push({
      path: '/payment',
      query: {
        type: 'activity',
        id: activity.id,
        name: activity.name,
        price: price,
        image: activity.coverImage || getBingFallback(),
        orderId: activity.order.id
      }
    })
    return
  }

  // 如果退款审核中，执行取消退款操作
  if (isRefunding(activity)) {
    try {
      registering.value[activity.id] = true

      // 复制ActivityDetail中的取消退款逻辑
      const order = getActivityOrder(activity)
      if (!order) {
        showToast('订单信息不存在')
        return
      }

      await axios.delete(`/api/orders/${order.id}/refund`, {
        headers: {
          'Authorization': `Bearer ${userStore.token}`
        }
      })

      showSuccessToast('已取消退款申请')

      // 刷新订单数据
      await fetchUserOrders()

    } catch (error) {
      console.error('取消退款失败:', error)
      showToast(error.response?.data?.error || '取消退款失败')
    } finally {
      registering.value[activity.id] = false
    }
    return
  }

  // 如果已退款，跳转到详情页重新报名
  if (isRefunded(activity)) {
    goToDetail(activity.id)
    return
  }

  // 其他情况跳转到详情页
  goToDetail(activity.id)
}

// 跳转到详情页
const goToDetail = (activityId) => {
  router.push(`/activity/${activityId}`)
}

// 处理报名/支付
const handleRegister = async (activity) => {
  // alert('调试: 开始处理报名 ' + activity.name)
  console.log('ActivityList: 开始处理报名', activity.id, activity.name)
  
  // 检查用户是否登录
  if (!userStore.isLoggedIn) {
    showDialog({
      message: '请先登录',
      confirmButtonText: '知道了'
    }).then(() => {
      router.push('/login')
    })
    return
  }

  // 再次确保用户信息完整
  if (!userStore.user?.id) {
    try {
      await userStore.getUserInfo()
    } catch (e) {
      showToast('错误: 无法获取用户信息，请重新登录')
      return
    }
  }

  // 如果已报名但未支付，跳转到支付页面
  if (isRegisteredUnpaid(activity)) {
    console.log('ActivityList: 已报名未支付，直接跳转支付')
    const price = activity.price || 0
    const query = {
      type: 'activity',
      id: activity.id,
      name: activity.name,
      price: price,
      image: activity.coverImage || getBingFallback(),
      orderId: activity.order?.id,
      orderNo: activity.order?.orderNo
    }
    
    navigateToPayment(query)
    return
  }

  try {
    registering.value[activity.id] = true
    const toast = showToast({ message: '正在处理...', forbidClick: true, duration: 0 })

    console.log('ActivityList: 发起报名请求')
    // 使用 request 实例而不是原生 axios
    const response = await request.post(`/activities/${activity.id}/register`)
    console.log('ActivityList: 报名响应', response)

    // 关键修复：清除缓存，确保返回列表页时状态最新
    if (userStore.user?.id) {
      clearCache(`user-orders-${userStore.user.id}`)
      clearCache(`user-registrations-${userStore.user.id}`)
    }

    let targetOrder = response.data?.order || response.order
    const price = activity.price || 0

    if (price > 0) {
      if (!targetOrder) {
        console.log('ActivityList: 未返回订单，尝试查找')
        targetOrder = await getLatestPendingOrder(activity.id)
      }

      if (targetOrder) {
        console.log('ActivityList: 找到订单，跳转支付', targetOrder)
        toast.close()
        showSuccessToast({
          message: '报名成功，前往支付',
          duration: 1500
        })
        
        const query = {
          type: 'activity',
          id: activity.id,
          name: activity.name,
          price: price,
          image: activity.coverImage || getBingFallback(),
          orderId: targetOrder.id,
          orderNo: targetOrder.orderNo
        }
        
        navigateToPayment(query)
      } else {
        console.warn('ActivityList: 报名成功但无订单')
        toast.close()
        showToast('报名成功，但暂未找到订单，请稍后在“我的订单”查看')
        router.push('/orders')
      }
      return
    }

    // 免费活动
    toast.close()
    const successMessage = response.message || '报名成功'
    showSuccessToast({
      message: successMessage,
      duration: 2000
    })

    // 刷新活动列表以更新报名人数和状态
    emit('refresh')
  } catch (error) {
    console.error('ActivityList: 报名失败', error)
    const errorMessage = error.response?.data?.error
      || error.response?.data?.message
      || error.message
      || '报名失败，请稍后重试'
    showFailToast(errorMessage)
  } finally {
    registering.value[activity.id] = false
  }
}

// 统一跳转支付页逻辑
const navigateToPayment = (query) => {
  console.log('ActivityList: 准备跳转支付页', query)
  
  // 手动构建 URL，不依赖 router.resolve，以排除路由配置错误
  try {
    const params = new URLSearchParams()
    for (const key in query) {
      if (query[key] !== undefined && query[key] !== null) {
        params.append(key, query[key])
      }
    }
    
    // 假设是 hash 模式还是 history 模式？
    // 先检查当前的 URL 结构
    const currentHref = window.location.href
    const isHashMode = currentHref.includes('/#/')
    
    let fullUrl = ''
    
    if (isHashMode) {
      const baseUrl = currentHref.split('/#/')[0]
      fullUrl = `${baseUrl}/#/payment?${params.toString()}`
    } else {
      const origin = window.location.origin
      fullUrl = `${origin}/payment?${params.toString()}`
    }
    
    console.log('ActivityList: 手动构建的URL', fullUrl)
    
    // 强制跳转
    setTimeout(() => {
      window.location.href = fullUrl
    }, 100)
    
  } catch (e) {
    console.error('ActivityList: URL构建失败', e)
    // 兜底
    router.push({ path: '/payment', query })
  }
}

// Watch activities 改变，自动加载收藏状态
import { watch } from 'vue'
watch(() => props.activities, () => {
  loadFavoriteStatus()
}, { deep: true })
</script>

<style scoped>
.activity-list {
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

.activity-description {
  margin-top: 8px;
  color: #666;
  font-size: 12px;
  line-height: 1.4;
  max-height: 40px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.activity-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.activity-footer :deep(.van-button) {
  flex: 1;
  min-width: 0;
  justify-content: center;
}

.button-placeholder {
  flex: 1;
  height: 32px;
}

.favorite-icon {
  cursor: pointer;
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.favorite-icon:active {
  transform: scale(0.9);
}

.favorite-button {
  transition: all 0.3s ease;
}

.favorite-button.favorited {
  background-color: #ffd21d !important;
  color: #323233 !important;
  border-color: #ffd21d !important;
}
</style>
