<template>
  <div class="bases-page">
    <!-- 页面标题 -->
    <div class="page-header">
      <h1>实践基地</h1>
      <p>探索优质教育实践基地，参与丰富的实践活动</p>
    </div>

    <!-- 申请基地按钮 -->
    <div class="apply-section">
      <van-button type="primary" size="large" @click="handleApplyBase" block>
        申请实践基地
      </van-button>
    </div>

    <!-- 搜索和筛选 -->
    <div class="filter-section">
      <van-search
        v-model="searchQuery"
        placeholder="搜索基地名称或类型"
        @search="handleSearch"
        @clear="handleClear"
      />
      <van-dropdown-menu>
        <van-dropdown-item v-model="typeFilter" :options="typeOptions" @change="handleFilter" />
      </van-dropdown-menu>
    </div>

    <!-- 基地列表 -->
    <div class="bases-list">
      <van-loading v-if="loading" class="loading" />

      <div v-else-if="bases.length === 0" class="empty-state">
        <van-empty description="暂无基地数据" />
      </div>

      <div v-else class="base-cards">
        <div
          v-for="base in bases"
          :key="base.id"
          class="base-card"
          @click="handleViewDetail(base)"
        >
          <div class="base-image">
            <img :src="getBaseImage(base)" :alt="base.name" />
          </div>
          <div class="base-info">
            <h3 class="base-name">{{ base.name }}</h3>
            <p class="base-type">{{ base.type }}</p>
            <p class="base-address">
              <van-icon name="location" />
              {{ base.address }}
            </p>
            <p class="base-contact" v-if="base.contact">
              <van-icon name="phone" />
              {{ base.contact }}
            </p>
            <div class="base-description" v-if="base.description">
              {{ base.description.slice(0, 80) }}{{ base.description.length > 80 ? '...' : '' }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 分页 -->
    <div class="pagination" v-if="total > pageSize">
      <van-pagination
        v-model="currentPage"
        :page-count="Math.ceil(total / pageSize)"
        :total-items="total"
        :show-page-size="5"
        @change="handlePageChange"
      />
    </div>

    <!-- 基地详情弹窗 -->
    <van-popup
      v-model:show="detailVisible"
      position="bottom"
      :style="{ height: '80%' }"
      round
    >
      <div class="detail-popup" v-if="currentBase">
        <div class="detail-header">
          <h2>{{ currentBase.name }}</h2>
          <van-button icon="cross" type="primary" plain @click="detailVisible = false" />
        </div>

        <div class="detail-content">
          <div class="detail-image">
            <img :src="getBaseImage(currentBase)" :alt="currentBase.name" />
          </div>

          <van-cell-group>
            <van-cell title="基地类型" :value="currentBase.type" />
            <van-cell title="基地地址" :value="currentBase.address" />
            <van-cell title="联系方式" :value="currentBase.contact || '暂无'" />
            <van-cell title="基地管理员" :value="currentBase.manager?.name || '暂无'" />
          </van-cell-group>

          <div class="detail-description" v-if="currentBase.description">
            <h3>基地介绍</h3>
            <p>{{ currentBase.description }}</p>
          </div>

          <!-- 活动列表 -->
          <div class="activities-section" v-if="currentBase.activities && currentBase.activities.length > 0">
            <h3>近期活动</h3>
            <div class="activity-list">
              <div
                v-for="activity in currentBase.activities.slice(0, 3)"
                :key="activity.id"
                class="activity-item"
                @click="handleViewActivity(activity)"
              >
                <h4>{{ activity.name }}</h4>
                <p class="activity-time">
                  <van-icon name="clock" />
                  {{ formatDate(activity.time) }}
                </p>
                <p class="activity-location">
                  <van-icon name="location" />
                  {{ activity.location }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </van-popup>

    <!-- 申请基地弹窗 -->
    <van-popup
      v-model:show="applyVisible"
      position="bottom"
      :style="{ height: '90%' }"
      round
    >
      <div class="apply-popup">
        <div class="apply-header">
          <h2>申请实践基地</h2>
          <van-button icon="cross" type="primary" plain @click="applyVisible = false" />
        </div>

        <van-form @submit="handleApplySubmit">
          <van-cell-group inset>
            <van-field
              v-model="applyForm.name"
              name="name"
              label="基地名称"
              placeholder="请输入基地名称"
              :rules="[{ required: true, message: '请输入基地名称' }]"
            />
            <van-field
              v-model="applyForm.type"
              name="type"
              label="基地类型"
              placeholder="请选择基地类型"
              :rules="[{ required: true, message: '请选择基地类型' }]"
            >
              <template #input>
                <van-picker
                  :columns="typeColumns"
                  @confirm="onTypeConfirm"
                  @cancel="showTypePicker = false"
                  :show="showTypePicker"
                />
              </template>
            </van-field>
            <van-field
              v-model="applyForm.address"
              name="address"
              label="基地地址"
              placeholder="请输入基地地址"
              :rules="[{ required: true, message: '请输入基地地址' }]"
            />
            <van-field
              v-model="applyForm.contact"
              name="contact"
              label="联系方式"
              placeholder="请输入联系方式"
              :rules="[{ required: true, message: '请输入联系方式' }]"
            />
            <van-field
              v-model="applyForm.description"
              name="description"
              label="基地描述"
              type="textarea"
              placeholder="请详细描述基地情况、设施条件等"
              :rows="4"
              maxlength="500"
              show-word-limit
            />
          </van-cell-group>

          <div class="apply-submit">
            <van-button
              round
              block
              type="primary"
              native-type="submit"
              :loading="applyLoading"
            >
              提交申请
            </van-button>
          </div>
        </van-form>
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeMount } from 'vue'
import { showToast, showSuccessToast, showFailToast } from 'vant'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import request from '@/api/request'

const router = useRouter()
const userStore = useUserStore()

// 响应式数据
const loading = ref(false)
const bases = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
const searchQuery = ref('')
const typeFilter = ref('')

// 弹窗状态
const detailVisible = ref(false)
const currentBase = ref(null)
const applyVisible = ref(false)
const applyLoading = ref(false)
const showTypePicker = ref(false)

// 基地类型选项
const typeOptions = [
  { text: '全部类型', value: '' },
  { text: '教育实践基地', value: '教育实践基地' },
  { text: '研学基地', value: '研学基地' },
  { text: '实训基地', value: '实训基地' },
  { text: '创业基地', value: '创业基地' },
  { text: '其他', value: '其他' }
]

const typeColumns = typeOptions.filter(option => option.value).map(option => option.text)

// 申请表单
const applyForm = reactive({
  name: '',
  type: '',
  address: '',
  contact: '',
  description: ''
})

// 格式化日期
const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 获取基地图片
const getBaseImage = (base) => {
  // 这里可以根据基地类型或名称返回不同的图片
  const typeImages = {
    '教育实践基地': '/images/base-education.jpg',
    '研学基地': '/images/base-research.jpg',
    '实训基地': '/images/base-training.jpg',
    '创业基地': '/images/base-business.jpg'
  }
  return typeImages[base.type] || '/images/base-default.jpg'
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      limit: pageSize.value,
      isApproved: true,
      isActive: true,
      ...(searchQuery.value && { search: searchQuery.value }),
      ...(typeFilter.value && { type: typeFilter.value })
    }

    const response = await request.get('/bases', { params })
    bases.value = response.data.data || []
    total.value = response.data.pagination?.total || 0
  } catch (error) {
    showFailToast('加载数据失败')
  } finally {
    loading.value = false
  }
}

