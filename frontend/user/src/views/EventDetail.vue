<template>
  <div class="event-detail">
    <div v-if="loading" class="loading">
      <van-loading size="24px" vertical>加载中...</van-loading>
    </div>

    <div v-else-if="event" class="content">
      <!-- 活动封面 -->
      <div class="event-cover">
        <img :src="event.coverImage || '/default-cover.jpg'" :alt="event.title" />
        <div v-if="event.isHot" class="hot-badge">热门</div>
        <div v-if="isEventExpired(event.registerDeadline)" class="expired-badge">报名已截止</div>
      </div>

      <!-- 活动信息 -->
      <div class="event-info">
        <h1 class="event-title">{{ event.title }}</h1>

        <!-- 标签 -->
        <div class="event-tags">
          <van-tag v-for="tag in getTagsList(event.tags)" :key="tag" type="primary" plain>
            {{ tag }}
          </van-tag>
        </div>

        <!-- 基本信息 -->
        <div class="basic-info">
          <van-cell-group>
            <van-cell title="活动类型" :value="getEventTypeName(event.eventType)" />
            <van-cell title="活动地点" :value="event.location" />
            <van-cell title="报名截止" :value="formatDeadline(event.registerDeadline)" />
            <van-cell title="活动时间" :value="formatDate(event.endTime)" />
            <van-cell title="最大人数" :value="event.maxPeople ? `${event.maxPeople}人` : '不限'" />
            <van-cell title="已报名人数" :value="`${event._count.orders}人`" />
          </van-cell-group>
        </div>

        <!-- 价格 -->
        <div class="price-section">
          <div class="price-info">
            <span v-if="event.price > 0" class="price">¥{{ event.price }}</span>
            <span v-else class="free">免费活动</span>
          </div>
        </div>

        <!-- 活动描述 -->
        <div class="section">
          <h3>活动介绍</h3>
          <div class="description" v-html="event.description"></div>
        </div>

        <!-- 活动规则 -->
        <div v-if="event.eventRules" class="section">
          <h3>活动规则</h3>
          <div class="rules" v-html="event.eventRules"></div>
        </div>

        <!-- 成果展示 -->
        <div v-if="event.eventResults" class="section">
          <h3>成果展示</h3>
          <div class="results" v-html="event.eventResults"></div>
        </div>

        <!-- 视频和附件 -->
        <div v-if="event.videoUrl || event.fileUrl" class="media-section">
          <div v-if="event.videoUrl" class="video-item">
            <h4>活动视频</h4>
            <video :src="event.videoUrl" controls style="width: 100%; border-radius: 8px;"></video>
          </div>
          <div v-if="event.fileUrl" class="file-item">
            <h4>相关文件</h4>
            <van-button type="primary" size="small" @click="downloadFile(event.fileUrl)">
              <van-icon name="description" />
              下载文件
            </van-button>
          </div>
        </div>
      </div>

      <!-- 底部操作栏 -->
      <div class="bottom-actions">
        <van-button
          v-if="!isLoggedIn"
          type="primary"
          block
          @click="goToLogin"
        >
          请先登录
        </van-button>
        <template v-else>
          <van-button
            v-if="hasRegistered"
            type="default"
            block
            disabled
          >
            已报名
          </van-button>
          <van-button
            v-else-if="isEventExpired(event.registerDeadline)"
            type="default"
            block
            disabled
          >
            报名已截止
          </van-button>
          <van-button
            v-else-if="event.maxPeople && event._count.orders >= event.maxPeople"
            type="default"
            block
            disabled
          >
            人员已满
          </van-button>
          <van-button
            v-else
            type="primary"
            block
            :loading="registering"
            @click="handleRegister"
          >
            立即报名
          </van-button>
        </template>
      </div>
    </div>

    <div v-else class="error">
      <van-empty description="活动不存在" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { Toast, Dialog } from 'vant'
import axios from 'axios'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const loading = ref(true)
const registering = ref(false)
const event = ref(null)

const isLoggedIn = computed(() => !!userStore.user)
const hasRegistered = computed(() => {
  return event.value && event.value.orders?.some(order => order.userId === userStore.user?.id)
})

