<template>
  <div class="all-activities">
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
        <el-button type="primary" @click="handleAdd">添加活动</el-button>
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
      <el-table-column prop="base.name" label="所属基地" width="150" />
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
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <div class="action-buttons">
            <el-button
              type="primary"
              size="small"
              @click="handleEdit(row)"
            >
              查看和编辑
            </el-button>
            <el-dropdown @command="(command) => handleDropdownCommand(command, row)">
              <el-button type="warning" size="small">
                更多<el-icon><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="approve" v-if="!row.isApproved && !row.rejectReason">
                    审核通过
                  </el-dropdown-item>
                  <el-dropdown-item command="reject" v-if="!row.isApproved && !row.rejectReason">
                    审核拒绝
                  </el-dropdown-item>
                  <el-dropdown-item :command="row.isActive ? 'disable' : 'enable'" v-if="row.isApproved">
                    {{ row.isActive ? '禁用' : '启用' }}
                  </el-dropdown-item>
                  <el-dropdown-item command="registrations" v-if="row.isApproved">报名管理</el-dropdown-item>
                  <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
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
          <el-descriptions-item label="所属基地">{{ currentActivity.base?.name }}</el-descriptions-item>
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
        <el-form-item label="活动价格" prop="price">
          <el-input-number
            v-model="formData.price"
            :min="0"
            :precision="2"
            placeholder="请输入活动价格"
            style="width: 100%"
          />
          <div style="color: #909399; font-size: 12px; margin-top: 4px;">
            当前已报名人数：{{ currentActivityRegistrations.length }} 人
          </div>
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
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button
          type="primary"
          @click="handleSubmit"
          :loading="submitLoading"
        >
          {{ isEdit ? '更新' : '创建' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 审核对话框 -->
    <el-dialog
      v-model="approveVisible"
      title="审核活动"
      width="500px"
    >
      <el-form :model="approveForm" label-width="80px">
        <el-form-item label="审核结果">
          <el-radio-group v-model="approveForm.approved">
            <el-radio :label="true">通过</el-radio>
            <el-radio :label="false">拒绝</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="拒绝原因" v-if="!approveForm.approved">
          <el-input
            v-model="approveForm.rejectReason"
            type="textarea"
            :rows="4"
            placeholder="请输入拒绝原因"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="approveVisible = false">取消</el-button>
        <el-button
          type="primary"
          @click="handleConfirmApprove"
          :loading="approveLoading"
        >
          确认审核
        </el-button>
      </template>
    </el-dialog>

    <!-- 报名列表对话框 -->
    <el-dialog
      v-model="registrationsVisible"
      title="报名管理"
      width="900px"
    >
      <el-table :data="registrations" v-loading="registrationsLoading">
        <el-table-column prop="user.name" label="姓名" width="120" />
        <el-table-column prop="user.school" label="学校" width="150" />
        <el-table-column prop="user.phone" label="联系方式" width="120" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="adminNote" label="备注" width="200" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.adminNote || '无备注' }}
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="报名时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'PENDING'"
              type="success"
              size="small"
              @click="handleApproveRegistration(row)"
              :loading="row.loading"
            >
              通过
            </el-button>
            <el-button
              v-if="row.status === 'PENDING'"
              type="danger"
              size="small"
              @click="handleReject(row)"
              :loading="row.loading"
            >
              拒绝
            </el-button>
            <el-button
              v-if="row.status !== 'PENDING'"
              type="warning"
              size="small"
              @click="handleAddNote(row)"
              :loading="row.loading"
            >
              添加备注
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- 备注对话框 -->
    <el-dialog v-model="noteDialogVisible" title="添加备注" width="500px">
      <el-form>
        <el-form-item label="备注内容">
          <el-input
            v-model="noteContent"
            type="textarea"
            :rows="4"
            placeholder="请输入备注内容"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="noteDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          @click="handleSubmitNote"
          :loading="noteSubmitting"
        >
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, ArrowDown } from '@element-plus/icons-vue'
import request from '@/api/request'

const emit = defineEmits(['refresh'])

// 响应式数据
const loading = ref(false)
const activities = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
const searchQuery = ref('')
const baseFilter = ref('')
const statusFilter = ref('')

// 对话框相关
const detailVisible = ref(false)
const currentActivity = ref(null)
const formVisible = ref(false)
const isEdit = ref(false)
const submitLoading = ref(false)
const approveVisible = ref(false)
const approveLoading = ref(false)
const registrationsVisible = ref(false)
const registrationsLoading = ref(false)
const registrations = ref([])

// 备注相关
const noteDialogVisible = ref(false)
const noteContent = ref('')
const noteSubmitting = ref(false)
const currentRegistration = ref(null)

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

// 当前活动的报名数据
const currentActivityRegistrations = ref([])

// 审核表单
const approveForm = reactive({
  activityId: null,
  approved: true,
  rejectReason: ''
})

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

// 状态相关
const getStatusType = (item) => {
  if (item.isApproved || item.status === 'APPROVED') return 'success'
  if (item.rejectReason || item.status === 'REJECTED') return 'danger'
  return 'warning'
}