// 搜索处理
const handleSearch = () => {
  currentPage.value = 1
  loadData()
}

// 清空搜索
const handleClear = () => {
  searchQuery.value = ''
  handleSearch()
}

// 筛选处理
const handleFilter = () => {
  currentPage.value = 1
  loadData()
}

// 分页处理
const handlePageChange = () => {
  loadData()
}

// 查看基地详情
const handleViewDetail = async (base) => {
  try {
    const response = await request.get(`/bases/${base.id}`)
    currentBase.value = response.data.data
    detailVisible.value = true
  } catch (error) {
    showFailToast('获取基地详情失败')
  }
}

// 查看活动详情
const handleViewActivity = (activity) => {
  // 这里可以跳转到活动详情页面
  showToast('活动详情功能开发中')
}

// 申请基地
const handleApplyBase = () => {
  // 重置表单
  Object.assign(applyForm, {
    name: '',
    type: '',
    address: '',
    contact: '',
    description: ''
  })
  applyVisible.value = true
}

// 类型选择确认
const onTypeConfirm = ({ selectedOptions }) => {
  applyForm.type = selectedOptions[0]?.text || ''
  showTypePicker.value = false
}

// 提交申请
const handleApplySubmit = async () => {
  try {
    applyLoading.value = true

    await request.post('/bases/apply', applyForm)

    showSuccessToast('申请提交成功，等待审核')
    applyVisible.value = false
    loadData()
  } catch (error) {
    showFailToast(error.response?.data?.error || '申请提交失败')
  } finally {
    applyLoading.value = false
  }
}

