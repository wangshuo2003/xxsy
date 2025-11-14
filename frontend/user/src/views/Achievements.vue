<template>
  <div class="achievements-page">
    <!-- 证书列表 -->
    <van-loading v-if="loading" class="loading" />

    <div v-else-if="certificates.length === 0" class="empty-state">
      <van-empty description="暂无证书">
        <van-button type="primary" size="small" @click="$router.push('/activities')">
          去参加活动
        </van-button>
      </van-empty>
    </div>

    <div
      v-for="certificate in certificates"
      :key="certificate.id"
      class="certificate-card"
      @click="handleViewDetail(certificate)"
    >
      <div class="certificate-header">
        <div class="certificate-icon">
          <van-icon name="award" size="32" />
        </div>
        <div class="certificate-title">{{ certificate.title }}</div>
      </div>

      <div class="certificate-info">
        <div class="certificate-issuer">
          <van-icon name="medal" />
          {{ certificate.issuer || '教育实践平台' }}
        </div>
        <div class="certificate-date">
          <van-icon name="calendar" />
          {{ formatDate(certificate.issueDate || certificate.createdAt) }}
        </div>
      </div>

      <div class="certificate-description" v-if="certificate.description">
        {{ certificate.description.slice(0, 100) }}{{ certificate.description.length > 100 ? '...' : '' }}
      </div>
    </div>

    <!-- 证书详情弹窗 -->
    <van-popup
      v-model:show="detailVisible"
      position="bottom"
      :style="{ height: '80%' }"
      round
    >
      <div class="detail-popup" v-if="currentCertificate">
        <div class="detail-header">
          <h2>{{ currentCertificate.title }}</h2>
          <van-button icon="cross" type="primary" plain @click="detailVisible = false" />
        </div>

        <div class="detail-content">
          <div class="certificate-detail-card">
            <div class="certificate-image">
              <van-icon name="award" size="64" />
            </div>

            <div class="certificate-info-detail">
              <h3>{{ currentCertificate.title }}</h3>
              <p class="issuer">颁发机构：{{ currentCertificate.issuer || '教育实践平台' }}</p>
              <p class="issue-date">颁发日期：{{ formatDate(currentCertificate.issueDate || currentCertificate.createdAt) }}</p>
              <p class="certificate-id">证书编号：{{ currentCertificate.id.toString().padStart(8, '0') }}</p>
            </div>
          </div>

          <div class="certificate-description-detail" v-if="currentCertificate.description">
            <h4>证书描述</h4>
            <p>{{ currentCertificate.description }}</p>
          </div>

          <div class="certificate-actions">
            <van-button type="primary" block @click="handleDownload">
              <van-icon name="down" />
              下载证书
            </van-button>
          </div>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showToast, showSuccessToast, showFailToast, showDialog } from 'vant'
import request from '@/api/request'

const router = useRouter()
const route = useRoute()

// 响应式数据
const loading = ref(false)
const certificates = ref([])
const detailVisible = ref(false)
const currentCertificate = ref(null)

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const response = await request.get('/certificates/my')
    certificates.value = response.data || []
  } catch (error) {
    console.error('获取证书失败:', error)
    showFailToast('获取证书失败')
  } finally {
    loading.value = false
  }
}

// 查看证书详情
const handleViewDetail = (certificate) => {
  currentCertificate.value = certificate
  detailVisible.value = true
}

// 下载证书
const handleDownload = () => {
  showDialog({
    message: '下载功能开发中',
    confirmButtonText: '知道了'
  })
}

onMounted(() => {
  loadData()
  
  // 如果 URL中有 id 参数，自动打开对应证书的详情
  if (route.query.id) {
    const certificateId = parseInt(route.query.id)
    // 等待数据加载完成后打开详情
    setTimeout(() => {
      const certificate = certificates.value.find(c => c.id === certificateId)
      if (certificate) {
        handleViewDetail(certificate)
      }
    }, 500)
  }
})
</script>

<style scoped>
.achievements-page {
  min-height: 100vh;
  background-color: #f7f8fa;
  padding-top: 16px;
  padding-bottom: 60px;
}

.loading,
.empty-state {
  padding: 16px;
}

.loading {
  display: flex;
  justify-content: center;
  padding: 40px 16px;
}

.empty-state {
  padding: 40px 16px;
  text-align: center;
}

.certificate-card {
  background: white;
  border-radius: 12px;
  margin: 0 16px 16px 16px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: transform 0.2s;
}

.certificate-card:first-child {
  margin-top: 16px;
}

.certificate-card:active {
  transform: scale(0.98);
}


.certificate-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.certificate-icon {
  background: #e1f3d8;
  color: #67c23a;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.certificate-title {
  font-size: 18px;
  font-weight: 600;
  color: #323233;
  line-height: 1.4;
}

.certificate-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.certificate-issuer,
.certificate-date {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #646566;
}

.certificate-description {
  font-size: 14px;
  color: #969799;
  line-height: 1.5;
}

.detail-popup {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #ebedf0;
}

.detail-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.detail-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px 20px;
}

.certificate-detail-card {
  background: linear-gradient(135deg, #e1f3d8 0%, #d4e8d4 100%);
  border-radius: 12px;
  padding: 24px;
  margin: 16px 0;
  text-align: center;
  position: relative;
  overflow: hidden;
}

.certificate-detail-card::before {
  content: '';
  position: absolute;
  top: 10px;
  left: 10px;
  right: 10px;
  bottom: 10px;
  border: 2px solid #67c23a;
  border-radius: 8px;
  opacity: 0.3;
}

.certificate-image {
  margin-bottom: 16px;
  color: #67c23a;
}

.certificate-info-detail h3 {
  margin: 0 0 12px 0;
  font-size: 20px;
  font-weight: 600;
  color: #2c3e50;
}

.certificate-info-detail p {
  margin: 8px 0;
  font-size: 14px;
  color: #5a6c7d;
}

.certificate-description-detail {
  margin: 20px 0;
}

.certificate-description-detail h4 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #323233;
}

.certificate-description-detail p {
  margin: 0;
  font-size: 14px;
  color: #646566;
  line-height: 1.6;
}

.certificate-actions {
  margin-top: 24px;
}

/* 确保 Toast文字可见 */
:deep(.custom-toast) {
  min-width: 200px !important;
  padding: 16px !important;
  background-color: #fff !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
}

:deep(.custom-toast .van-toast__text) {
  font-size: 16px !important;
  color: #000 !important;
  line-height: 1.5 !important;
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
}
</style>