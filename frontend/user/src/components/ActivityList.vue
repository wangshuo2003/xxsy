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
        :thumb="activity.coverImage || '/default-activity.jpg'"
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
              :plain="!isRegisteredUnpaid(activity)"
              :disabled="!isRegisteredUnpaid(activity)"
              @click.stop="handleRegister(activity)"
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
import { showSuccessToast, showDialog, showFailToast } from 'vant'
import request from '@/api/request'

const router = useRouter()
const userStore = useUserStore()

const props = defineProps({
  activities: {
    type: Array,
    default: () => []
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
const favoriteMap = ref({}) // 存储收藏状态和ID的映射
// 如果禁用了无限滚动，则直接视为 finished，交由外部按钮控制
const finished = computed(() => !props.infinite || !props.hasMore)
const userOrders = ref([]) // 用户的订单列表

const findOrderForActivity = (activityId) => {
  return userOrders.value.find(order => order.activityId === activityId)
}


// 获取用户订单
const fetchUserOrders = async () => {
  if (!userStore.isLoggedIn) {
    userOrders.value = []
    return
  }

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
  // 检查activity对象中是否有registrationStatus字段
  return activity.registrationStatus !== undefined
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

// 检查是否已报名但未支付
const isRegisteredUnpaid = (activity) => {
  return isRegistered(activity) && !hasPaidForActivity(activity) && (activity.price && activity.price > 0)
}

// 获取已报名活动的按钮文本
const getRegisteredButtonText = (activity) => {
  const order = findOrderForActivity(activity.id)
  if (order?.status === 'REFUNDING') {
    return '退款审核中'
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
  const order = findOrderForActivity(activity.id)
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

// 跳转到详情页
const goToDetail = (activityId) => {
  router.push(`/activity/${activityId}`)
}

// 处理报名/支付
const handleRegister = async (activity) => {
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

  // 如果已报名但未支付，跳转到支付页面
  if (isRegisteredUnpaid(activity)) {
    const price = activity.price || 0
    router.push({
      path: '/payment',
      query: {
        type: 'activity',
        id: activity.id,
        name: activity.name,
        price: price,
        image: activity.coverImage || '/default-activity.jpg'
      }
    })
    return
  }

  try {
    registering.value[activity.id] = true

    const response = await axios.post(
      `/api/activities/${activity.id}/register`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${userStore.token}`
        }
      }
    )

    const needsPayment = response.data?.needsPayment

    // 报名成功后提示需要支付（如果活动有费用）
    const successMessage = response.data?.message
      || (needsPayment ? '报名成功，请完成支付' : '报名成功')

    showSuccessToast({
      message: successMessage,
      duration: 2000
    })

    // 刷新活动列表以更新报名人数和状态
    emit('refresh')
  } catch (error) {
    console.error('报名失败:', error)
    const errorMessage = error.response?.data?.error
      || error.response?.data?.message
      || error.message
      || '报名失败，请稍后重试'
    showFailToast(errorMessage)
  } finally {
    registering.value[activity.id] = false
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
