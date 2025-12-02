<template>
  <div class="approved-activities">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <el-input
          v-model="searchQuery"
          placeholder="搜索活动名称或类型"
          style="width: 300px"
          @input="handleSearch"
          clearable
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-select
          v-model="baseFilter"
          placeholder="筛选基地"
          style="width: 200px"
          clearable
          @change="handleSearch"
        >
          <el-option
            v-for="base in availableBases"
            :key="base.id"
            :label="base.name"
            :value="base.id"
          />
        </el-select>
        <el-button @click="loadData">刷新</el-button>
      </div>
      <div class="toolbar-right" v-if="['SUPER_ADMIN', 'ADMIN'].includes(userStore.user?.role)">
        <el-button type="primary" @click="handleAdd">添加活动</el-button>
      </div>
    </div>

    <!-- 数据表格 -->
    <el-table
      :data="activities"
      v-loading="loading"
      style="width: 100%"
    >
      <el-table-column label="活动名称" min-width="150">
        <template #default="{ row }">
          <el-tag
            :type="getActiveTagType(row)"
            class="status-action-tag"
            @click="handleEdit(row)"
          >
            {{ row.name }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="type" label="活动类型" width="120" />
      <el-table-column prop="base.name" label="所属基地" width="150" />
      <el-table-column prop="location" label="活动地点" width="150" show-overflow-tooltip />
      <el-table-column prop="maxPeople" label="报名情况" width="120">
        <template #default="{ row }">
          <el-tag
            :type="getActiveTagType(row)"
            class="status-action-tag"
            @click="handleViewRegistrations(row)"
          >
            {{ formatEnrollmentDisplay(row) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="time" label="活动时间" width="180">
        <template #default="{ row }">
          {{ formatDate(row.time) }}
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="180">
        <template #default="{ row }">
          {{ formatDate(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button
            type="primary"
            link
            size="small"
            @click="handleAwardConfig(row)"
          >
            奖项配置
          </el-button>
          <el-button
            type="primary"
            link
            size="small"
            @click="handleEdit(row)"
            v-if="canEdit(row)"
          >
            编辑
          </el-button>
          <el-button
            type="danger"
            link
            size="small"
            @click="handleDelete(row)"
            v-if="canDelete(row)"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div class="pagination">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadData"
        @current-change="loadData"
      />
    </div>

    <!-- 查看详情对话框 -->
    <el-dialog
      v-model="detailVisible"
      title="活动详情"
      width="700px"
    >
      <div v-if="currentActivity">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="活动名称">{{ currentActivity.name }}</el-descriptions-item>
          <el-descriptions-item label="活动类型">{{ currentActivity.type }}</el-descriptions-item>
          <el-descriptions-item label="所属基地">{{ currentActivity.base?.name }}</el-descriptions-item>
          <el-descriptions-item label="活动地点">{{ currentActivity.location }}</el-descriptions-item>
          <el-descriptions-item label="人数限制">
            {{ formatEnrollmentDisplay(currentActivity) }}
          </el-descriptions-item>
          <el-descriptions-item label="活动时间">
            {{ formatDate(currentActivity.time) }}
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="currentActivity.isActive ? 'success' : 'danger'">
              {{ currentActivity.isActive ? '启用' : '禁用' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ formatDate(currentActivity.createdAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="描述" :span="2">
            {{ currentActivity.description || '暂无描述' }}
          </el-descriptions-item>
        </el-descriptions>

        <!-- 拒绝原因（如果有） -->
        <el-alert
          v-if="currentActivity.rejectReason"
          :title="`拒绝原因：${currentActivity.rejectReason}`"
          type="error"
          show-icon
          style="margin-top: 20px"
        />
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button
          type="primary"
          @click="handleEdit(currentActivity)"
          v-if="canEdit(currentActivity)"
        >
          编辑
        </el-button>
      </template>
    </el-dialog>

    <!-- 添加/编辑对话框 -->
    <el-dialog
      v-model="formVisible"
      :title="isEdit ? '编辑活动' : '添加活动'"
      width="600px"
      :top="dialogTop"
      :class="['activity-dialog']"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="100px"
      >
        <el-form-item label="活动名称" prop="name">
          <el-input v-model="formData.name" placeholder="请输入活动名称" />
        </el-form-item>
        <el-form-item label="活动类型" prop="type">
          <el-select v-model="formData.type" placeholder="请选择活动类型" style="width: 100%">
            <el-option label="研学活动" value="研学活动" />
            <el-option label="实践活动" value="实践活动" />
            <el-option label="公益活动" value="公益活动" />
            <el-option label="特色活动" value="特色活动" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>
        <el-form-item label="所属基地" prop="baseId">
          <el-select
            v-model="formData.baseId"
            placeholder="请选择基地"
            style="width: 100%"
            :disabled="isEdit && userStore.user?.role !== 'SUPER_ADMIN'"
          >
            <el-option
              v-for="base in availableBases"
              :key="base.id"
              :label="base.name"
              :value="base.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="活动地点" prop="location">
          <el-input v-model="formData.location" placeholder="请输入活动地点" />
        </el-form-item>
        <el-form-item label="活动时间" prop="time">
          <el-date-picker
            v-model="formData.time"
            type="datetime"
            placeholder="选择活动时间"
            style="width: 100%"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DD HH:mm:ss"
          />
        </el-form-item>
        <el-form-item label="人数限制">
          <el-input-number
            v-model="formData.maxPeople"
            :min="1"
            :max="9999"
            placeholder="不限制请留空"
            style="width: 100%"
          />
        </el-form-item>
        <div class="form-info">
          当前已报名人数：{{ currentActivityRegistrations.length }} 人
        </div>
        <el-form-item label="活动价格" prop="price">
          <el-input-number
            v-model="formData.price"
            :min="0"
            :precision="2"
            placeholder="请输入活动价格"
            style="width: 100%"
          />
      </el-form-item>
      <el-form-item label="活动描述">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="4"
            placeholder="请输入活动描述"
            maxlength="1000"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="状态" prop="isActive" v-if="isEdit">
          <el-switch
            v-model="formData.isActive"
            active-text="启用"
            inactive-text="禁用"
          />
        </el-form-item>
      </el-form>
      <div id="el-id-5191-7" class="dialog-action-bar">
        <el-button @click="formVisible = false">取消</el-button>
        <el-button
          v-if="isEdit"
          type="danger"
          @click="handleDelete(currentActivity.value, true)"
        >
          删除
        </el-button>
        <el-button
          type="primary"
          @click="handleSubmit"
          :loading="submitLoading"
        >
          {{ isEdit ? '更新' : '创建' }}
        </el-button>
      </div>
    </el-dialog>

    <!-- 报名列表对话框 -->
    <el-dialog
      v-model="registrationsVisible"
      title="报名管理"
      width="90%"
      class="registration-dialog"
    >
      <el-table :data="registrations" v-loading="registrationsLoading">
        <el-table-column prop="user.username" label="用户名" width="90" />
        <el-table-column prop="user.name" label="姓名" width="100" />
        <el-table-column prop="user.phone" label="手机号" width="110" />
        <el-table-column label="订单号" width="140">
          <template #default="{ row }">
            {{ row.order?.orderNo || '未创建订单' }}
          </template>
        </el-table-column>
        <el-table-column label="支付方式" width="110">
          <template #default="{ row }">
            {{ getPaymentMethodText(row.order?.paymentMethod) }}
          </template>
        </el-table-column>
        <el-table-column label="优惠码" width="160">
          <template #default="{ row }">
            {{ row.order?.couponCode ? row.order.couponCode : '无优惠' }}
          </template>
        </el-table-column>
        <el-table-column label="用户备注" width="200">
          <template #default="{ row }">
            <el-button
              type="success"
              size="small"
              plain
              class="note-button"
              :disabled="!row.order?.userNote"
              @click="handleViewUserNote(row)"
            >
              <span class="note-button-text">
                {{ getNoteButtonText(row.order?.userNote, '无') }}
              </span>
            </el-button>
          </template>
        </el-table-column>
        <el-table-column label="管理员备注" width="200">
          <template #default="{ row }">
            <el-button
              type="warning"
              size="small"
              plain
              :disabled="!row.order"
              class="note-button"
              @click="handleAddNote(row)"
            >
              <span class="note-button-text">
                {{ getNoteButtonText(row.order?.adminNote, '添加') }}
              </span>
            </el-button>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="报名时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="支付时间" width="180">
          <template #default="{ row }">
            {{ row.order?.paymentTime ? formatDate(row.order.paymentTime) : '未支付' }}
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- 备注对话框 -->
    <el-dialog
      v-model="noteDialogVisible"
      :title="noteDialogTitle"
      width="500px"
    >
      <div class="note-dialog-content">
        <el-input
          v-model="noteContent"
          type="textarea"
          :rows="5"
          :readonly="!noteDialogEditable"
          :disabled="!noteDialogEditable"
          show-word-limit
        />
      </div>
      <template #footer>
        <el-button @click="noteDialogVisible = false">关闭</el-button>
        <el-button
          v-if="noteDialogEditable"
          type="primary"
          @click="handleSubmitNote"
          :loading="noteSubmitting"
        >
          确定
        </el-button>
      </template>
    </el-dialog>

    <!-- 奖项配置对话框 -->
    <el-dialog
      v-model="awardConfigVisible"
      :title="`奖项配置 - ${currentAwardActivity?.name}`"
      width="800px"
      top="5vh"
    >
      <div class="award-config-content">
        <div class="award-toolbar">
          <el-button type="primary" @click="handleAddAward" icon="Plus">添加奖项</el-button>
          <el-button @click="loadAwards(currentAwardActivity.id)" icon="Refresh">刷新</el-button>
        </div>

        <el-table
          :data="awards"
          v-loading="awardConfigLoading"
          style="width: 100%"
          max-height="400px"
        >
          <el-table-column prop="name" label="奖项名称" min-width="150" />
          <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
          <el-table-column prop="priority" label="优先级" width="100" />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.isActive ? 'success' : 'info'">
                {{ row.isActive ? '启用' : '禁用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <el-button
                type="primary"
                link
                size="small"
                @click="handleEditAward(row)"
              >
                编辑
              </el-button>
              <el-button
                type="danger"
                link
                size="small"
                @click="handleDeleteAward(row)"
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="award-notice" v-if="awards.length === 0">
          <el-empty description="暂无奖项配置" />
        </div>
      </div>
      <template #footer>
        <el-button @click="awardConfigVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 奖项添加/编辑对话框 -->
    <el-dialog
      v-model="awardFormVisible"
      :title="isAwardEdit ? '编辑奖项' : '添加奖项'"
      width="500px"
    >
      <el-form
        :model="awardFormData"
        label-width="80px"
      >
        <el-form-item label="奖项名称" prop="name">
          <el-input
            v-model="awardFormData.name"
            placeholder="请输入奖项名称"
            maxlength="50"
          />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input
            v-model="awardFormData.description"
            type="textarea"
            :rows="3"
            placeholder="请输入奖项描述（可选）"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="优先级" prop="priority">
          <el-input-number
            v-model="awardFormData.priority"
            :min="0"
            :max="999"
            placeholder="请输入优先级"
          />
          <div class="form-tip">优先级越高，奖项冲突时优先级越高</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="awardFormVisible = false">取消</el-button>
        <el-button type="primary" @click="submitAwardForm" :loading="awardConfigLoading">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, ArrowDown } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import request from '@/api/request'

const emit = defineEmits(['refresh'])
const userStore = useUserStore()

// 响应式数据
const loading = ref(false)
const activities = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
const searchQuery = ref('')
const baseFilter = ref('')

// 对话框相关
const detailVisible = ref(false)
const currentActivity = ref(null)
const formVisible = ref(false)
const isEdit = ref(false)
const submitLoading = ref(false)
const registrationsVisible = ref(false)
const registrationsLoading = ref(false)
const registrations = ref([])

// 备注相关
const noteDialogVisible = ref(false)
const noteContent = ref('')
const noteSubmitting = ref(false)
const currentRegistration = ref(null)
const noteDialogTitle = ref('管理员备注')
const noteDialogEditable = ref(false)

// 奖项配置相关
const awardConfigVisible = ref(false)
const awardConfigLoading = ref(false)
const currentAwardActivity = ref(null)
const awards = ref([])
const awardFormVisible = ref(false)
const isAwardEdit = ref(false)
const awardFormData = reactive({
  id: null,
  activityId: null,
  name: '',
  description: '',
  priority: 0
})

// 可用基地
const availableBases = ref([])

// 表单数据
const formRef = ref()
const formData = reactive({
  id: null,
  name: '',
  type: '',
  baseId: null,
  location: '',
  time: '',
  maxPeople: null,
  price: 0,
  description: '',
  isActive: true
})

const dialogTop = '0px'

// 当前活动的报名数据
const currentActivityRegistrations = ref([])

// 表单验证规则
const formRules = {
  name: [
    { required: true, message: '请输入活动名称', trigger: 'blur' }
  ],
  type: [
    { required: true, message: '请选择活动类型', trigger: 'change' }
  ],
  baseId: [
    { required: true, message: '请选择基地', trigger: 'change' }
  ],
  location: [
    { required: true, message: '请输入活动地点', trigger: 'blur' }
  ],
  time: [
    { required: true, message: '请选择活动时间', trigger: 'change' }
  ],
  price: [
    { required: true, message: '请输入活动价格', trigger: 'blur' }
  ]
}

// 格式化日期
const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN')
}

const getRegisteredCount = (activity) => {
  if (!activity) return 0
  if (typeof activity.registeredCount === 'number') return activity.registeredCount
  if (activity._count?.users !== undefined) return activity._count.users
  return 0
}

const formatEnrollmentDisplay = (activity) => {
  if (!activity) return '0 / 0'
  const registered = getRegisteredCount(activity)
  const total = activity.maxPeople ? activity.maxPeople : '不限'
  return `${registered} / ${total}`
}

// 权限检查
const canEdit = (activity) => {
  if (userStore.user?.role === 'SUPER_ADMIN') return true
  if (userStore.user?.role === 'ADMIN') {
    return true // 基地管理员可以编辑所有活动
  }
  return false
}

const canDelete = (activity) => {
  if (userStore.user?.role === 'SUPER_ADMIN') return true
  if (userStore.user?.role === 'ADMIN') {
    return true // 基地管理员可以删除所有活动
  }
  return false
}

// 状态相关
const getActiveTagType = (activity) => {
  if (!activity) return 'info'
  return activity.isActive ? 'success' : 'danger'
}

const getNoteButtonText = (note, fallback = '无') => {
  return note && note.trim() !== '' ? note : fallback
}

const getPaymentMethodText = (method) => {
  const map = {
    'balance': '余额支付',
    'alipay': '支付宝',
    'wechat': '微信支付',
    'coupon': '优惠券',
    '': '未支付',
    null: '未支付',
    undefined: '未支付'
  }
  return map[method] || method || '未支付'
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      limit: pageSize.value,
      isApproved: true,
      ...(searchQuery.value && { search: searchQuery.value }),
      ...(baseFilter.value && { baseId: baseFilter.value })
    }

    const response = await request.get('/activities', { params })
    activities.value = response.data || []
    total.value = response.pagination?.total || 0
  } catch (error) {
    ElMessage.error('加载数据失败：' + (error.response?.data?.error || error.message))
  } finally {
    loading.value = false
  }
}

// 加载可用基地
const loadAvailableBases = async () => {
  try {
    const params = {
      isApproved: true,
      isActive: true,
      limit: 1000
    }
    const response = await request.get('/bases', { params })
    availableBases.value = response.data || []
  } catch (error) {
    ElMessage.error('加载基地列表失败：' + (error.response?.data?.error || error.message))
  }
}

// 搜索处理
const handleSearch = () => {
  currentPage.value = 1
  loadData()
}

// 查看详情
const handleView = (activity) => {
  currentActivity.value = activity
  detailVisible.value = true
}

// 添加活动
const handleAdd = () => {
  isEdit.value = false
  resetForm()
  formVisible.value = true
}

// 编辑活动
const handleEdit = (activity) => {
  isEdit.value = true
  currentActivity.value = activity
  Object.assign(formData, {
    id: activity.id,
    name: activity.name,
    type: activity.type,
    baseId: activity.baseId,
    location: activity.location,
    time: activity.time,
    maxPeople: activity.maxPeople,
    price: activity.price || 0,
    description: activity.description || '',
    isActive: activity.isActive
  })
  loadActivityRegistrations(activity.id)
  formVisible.value = true
}

// 奖项配置
const handleAwardConfig = async (activity) => {
  currentAwardActivity.value = activity
  awardConfigVisible.value = true
  await loadAwards(activity.id)
}

// 加载奖项列表
const loadAwards = async (activityId) => {
  awardConfigLoading.value = true
  try {
    const response = await request.get(`/activities/${activityId}/awards`)
    awards.value = response.data || []
  } catch (error) {
    console.error('加载奖项失败:', error)
    ElMessage.error('加载奖项失败')
    awards.value = []
  } finally {
    awardConfigLoading.value = false
  }
}

// 添加奖项
const handleAddAward = () => {
  isAwardEdit.value = false
  Object.assign(awardFormData, {
    id: null,
    activityId: currentAwardActivity.value.id,
    name: '',
    description: '',
    priority: 0
  })
  awardFormVisible.value = true
}

// 编辑奖项
const handleEditAward = (award) => {
  isAwardEdit.value = true
  Object.assign(awardFormData, {
    id: award.id,
    activityId: award.activityId,
    name: award.name,
    description: award.description,
    priority: award.priority
  })
  awardFormVisible.value = true
}

// 删除奖项
const handleDeleteAward = async (award) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除奖项 "${award.name}" 吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await request.delete(`/activities/${award.activityId}/awards/${award.id}`)
    ElMessage.success('删除成功')
    await loadAwards(currentAwardActivity.value.id)
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除奖项失败:', error)
      ElMessage.error('删除奖项失败')
    }
  }
}

// 提交奖项表单
const submitAwardForm = async () => {
  try {
    if (isAwardEdit.value) {
      await request.put(`/activities/${awardFormData.activityId}/awards/${awardFormData.id}`, awardFormData)
      ElMessage.success('更新成功')
    } else {
      await request.post(`/activities/${awardFormData.activityId}/awards`, awardFormData)
      ElMessage.success('添加成功')
    }
    awardFormVisible.value = false
    await loadAwards(currentAwardActivity.value.id)
  } catch (error) {
    console.error('提交奖项失败:', error)
    ElMessage.error('提交奖项失败')
  }
}

// 加载活动报名数据
const loadActivityRegistrations = async (activityId) => {
  try {
    const response = await request.get(`/activities/${activityId}/registrations`)
    currentActivityRegistrations.value = response.data || []
  } catch (error) {
    console.error('加载报名数据失败:', error)
    currentActivityRegistrations.value = []
  }
}

// 重置表单
const resetForm = () => {
  Object.assign(formData, {
    id: null,
    name: '',
    type: '',
    baseId: null,
    location: '',
    time: '',
    maxPeople: null,
    price: 0,
    description: '',
    isActive: true
  })
  currentActivityRegistrations.value = []
  if (formRef.value) {
    formRef.value.clearValidate()
  }
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()

    submitLoading.value = true
    const submitData = {
      name: formData.name,
      type: formData.type,
      baseId: formData.baseId,
      location: formData.location,
      time: formData.time,
      maxPeople: formData.maxPeople,
      price: formData.price ?? 0,
      description: formData.description,
      ...(isEdit.value && { isActive: formData.isActive })
    }

    if (isEdit.value) {
      await request.put(`/activities/${formData.id}`, submitData)
      ElMessage.success('活动更新成功')
    } else {
      await request.post('/activities', submitData)
      ElMessage.success('活动创建成功')
    }

    formVisible.value = false
    loadData()
    emit('refresh')
  } catch (error) {
    ElMessage.error('操作失败：' + (error.response?.data?.error || error.message))
  } finally {
    submitLoading.value = false
  }
}

// 切换状态
const handleToggleStatus = async (activity, enable) => {
  try {
    await request.put(`/activities/${activity.id}`, {
      isActive: enable
    })
    loadData()
    emit('refresh')
  } catch (error) {
    ElMessage.error('操作失败：' + (error.response?.data?.error || error.message))
  }
}

// 查看报名列表
const handleViewRegistrations = async (activity) => {
  registrationsLoading.value = true
  registrationsVisible.value = true
  try {
    const response = await request.get(`/activities/${activity.id}/registrations`)
    registrations.value = (response.data || []).map(item => ({
      ...item,
      loading: false
    }))
  } catch (error) {
    ElMessage.error('加载报名列表失败')
  } finally {
    registrationsLoading.value = false
  }
}

// 删除活动
const handleDelete = async (activity, closeForm = false) => {
  try {
    await ElMessageBox.confirm(
      '确定要删除这个活动吗？删除后不可恢复。',
      '删除活动',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'error'
      }
    )

    await request.delete(`/activities/${activity.id}`)

    ElMessage.success('删除成功')
    if (closeForm) {
      formVisible.value = false
    }
    loadData()
    emit('refresh')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败：' + (error.response?.data?.error || error.message))
    }
  }
}

// 添加备注
const handleAddNote = (registration) => {
  if (!registration.order) {
    ElMessage.warning('该报名尚未生成订单，无法添加备注')
    return
  }
  currentRegistration.value = registration
  noteContent.value = registration.order.adminNote || ''
  noteDialogTitle.value = '管理员备注'
  noteDialogEditable.value = true
  noteDialogVisible.value = true
}

const handleViewUserNote = (registration) => {
  if (!registration.order?.userNote) {
    ElMessage.info('该报名暂无用户备注')
    return
  }
  currentRegistration.value = registration
  noteContent.value = registration.order.userNote
  noteDialogTitle.value = '用户备注'
  noteDialogEditable.value = false
  noteDialogVisible.value = true
}

// 提交备注
const handleSubmitNote = async () => {
  if (!noteDialogEditable.value) return
  if (!noteContent.value.trim()) {
    ElMessage.warning('请输入备注内容')
    return
  }

  try {
    noteSubmitting.value = true
    await request.put(`/orders/${currentRegistration.value.order.id}/admin-note`, {
      adminNote: noteContent.value.trim()
    })

    ElMessage.success('备注添加成功')
    noteDialogVisible.value = false
    handleViewRegistrations(currentActivity.value) // 刷新列表
  } catch (error) {
    ElMessage.error('备注添加失败')
  } finally {
    noteSubmitting.value = false
  }
}

onMounted(() => {
  loadData()
  loadAvailableBases()
})
</script>

<style scoped>
.approved-activities {
  width: 100%;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.toolbar-left {
  display: flex;
  gap: 10px;
  align-items: center;
}

.pagination {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.action-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: nowrap;
  align-items: center;
}

.action-buttons .el-button,
.action-buttons .el-dropdown {
  margin: 0;
  flex-shrink: 0;
}

.status-toggle {
  cursor: pointer;
}

.status-toggle:hover {
  opacity: 0.85;
}
.status-action-tag {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  min-width: 0;
  padding: 0 10px;
}
.status-action-tag:hover {
  opacity: 0.85;
}
.note-button {
  border-radius: 16px;
  padding: 10px 14px;
  min-width: 64px;
  line-height: 1.5;
  min-height: 36px;
}
.note-button-text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-align: left;
  width: 100%;
  white-space: normal;
}
.note-dialog-content :deep(.el-textarea__inner) {
  min-height: 140px;
}
:deep(.registration-dialog .el-table__header th) {
  text-align: center;
}
:deep(.registration-dialog .el-table__cell) {
  text-align: center;
}
.activity-dialog :deep(.el-dialog__body) {
  padding-bottom: 0;
  max-height: calc(100vh - 180px);
  overflow: auto;
}
:deep(#pane-approved > div > div:nth-child(5)) {
  display: flex;
  justify-content: center;
  align-items: center;
}
.dialog-action-bar {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  align-items: center;
  padding: 0;
  margin-top: 0;
  margin-bottom: 0;
  width: 100%;
  padding-top: 0;
}
.form-info {
  color: #909399;
  font-size: 12px;
  margin: 4px 0;
  text-align: center;
  width: 100%;
}
:deep(#el-id-4994-7 > form > div) {
  margin: 5px 0;
}
:deep(#pane-approved > div > div:nth-child(5) > div > div > header) {
  padding: 0;
  display: flex;
  justify-content: center;
  align-items: center;
}
:deep(.registration-dialog .el-table__cell) {
  padding-top: 0;
  padding-bottom: 0;
}

/* 奖项配置相关样式 */
.award-config-content {
  padding: 0;
}

.award-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 0;
}

.award-notice {
  text-align: center;
  padding: 40px 0;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
</style>
