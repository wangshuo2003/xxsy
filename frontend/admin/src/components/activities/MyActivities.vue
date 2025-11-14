<template>
  <div class="my-activities">
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
          v-model="statusFilter"
          placeholder="筛选状态"
          style="width: 150px"
          clearable
          @change="handleSearch"
        >
          <el-option label="待审核" value="pending" />
          <el-option label="已通过" value="approved" />
          <el-option label="已拒绝" value="rejected" />
        </el-select>
        <el-button @click="loadData">刷新</el-button>
      </div>
      <div class="toolbar-right">
        <el-button type="primary" @click="handleAdd">发布活动</el-button>
      </div>
    </div>

    <!-- 数据表格 -->
    <el-table
      :data="activities"
      v-loading="loading"
      style="width: 100%"
    >
      <el-table-column prop="name" label="活动名称" min-width="150" />
      <el-table-column prop="type" label="活动类型" width="120" />
      <el-table-column prop="location" label="活动地点" width="150" show-overflow-tooltip />
      <el-table-column prop="maxPeople" label="人数限制" width="100">
        <template #default="{ row }">
          {{ row.maxPeople || '不限' }}
        </template>
      </el-table-column>
      <el-table-column prop="time" label="活动时间" width="180">
        <template #default="{ row }">
          {{ formatDate(row.time) }}
        </template>
      </el-table-column>
      <el-table-column label="审核状态" width="100">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row)">
            {{ getStatusText(row) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="活动状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.isActive ? 'success' : 'danger'" v-if="row.isApproved">
            {{ row.isActive ? '启用' : '禁用' }}
          </el-tag>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="180">
        <template #default="{ row }">
          {{ formatDate(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="280" fixed="right">
        <template #default="{ row }">
          <div class="action-buttons">
            <el-button
              type="primary"
              size="small"
              @click="handleView(row)"
            >
              查看
            </el-button>
            <el-button
              type="success"
              size="small"
              @click="handleEdit(row)"
              v-if="canEdit(row)"
            >
              编辑
            </el-button>
            <el-button
              type="danger"
              size="small"
              @click="handleDelete(row)"
              v-if="canDelete(row)"
            >
              删除
            </el-button>
          </div>
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
          <el-descriptions-item label="活动地点">{{ currentActivity.location }}</el-descriptions-item>
          <el-descriptions-item label="人数限制">
            {{ currentActivity.maxPeople || '不限' }}
          </el-descriptions-item>
          <el-descriptions-item label="活动时间">
            {{ formatDate(currentActivity.time) }}
          </el-descriptions-item>
          <el-descriptions-item label="审核状态">
            <el-tag :type="getStatusType(currentActivity)">
              {{ getStatusText(currentActivity) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="活动状态" v-if="currentActivity.isApproved">
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
      :title="isEdit ? '编辑活动' : '发布活动'"
      width="600px"
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
        <el-form-item label="所属基地" prop="baseId" v-if="!isEdit">
          <el-select v-model="selectedBaseId" placeholder="请选择所属基地" style="width: 100%">
            <el-option
              v-for="base in managedBases"
              :key="base.id"
              :label="base.name"
              :value="base.id"
            />
          </el-select>
          <div class="form-tip">
            调试：当前选中基地ID: {{ selectedBaseId }} (类型: {{ typeof selectedBaseId }})
          </div>
          <div class="form-tip" v-if="managedBases.length === 0">
            当前没有已通过的基地，无法创建活动。
            <el-button type="text" @click="handleViewBases">查看基地管理</el-button>
          </div>
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
        <el-form-item label="草稿模式">
          <el-switch
            v-model="formData.isDraft"
            active-text="保存草稿"
            inactive-text="直接提交"
          />
          <div class="form-tip">
            草稿模式不会提交审核，保存后可以在"我的活动"中继续编辑并提交
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button
          @click="handleSaveDraft"
          :loading="submitLoading"
          v-if="!isEdit"
        >
          保存草稿
        </el-button>
        <el-button
          type="primary"
          @click="handleSubmit"
          :loading="submitLoading"
        >
          {{ isEdit ? '更新' : '发布' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
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
const statusFilter = ref('')
const managedBases = ref([])
const selectedBaseId = ref(null)

// 对话框相关
const detailVisible = ref(false)
const currentActivity = ref(null)
const formVisible = ref(false)
const isEdit = ref(false)
const submitLoading = ref(false)

// 表单数据
const formRef = ref()
const formData = reactive({
  id: null,
  name: '',
  type: '',
  location: '',
  time: '',
  maxPeople: null,
  description: '',
  isDraft: false
})

// 表单验证规则
const formRules = computed(() => ({
  name: [
    { required: true, message: '请输入活动名称', trigger: 'blur' }
  ],
  type: [
    { required: true, message: '请选择活动类型', trigger: 'change' }
  ],
  location: [
    { required: true, message: '请输入活动地点', trigger: 'blur' }
  ],
  time: [
    { required: true, message: '请选择活动时间', trigger: 'change' }
  ],
  baseId: [
    {
      required: !isEdit.value,
      message: '请选择所属基地',
      trigger: 'change'
    }
  ]
}))

// 格式化日期
const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN')
}

// 权限检查
const canEdit = (activity) => {
  return !activity.isApproved || activity.rejectReason
}


const canDelete = (activity) => {
  // 任何管理员都可以删除任何活动
  return ['SUPER_ADMIN', 'ADMIN'].includes(userStore.user?.role)
}

// 状态相关
const getStatusType = (activity) => {
  if (activity.isApproved) return 'success'
  if (activity.rejectReason) return 'danger'
  return 'warning'
}

const getStatusText = (activity) => {
  if (activity.isApproved) return '已通过'
  if (activity.rejectReason) return '已拒绝'
  return '待审核'
}

// 加载管理的基地
const loadManagedBases = async () => {
  try {
    // 任何管理员都可以管理所有已通过的基地
    console.log('正在请求已通过的基地...')
    const response = await request.get('/bases?isApproved=true')
    console.log('基地API响应:', response)

    const allBases = response.data.data || response.data || []
    console.log('获取到的基地数据:', allBases)
    managedBases.value = allBases

    // 自动选择第一个基地
    if (managedBases.value.length > 0 && !selectedBaseId.value) {
      selectedBaseId.value = managedBases.value[0].id
      console.log('自动选择基地ID:', selectedBaseId.value)
      console.log('基地ID类型:', typeof selectedBaseId.value)
      console.log('基地ID是否为数组:', Array.isArray(selectedBaseId.value))
    } else {
      console.log('没有找到任何基地')
    }
  } catch (error) {
    console.error('加载基地信息失败:', error)
    ElMessage.error('加载基地信息失败：' + (error.response?.data?.error || error.message))
  }
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      limit: pageSize.value,
      ...(searchQuery.value && { search: searchQuery.value })
    }

    // 根据状态筛选
    if (statusFilter.value) {
      if (statusFilter.value === 'pending') {
        params.isApproved = false
      } else if (statusFilter.value === 'approved') {
        params.isApproved = true
      }
    }

    const response = await request.get('/activities/my-activities', { params })
    console.log('MyActivities API响应:', response)
    console.log('响应数据结构:', response.data)
    console.log('是否直接是数组:', Array.isArray(response.data))

    // 检查响应数据结构
    let activitiesData = []
    if (Array.isArray(response.data)) {
      activitiesData = response.data
      total.value = activitiesData.length
    } else if (response.data.data) {
      activitiesData = response.data.data
      total.value = response.data.pagination?.total || 0
    }

    activities.value = activitiesData
    console.log('获取到的活动数据:', activitiesData)
    console.log('活动列表长度:', activities.value.length)

    // 如果筛选已拒绝的活动，需要在前端过滤
    if (statusFilter.value === 'rejected') {
      activities.value = activities.value.filter(activity => activity.rejectReason)
      total.value = activities.value.length
    }
  } catch (error) {
    ElMessage.error('加载数据失败：' + (error.response?.data?.error || error.message))
  } finally {
    loading.value = false
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

const router = useRouter()

// 创建基地
const handleCreateBase = () => {
  formVisible.value = false
  // 跳转到基地管理页面
  router.push('/bases')
}

// 查看基地管理
const handleViewBases = () => {
  formVisible.value = false
  // 跳转到基地管理页面
  router.push('/bases')
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
  Object.assign(formData, {
    id: activity.id,
    name: activity.name,
    type: activity.type,
    location: activity.location,
    time: activity.time,
    maxPeople: activity.maxPeople,
    description: activity.description || ''
  })
  formVisible.value = true
}

// 重置表单
const resetForm = () => {
  Object.assign(formData, {
    id: null,
    name: '',
    type: '',
    location: '',
    time: '',
    maxPeople: null,
    description: '',
    isDraft: false
  })
  if (formRef.value) {
    formRef.value.clearValidate()
  }
}

// 保存草稿
const handleSaveDraft = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()

    submitLoading.value = true
    const submitData = {
      name: formData.name,
      type: formData.type,
      location: formData.location,
      time: formData.time,
      maxPeople: formData.maxPeople,
      description: formData.description,
      baseId: selectedBaseId.value
    }

    await request.post('/activities', submitData)
    ElMessage.success('草稿保存成功')
    formVisible.value = false
    loadData()
    emit('refresh')
  } catch (error) {
    ElMessage.error('保存失败：' + (error.response?.data?.error || error.message))
  } finally {
    submitLoading.value = false
  }
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    // 手动验证表单，避免验证规则导致的baseId问题
    const isValid = await formRef.value.validateField(['name', 'type', 'location', 'time'])
    if (!isValid) {
      ElMessage.error('请填写必填项')
      return
    }

    // 检查基地是否已选择
    if (!isEdit.value && !selectedBaseId.value) {
      ElMessage.error('请选择所属基地')
      return
    }

    submitLoading.value = true

    // 构建提交数据
    const submitData = {
      name: formData.name,
      type: formData.type,
      location: formData.location,
      time: formData.time,
      maxPeople: formData.maxPeople,
      description: formData.description
    }

    // 确保baseId是数字类型
    if (!isEdit.value) {
      submitData.baseId = Number(selectedBaseId.value)
    }

    console.log('提交的活动数据:', submitData)
    console.log('基地ID类型:', typeof submitData.baseId)

    if (isEdit.value) {
      console.log('编辑模式，提交到:', `/activities/${formData.id}`)
      const response = await request.put(`/activities/${formData.id}`, submitData)
      console.log('编辑响应:', response)
      ElMessage.success('活动更新成功')
    } else {
      console.log('创建模式，提交数据:', submitData)
      console.log('请求URL:', '/activities')
      const response = await request.post('/activities', submitData)
      console.log('创建响应:', response)
      ElMessage.success('活动发布成功')
    }

    formVisible.value = false
    loadData()
    emit('refresh')
  } catch (error) {
    console.error('提交活动失败:', error)
    console.error('错误详情:', {
      response: error.response,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    })
    ElMessage.error('操作失败：' + (error.response?.data?.error || error.message))
  } finally {
    submitLoading.value = false
  }
}


// 删除活动
const handleDelete = async (activity) => {
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
    loadData()
    emit('refresh')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败：' + (error.response?.data?.error || error.message))
    }
  }
}

onMounted(() => {
  loadManagedBases()
  loadData()
})
</script>

<style scoped>
.my-activities {
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

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
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
</style>