// 权限检查 - 学生用户不能访问基地展示功能
onBeforeMount(async () => {
  // 如果用户未登录，先获取用户信息
  if (!userStore.user) {
    try {
      await userStore.getUserInfo()
    } catch (error) {
      console.error('获取用户信息失败:', error)
    }
  }

  // 检查用户角色，如果是学生则跳转到首页
  if (userStore.userRole === 'STUDENT') {
    showToast('学生用户无权限访问此功能')
    router.replace('/home')
    return
  }
})

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.bases-page {
  min-height: 100vh;
  background-color: #f7f8fa;
}

.page-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px;
  text-align: center;
}

.page-header h1 {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 600;
}

.page-header p {
  margin: 0;
  font-size: 14px;
  opacity: 0.9;
}

.apply-section {
  padding: 16px;
}

.filter-section {
  padding: 0 16px 16px;
  display: flex;
  gap: 12px;
  align-items: center;
}

.bases-list {
  padding: 0 16px;
}

.loading {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

.empty-state {
  padding: 40px 0;
}

.base-cards {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.base-card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: transform 0.2s;
}

.base-card:active {
  transform: scale(0.98);
}

.base-image {
  height: 160px;
  overflow: hidden;
}

.base-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.base-info {
  padding: 16px;
}

.base-name {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: #323233;
}

.base-type {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #07c160;
  font-weight: 500;
}

.base-address,
.base-contact {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #969799;
  display: flex;
  align-items: center;
  gap: 4px;
}

.base-description {
  margin: 8px 0 0 0;
  font-size: 14px;
  color: #646566;
  line-height: 1.5;
}

.pagination {
  padding: 20px 0;
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

.detail-image {
  height: 200px;
  overflow: hidden;
  border-radius: 8px;
  margin: 16px 0;
}

.detail-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.detail-description {
  margin: 20px 0;
}

.detail-description h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
}

.detail-description p {
  margin: 0;
  font-size: 14px;
  color: #646566;
  line-height: 1.6;
}

.activities-section {
  margin: 20px 0;
}

.activities-section h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.activity-item {
  background: #f7f8fa;
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
}

.activity-item h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 500;
  color: #323233;
}

.activity-time,
.activity-location {
  margin: 0 0 4px 0;
  font-size: 12px;
  color: #969799;
  display: flex;
  align-items: center;
  gap: 4px;
}

.apply-popup {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.apply-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #ebedf0;
}

.apply-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.apply-submit {
  padding: 20px;
  margin-top: auto;
}
</style>