<template>
  <div class="notifications-management">
    <div class="page-header">
      <h1>通知管理</h1>
    </div>

    <el-card class="content-card">
      <!-- 工具栏 -->
      <div class="toolbar">
        <div class="toolbar-left">
          <el-input
            v-model="searchQuery"
            placeholder="搜索通知标题或内容"
            style="width: 300px"
            @input="handleSearch"
            clearable
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>

          <el-select
            v-model="typeFilter"
            placeholder="通知类型"
            style="width: 150px"
            clearable
            @change="handleSearch"
          >
            <el-option label="全部" value="" />
            <el-option label="信息" value="INFO" />
            <el-option label="警告" value="WARNING" />
            <el-option label="成功" value="SUCCESS" />
            <el-option label="错误" value="ERROR" />
            <el-option label="公告" value="ANNOUNCEMENT" />
          </el-select>

          <el-select
            v-model="statusFilter"
            placeholder="通知状态"
            style="width: 150px"
            clearable
            @change="handleSearch"
          >
            <el-option label="全部" value="" />
            <el-option label="启用" value="true" />
            <el-option label="停用" value="false" />
          </el-select>

          <el-select
            v-model="targetRoleFilter"
            placeholder="目标角色"
            style="width: 150px"
            clearable
            @change="handleSearch"
          >
            <el-option label="全部用户" value="" />
            <el-option label="管理员" value="ADMIN" />
            <el-option label="超级管理员" value="SUPER_ADMIN" />
            <el-option label="学生" value="STUDENT" />
          </el-select>

          <el-button @click="loadData">刷新</el-button>
        </div>
        <div class="toolbar-right">
          <el-button type="primary" @click="handleAdd">发布通知</el-button>
        </div>
      </div>

      <!-- 统计卡片 -->
      <div class="stats-cards">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-number">{{ stats.total }}</div>
            <div class="stat-label">总通知数</div>
          </div>
        </el-card>
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-number">{{ stats.active }}</div>
            <div class="stat-label">启用通知</div>
          </div>
        </el-card>
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-number">{{ stats.inactive }}</div>
            <div class="stat-label">停用通知</div>
          </div>
        </el-card>
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-number">{{ stats.byType.INFO || 0 }}</div>
            <div class="stat-label">信息通知</div>
          </div>
        </el-card>
      </div>

      <!-- 数据表格 -->
      <el-table
        :data="notifications"
        v-loading="loading"
        style="width: 100%"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="title" label="通知标题" min-width="200" />
        <el-table-column prop="type" label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="getTypeTagType(row.type)">
              {{ getTypeLabel(row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="targetRole" label="目标角色" width="120">
          <template #default="{ row }">
            {{ getTargetRoleLabel(row.targetRole) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'danger'">
              {{ row.isActive ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="creator.username" label="创建人" width="120" />
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
                @click="handleEdit(row)"
              >
                编辑
              </el-button>
              <el-button
                :type="row.isActive ? 'warning' : 'success'"
                size="small"
                @click="toggleStatus(row)"
              >
                {{ row.isActive ? '停用' : '启用' }}
              </el-button>
              <el-popconfirm
                title="确定删除这条通知吗？"
                @confirm="handleDelete(row.id)"
                width="220"
              >
                <template #reference>
                  <el-button type="danger" size="small">删除</el-button>
                </template>
              </el-popconfirm>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>

      <!-- 批量操作 -->
      <div class="batch-actions" v-if="selectedNotifications.length > 0">
        <span>已选择 {{ selectedNotifications.length }} 条通知</span>
        <el-button type="warning" @click="batchToggle(false)">批量停用</el-button>
        <el-button type="success" @click="batchToggle(true)">批量启用</el-button>
        <el-button type="danger" @click="batchDelete">批量删除</el-button>
      </div>
    </el-card>

    <!-- 编辑对话框 -->
    <el-dialog
      v-model="editDialogVisible"
      :title="isEdit ? '编辑通知' : '发布通知'"
      width="600px"
      @close="resetForm"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="80px"
      >
        <el-form-item label="通知标题" prop="title">
          <el-input
            v-model="formData.title"
            placeholder="请输入通知标题"
            maxlength="100"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="通知类型" prop="type">
          <el-select v-model="formData.type" placeholder="请选择通知类型">
            <el-option label="信息" value="INFO" />
            <el-option label="警告" value="WARNING" />
            <el-option label="成功" value="SUCCESS" />
            <el-option label="错误" value="ERROR" />
            <el-option label="公告" value="ANNOUNCEMENT" />
          </el-select>
        </el-form-item>
        <el-form-item label="目标角色" prop="targetRole">
          <el-select v-model="formData.targetRole" placeholder="请选择目标角色">
            <el-option label="全部用户" value="" />
            <el-option label="管理员" value="ADMIN" />
            <el-option label="超级管理员" value="SUPER_ADMIN" />
            <el-option label="学生" value="STUDENT" />
          </el-select>
        </el-form-item>
        <el-form-item label="通知内容" prop="content">
          <el-input
            v-model="formData.content"
            type="textarea"
            :rows="6"
            placeholder="请输入通知内容"
            maxlength="2000"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="是否启用" prop="isActive" v-if="isEdit">
          <el-switch
            v-model="formData.isActive"
            active-text="启用"
            inactive-text="停用"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="editDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSubmit" :loading="submitting">
            {{ isEdit ? '更新' : '发布' }}
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { request } from '@/utils/request'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

// 响应式数据
const notifications = ref([])
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const loading = ref(false)
const searchQuery = ref('')
const typeFilter = ref('')
const statusFilter = ref('')
const targetRoleFilter = ref('')
const selectedNotifications = ref([])

// 对话框相关
const editDialogVisible = ref(false)
const isEdit = ref(false)
const submitting = ref(false)
const formRef = ref()

// 表单数据
const formData = reactive({
  title: '',
  content: '',
  type: 'INFO',
  targetRole: '',
  isActive: true
})

// 表单验证规则
const formRules = {
  title: [
    { required: true, message: '请输入通知标题', trigger: 'blur' }
  ],
  content: [
    { required: true, message: '请输入通知内容', trigger: 'blur' }
  ],
  type: [
    { required: true, message: '请选择通知类型', trigger: 'change' }
  ]
}

// 统计数据
const stats = reactive({
  total: 0,
  active: 0,
  inactive: 0,
  byType: {}
})

// 获取通知列表
const loadData = async () => {
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      limit: pageSize.value,
      ...(searchQuery.value && { search: searchQuery.value }),
      ...(typeFilter.value && { type: typeFilter.value }),
      ...(statusFilter.value && { isActive: statusFilter.value === 'true' }),
      ...(targetRoleFilter.value && { targetRole: targetRoleFilter.value })
    }

    const response = await request.get('/notifications', { params })
    notifications.value = response.data || []
    total.value = response.pagination?.total || 0

    // 获取统计数据
    loadStats()
  } catch (error) {
    ElMessage.error('加载数据失败：' + (error.response?.data?.error || error.message))
  } finally {
    loading.value = false
  }
}

// 获取统计数据
const loadStats = async () => {
  try {
    const response = await request.get('/notifications/stats')
    Object.assign(stats, response)
  } catch (error) {
    console.error('获取统计数据失败:', error)
  }
}

// 搜索处理
const handleSearch = () => {
  currentPage.value = 1
  loadData()
}

// 分页处理
const handleSizeChange = (val) => {
  pageSize.value = val
  currentPage.value = 1
  loadData()
}

const handleCurrentChange = (val) => {
  currentPage.value = val
  loadData()
}

// 选择处理
const handleSelectionChange = (selection) => {
  selectedNotifications.value = selection
}

// 添加通知
const handleAdd = () => {
  isEdit.value = false
  editDialogVisible.value = true
  resetForm()
}

// 编辑通知
const handleEdit = (row) => {
  isEdit.value = true
  Object.assign(formData, {
    id: row.id,
    title: row.title,
    content: row.content,
    type: row.type,
    targetRole: row.targetRole,
    isActive: row.isActive
  })
  editDialogVisible.value = true
}

// 切换状态
const toggleStatus = async (row) => {
  try {
    await request.put(`/notifications/${row.id}`, {
      isActive: !row.isActive
    })
    ElMessage.success(`${row.isActive ? '停用' : '启用'}成功`)
    loadData()
  } catch (error) {
    ElMessage.error('操作失败：' + (error.response?.data?.error || error.message))
  }
}

// 删除通知
const handleDelete = async (id) => {
  try {
    await request.delete(`/notifications/${id}`)
    ElMessage.success('删除成功')
    loadData()
  } catch (error) {
    ElMessage.error('删除失败：' + (error.response?.data?.error || error.message))
  }
}

// 批量切换状态
const batchToggle = async (isActive) => {
  try {
    const ids = selectedNotifications.value.map(item => item.id)
    await request.post('/notifications/batch', {
      action: isActive ? 'activate' : 'deactivate',
      notificationIds: ids
    })
    ElMessage.success(`批量${isActive ? '启用' : '停用'}成功`)
    selectedNotifications.value = []
    loadData()
  } catch (error) {
    ElMessage.error('批量操作失败：' + (error.response?.data?.error || error.message))
  }
}

// 批量删除
const batchDelete = async () => {
  try {
    await ElMessageBox.confirm('确定删除选中的通知吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    const ids = selectedNotifications.value.map(item => item.id)
    await request.post('/notifications/batch', {
      action: 'delete',
      notificationIds: ids
    })
    ElMessage.success('批量删除成功')
    selectedNotifications.value = []
    loadData()
  } catch (error) {
    ElMessage.error('批量删除失败：' + (error.response?.data?.error || error.message))
  }
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()

    submitting.value = true

    if (isEdit.value) {
      await request.put(`/notifications/${formData.id}`, formData)
      ElMessage.success('更新成功')
    } else {
      await request.post('/notifications', formData)
      ElMessage.success('发布成功')
    }

    editDialogVisible.value = false
    loadData()
  } catch (error) {
    ElMessage.error('提交失败：' + (error.response?.data?.error || error.message))
  } finally {
    submitting.value = false
  }
}

// 重置表单
const resetForm = () => {
  Object.assign(formData, {
    id: null,
    title: '',
    content: '',
    type: 'INFO',
    targetRole: '',
    isActive: true
  })
  if (formRef.value) {
    formRef.value.resetFields()
  }
}

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleString('zh-CN')
}

// 获取类型标签类型
const getTypeTagType = (type) => {
  const typeMap = {
    INFO: '',
    WARNING: 'warning',
    SUCCESS: 'success',
    ERROR: 'danger',
    ANNOUNCEMENT: 'primary'
  }
  return typeMap[type] || 'info'
}

// 获取类型标签
const getTypeLabel = (type) => {
  const typeMap = {
    INFO: '信息',
    WARNING: '警告',
    SUCCESS: '成功',
    ERROR: '错误',
    ANNOUNCEMENT: '公告'
  }
  return typeMap[type] || type
}

// 获取目标角色标签
const getTargetRoleLabel = (targetRole) => {
  if (!targetRole) return '全部用户'
  const roleMap = {
    SUPER_ADMIN: '超级管理员',
    ADMIN: '管理员',
    STUDENT: '学生'
  }
  return roleMap[targetRole] || targetRole
}

// 页面加载时获取数据
onMounted(() => {
  loadData()
})
</script>

<style scoped>
.notifications-management {
  padding: 20px;
}

.page-header {
  margin-bottom: 20px;
}

.page-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.content-card {
  background: #fff;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 0 20px;
  background: #f8f9fc;
  border-radius: 4px;
}

.toolbar-left {
  display: flex;
  gap: 10px;
  align-items: center;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.stat-card {
  text-align: center;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.stat-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.stat-number {
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
}

.stat-label {
  font-size: 14px;
  opacity: 0.9;
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.batch-actions {
  margin-top: 20px;
  padding: 15px;
  background: #f5f7fa;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.batch-actions span {
  font-weight: 500;
  color: #409eff;
}
</style>