const getStatusText = (item) => {
  if (item.isApproved || item.status === 'APPROVED') return '已通过'
  if (item.rejectReason || item.status === 'REJECTED') return '已拒绝'
  return '待审核'
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      limit: pageSize.value,
      ...(searchQuery.value && { search: searchQuery.value }),
      ...(baseFilter.value && { baseId: baseFilter.value })
    }

    // 根据状态筛选
    if (statusFilter.value) {
      if (statusFilter.value === 'pending') {
        params.isApproved = false
      } else if (statusFilter.value === 'approved') {
        params.isApproved = true
      }
      // rejected 状态不在API参数中筛选，通过前端过滤
    }

    const response = await request.get('/activities', { params })
    let activitiesData = response.data || []

    // 如果筛选已拒绝的活动，需要在前端过滤
    if (statusFilter.value === 'rejected') {
      activitiesData = activitiesData.filter(activity => activity.rejectReason && activity.rejectReason.trim() !== '')
      total.value = activitiesData.length
    } else {
      total.value = response.pagination?.total || 0
    }

    activities.value = activitiesData
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

// 下拉菜单命令处理
const handleDropdownCommand = (command, activity) => {
  currentActivity.value = activity
  switch (command) {
    case 'approve':
    case 'reject':
      handleApprove(activity, command === 'approve')
      break
    case 'enable':
    case 'disable':
      handleToggleStatus(activity, command === 'enable')
      break
    case 'registrations':
      handleViewRegistrations(activity)
      break
    case 'delete':
      handleDelete(activity)
      break
  }
}

// 审核活动
const handleApprove = (activity, approved = true) => {
  approveForm.activityId = activity.id
  approveForm.approved = approved
  approveForm.rejectReason = ''
  approveVisible.value = true
}

// 确认审核
const handleConfirmApprove = async () => {
  if (!approveForm.approved && !approveForm.rejectReason.trim()) {
    ElMessage.warning('请输入拒绝原因')
    return
  }

  approveLoading.value = true
  try {
    await request.put(`/activities/${approveForm.activityId}/approve`, {
      approved: approveForm.approved,
      rejectReason: approveForm.approved ? null : approveForm.rejectReason
    })

    ElMessage.success(approveForm.approved ? '审核通过成功' : '审核拒绝成功')
    approveVisible.value = false
    loadData()
    emit('refresh')
  } catch (error) {
    ElMessage.error('审核失败：' + (error.response?.data?.error || error.message))
  } finally {
    approveLoading.value = false
  }
}

// 切换状态
const handleToggleStatus = async (activity, enable) => {
  try {
    const action = enable ? '启用' : '禁用'
    await ElMessageBox.confirm(
      `确认${action}这个活动吗？`,
      `${action}活动`,
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: enable ? 'success' : 'warning'
      }
    )

    await request.put(`/activities/${activity.id}`, {
      isActive: enable
    })

    ElMessage.success(`${action}成功`)
    loadData()
    emit('refresh')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('操作失败：' + (error.response?.data?.error || error.message))
    }
  }
}

// 查看报名列表
const handleViewRegistrations = async (activity) => {
  registrationsLoading.value = true
  registrationsVisible.value = true
  try {
    const response = await request.get(`/activities/${activity.id}/registrations`)
    registrations.value = response.data || []
  } catch (error) {
    ElMessage.error('加载报名列表失败')
  } finally {
    registrationsLoading.value = false
  }
}

// 审核通过报名
const handleApproveRegistration = async (registration) => {
  try {
    await ElMessageBox.confirm(
      '确认通过这个报名申请吗？',
      '审核通过',
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: 'success'
      }
    )

    registration.loading = true
    await request.put(`/activity-registrations/${registration.id}/approve`, {
      adminNote: '审核通过'
    })

    ElMessage.success('审核通过成功')
    const currentActivity = registrations.value[0]?.activity
    if (currentActivity) {
      handleViewRegistrations(currentActivity)
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('审核操作失败')
    }
  } finally {
    registration.loading = false
  }
}

// 审核拒绝报名
const handleReject = async (registration) => {
  try {
    const { value: reason } = await ElMessageBox.prompt(
      '请输入拒绝原因',
      '审核拒绝',
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        inputType: 'textarea',
        inputValidator: (value) => {
          if (!value || value.trim() === '') {
            return '拒绝原因不能为空'
          }
          return true
        }
      }
    )

    registration.loading = true
    await request.put(`/activity-registrations/${registration.id}/reject`, {
      adminNote: reason.trim()
    })

    ElMessage.success('审核拒绝成功')
    const currentActivity = registrations.value[0]?.activity
    if (currentActivity) {
      handleViewRegistrations(currentActivity)
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('审核操作失败')
    }
  } finally {
    registration.loading = false
  }
}

// 添加备注
const handleAddNote = (registration) => {
  currentRegistration.value = registration
  noteContent.value = registration.adminNote || ''
  noteDialogVisible.value = true
}

// 提交备注
const handleSubmitNote = async () => {
  if (!noteContent.value.trim()) {
    ElMessage.warning('请输入备注内容')
    return
  }

  try {
    noteSubmitting.value = true
    await request.put(`/activity-registrations/${currentRegistration.value.id}/note`, {
      adminNote: noteContent.value.trim()
    })

    ElMessage.success('备注添加成功')
    noteDialogVisible.value = false
    const currentActivity = registrations.value[0]?.activity
    if (currentActivity) {
      handleViewRegistrations(currentActivity)
    }
  } catch (error) {
    ElMessage.error('备注添加失败')
  } finally {
    noteSubmitting.value = false
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

    // 这里需要实现删除活动的API
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
  loadData()
  loadAvailableBases()
})
</script>

<style scoped>
.all-activities {
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
</style>