const getEventTypeName = (type) => {
  const typeMap = {
    COMPETITION: '赛事活动',
    STUDY_TOUR: '研学活动',
    SOCIAL_PRACTICE: '社会实践',
    PUBLIC_WELFARE: '公益活动',
    SPECIAL_SERVICE: '特色服务'
  }
  return typeMap[type] || '未知类型'
}

const getTagsList = (tags) => {
  if (!tags) return []
  return tags.split(',').map(tag => tag.trim()).filter(tag => tag)
}

const formatDate = (dateStr) => {
  if (!dateStr) return '待定'
  return new Date(dateStr).toLocaleString('zh-CN')
}

const formatDeadline = (dateStr) => {
  if (!dateStr) return '无截止时间'
  const date = new Date(dateStr)
  const now = new Date()

  if (date < now) {
    return '已截止'
  }

  return date.toLocaleString('zh-CN')
}

const isEventExpired = (deadline) => {
  if (!deadline) return false
  return new Date(deadline) < new Date()
}

const downloadFile = (fileUrl) => {
  window.open(fileUrl, '_blank')
}

const goToLogin = () => {
  router.push('/login')
}

const handleRegister = async () => {
  try {
    registering.value = true

    // 确认对话框
    await Dialog.confirm({
      title: '确认报名',
      message: event.value.price > 0
        ? `确定要报名"${event.value.title}"吗？费用为¥${event.value.price}`
        : `确定要免费报名"${event.value.title}"吗？`,
    })

    // 创建订单
    const response = await axios.post('/api/orders', {
      serviceId: event.value.id,
      amount: event.value.price || 0
    })

    Toast.success('报名成功！')

    // 刷新活动信息
    fetchEventDetail()

  } catch (error) {
    if (error.message !== 'cancel') {
      Toast.fail('报名失败，请重试')
      console.error('报名失败:', error)
    }
  } finally {
    registering.value = false
  }
}

const fetchEventDetail = async () => {
  try {
    loading.value = true
    const response = await axios.get(`/api/services/${route.params.id}`)
    event.value = response.data.data
  } catch (error) {
    Toast.fail('获取活动详情失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchEventDetail()
})
</script>

<style scoped>
.event-detail {
  background-color: #f7f8fa;
  min-height: 100vh;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

.content {
  padding-bottom: 80px;
}

.event-cover {
  position: relative;
  width: 100%;
  height: 200px;
  overflow: hidden;
}

.event-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hot-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  background: linear-gradient(135deg, #ff6b6b, #ff4757);
  color: white;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: bold;
}

.expired-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
}

.event-info {
  background: white;
  margin-top: -8px;
  border-radius: 16px 16px 0 0;
  padding: 20px 16px;
}

.event-title {
  font-size: 20px;
  font-weight: bold;
  color: #323233;
  margin: 0 0 12px 0;
  line-height: 1.4;
}

.event-tags {
  margin-bottom: 16px;
}

.event-tags .van-tag {
  margin-right: 6px;
  margin-bottom: 6px;
}

.basic-info {
  margin-bottom: 16px;
}

.price-section {
  background: linear-gradient(135deg, #ff6b6b, #ff4757);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 20px;
  text-align: center;
}

.price-info .price {
  color: white;
  font-size: 24px;
  font-weight: bold;
}

.price-info .free {
  color: white;
  font-size: 18px;
  font-weight: bold;
}

.section {
  margin-bottom: 24px;
}

.section h3 {
  font-size: 16px;
  font-weight: bold;
  color: #323233;
  margin: 0 0 12px 0;
  position: relative;
  padding-left: 12px;
}

.section h3::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 16px;
  background: #1989fa;
  border-radius: 2px;
}

.description, .rules, .results {
  color: #646566;
  line-height: 1.6;
  font-size: 14px;
}

.media-section {
  margin-top: 20px;
}

.video-item, .file-item {
  margin-bottom: 16px;
}

.video-item h4, .file-item h4 {
  font-size: 14px;
  color: #323233;
  margin: 0 0 8px 0;
}

.bottom-actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  padding: 12px 16px;
  border-top: 1px solid #ebedf0;
  z-index: 100;
}

.error {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 400px;
}
</style>