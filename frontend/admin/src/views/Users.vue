<template>
  <div>
    <div class="page-header">
      <h1>用户管理</h1>
    </div>

    <div class="toolbar">
      <el-button type="primary" @click="showDialog('add')">
        <el-icon><Plus /></el-icon>
        添加用户
      </el-button>
      <div class="toolbar-right">
        <el-input
          v-model="searchText"
          placeholder="搜索用户名、姓名、学校、手机号或年级"
          style="width: 260px"
          clearable
        />
      </div>
    </div>

    <el-tabs
      v-model="activeTab"
      class="users-tabs"
    >
      <el-tab-pane
        v-for="tab in tabOptions"
        :key="tab.role"
        :label="tab.label"
        :name="tab.role"
      />
    </el-tabs>

    <div class="content-card">
      <el-table :data="tableData" v-loading="loading" stripe>
        <el-table-column prop="avatar" label="头像" width="80">
          <template #default="{ row }">
            <el-avatar :src="row.avatar" :alt="row.name">
              {{ row.name.charAt(0) }}
            </el-avatar>
          </template>
        </el-table-column>
        <el-table-column prop="username" label="用户名" min-width="150">
          <template #default="{ row }">
            <el-tag
              class="username-tag"
              :class="{ 'username-tag--disabled': !canEditUser(row) }"
              :type="isUserEnabled(row) ? 'success' : 'danger'"
              effect="dark"
              @click="canEditUser(row) && handleUsernameClick(row)"
            >
              {{ row.username }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="姓名" />
        <el-table-column prop="phone" label="手机号" />
        <el-table-column
          v-if="activeTab === 'STUDENT'"
          prop="school"
          label="学校"
        />
        <el-table-column
          v-if="activeTab === 'STUDENT'"
          prop="grade"
          label="年级"
        />
        <el-table-column
          v-if="activeTab === 'STUDENT'"
          prop="className"
          label="班级"
        />
        <el-table-column prop="role" label="角色">
          <template #default="{ row }">
            <el-tag :type="getRoleTagType(row.role)">
              {{ getRoleText(row.role) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="200">
          <template #default="{ row }">
            <el-button type="primary" link @click.stop="openHistoryDialog(row)">
              {{ formatDate(row.createdAt) }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="content-pagination" v-if="pagination.total > 0">
        <span class="pagination-total">总用户数：{{ pagination.total }}</span>
        <el-pagination
          :current-page="pagination.page"
          :page-size="pagination.limit"
          :total="pagination.total"
          layout="prev, pager, next, jumper"
          @current-change="handlePageChange"
        />
      </div>
    </div>

    <!-- 添加/编辑用户对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="600px"
      :style="{ marginTop: '50px', marginBottom: '0' }"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" :disabled="dialogMode === 'edit'" />
        </el-form-item>
        <el-form-item label="密码" prop="password" v-if="dialogMode === 'add'">
          <el-input v-model="form.password" type="password" show-password />
        </el-form-item>
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" />
        </el-form-item>
        <el-form-item label="学校" prop="school">
          <el-input v-model="form.school" placeholder="可选" />
        </el-form-item>
        <el-form-item label="年级" prop="grade">
          <el-input v-model="form.grade" placeholder="可选" />
        </el-form-item>
        <el-form-item label="班级" prop="className">
          <el-input v-model="form.className" placeholder="可选" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="form.role" style="width: 100%" :disabled="!isSuperAdmin && dialogMode === 'edit'">
            <el-option
              v-for="option in roleOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
          <div v-if="!isSuperAdmin && dialogMode === 'edit'" style="font-size: 12px; color: #909399; margin-top: 4px;">
            只有超级管理员可以修改用户角色
          </div>
        </el-form-item>
        <el-form-item v-if="dialogMode === 'edit'" label="新密码" prop="newPassword">
          <el-input v-model="form.newPassword" type="password" show-password placeholder="留空则不修改" />
        </el-form-item>
        <el-form-item v-if="dialogMode === 'edit'" label="确认密码" prop="confirmPassword">
          <el-input v-model="form.confirmPassword" type="password" show-password placeholder="再次输入新密码" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer users-dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button
            v-if="dialogMode === 'edit'"
            type="danger"
            @click="handleDialogDelete"
            :disabled="!canDeleteUser(form)"
          >
            删除
          </el-button>
          <el-button
            v-if="dialogMode === 'edit'"
            :type="form.isDisabled ? 'success' : 'danger'"
            :loading="toggleStatusLoading"
            @click="handleToggleStatus"
          >
            {{ form.isDisabled ? '启用用户' : '禁用用户' }}
          </el-button>
          <el-button type="primary" @click="handleSubmit">确定</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 重置密码对话框 -->
    <el-dialog v-model="passwordDialogVisible" title="重置密码" width="400px">
      <el-form ref="passwordFormRef" :model="passwordForm" :rules="passwordRules" label-width="80px">
        <el-form-item label="新密码" prop="newPassword">
          <el-input v-model="passwordForm.newPassword" type="password" show-password />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input v-model="passwordForm.confirmPassword" type="password" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="passwordDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handlePasswordSubmit">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="historyDialogVisible"
      :title="historyDialogTitle"
      width="1100px"
    >
      <el-table
        :data="historyRecords"
        border
        height="420"
        v-loading="historyLoading"
      >
        <el-table-column prop="name" label="用户名" min-width="140" />
        <el-table-column prop="phone" label="手机号" min-width="140" />
        <el-table-column prop="school" label="学校" min-width="140" />
        <el-table-column prop="grade" label="年级" min-width="120" />
        <el-table-column prop="className" label="班级" min-width="120" />
        <el-table-column prop="changedBy" label="操作人" min-width="140" />
        <el-table-column label="记录时间" min-width="200">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import request from '@/api/request'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const loading = ref(false)
const dialogVisible = ref(false)
const passwordDialogVisible = ref(false)
const dialogMode = ref('add')
const searchText = ref('')
const roleFilter = ref('')
const sortBy = ref('name')
const sortOrder = ref('asc')
const currentUserId = ref(null)
const toggleStatusLoading = ref(false)
const activeTab = ref('')

const formRef = ref()
const passwordFormRef = ref()
const historyDialogVisible = ref(false)
const historyDialogTitle = ref('用户历史记录')
const historyRecords = ref([])
const historyLoading = ref(false)

const tableData = ref([])
const pagination = reactive({
  page: 1,
  limit: 10,
  total: 0
})

const form = reactive({
  id: null,
  username: '',
  password: '',
  name: '',
  phone: '',
  school: '',
  grade: '',
  className: '',
  role: 'STUDENT',
  newPassword: '',
  confirmPassword: '',
  isDisabled: false
})

const passwordForm = reactive({
  newPassword: '',
  confirmPassword: ''
})

const validateConfirmPassword = (rule, value, callback) => {
  if (!form.newPassword && !value) return callback()
  if (form.newPassword && !value) return callback(new Error('请确认密码'))
  if (value !== form.newPassword) return callback(new Error('两次输入密码不一致'))
  return callback()
}

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' }
  ],
  name: [
    { required: true, message: '请输入姓名', trigger: 'blur' }
  ],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' }
  ],
  role: [
    { required: true, message: '请选择角色', trigger: 'change' }
  ],
  newPassword: [
    {
      validator: (rule, value, callback) => {
        if (!value) return callback()
        if (value.length < 6) return callback(new Error('密码至少6位'))
        return callback()
      },
      trigger: 'blur'
    }
  ],
  confirmPassword: [
    { validator: validateConfirmPassword, trigger: 'blur' }
  ]
}

const passwordRules = {
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value !== passwordForm.newPassword) {
          callback(new Error('两次输入密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

const dialogTitle = computed(() => dialogMode.value === 'add' ? '添加用户' : '编辑用户')

// 权限控制
const isSuperAdmin = computed(() => userStore.user?.role === 'SUPER_ADMIN')
const isActivityAdmin = computed(() => userStore.user?.role === 'ACTIVITY_ADMIN')

// 角色选项
const roleOptions = computed(() => {
  if (isSuperAdmin.value) {
    return [
      { label: '学生', value: 'STUDENT' },
      { label: '活动管理员', value: 'ACTIVITY_ADMIN' },
      { label: '超级管理员', value: 'SUPER_ADMIN' }
    ]
  } else if (isActivityAdmin.value) {
    // 活动管理员只能创建学生用户
    return [
      { label: '学生', value: 'STUDENT' }
    ]
  }
  return []
})

const tabOptions = computed(() => {
  if (isSuperAdmin.value) {
    return [
      { label: '用户', role: 'STUDENT' },
      { label: '活动管理员', role: 'ACTIVITY_ADMIN' },
      { label: '超级管理员', role: 'SUPER_ADMIN' }
    ]
  }
  if (isActivityAdmin.value) {
    return [{ label: '用户', role: 'STUDENT' }]
  }
  return []
})

const getRoleText = (role) => {
  const roleMap = {
    'SUPER_ADMIN': '超级管理员',
    'ACTIVITY_ADMIN': '活动管理员',
    'STUDENT': '学生'
  }
  return roleMap[role] || role
}

const getRoleTagType = (role) => {
  const typeMap = {
    'SUPER_ADMIN': 'danger',
    'ACTIVITY_ADMIN': 'warning',
    'STUDENT': 'success'
  }
  return typeMap[role] || ''
}

const isUserEnabled = (user) => {
  if (typeof user.isDisabled === 'boolean') {
    return !user.isDisabled
  }
  if (typeof user.isActive === 'boolean') {
    return user.isActive
  }
  if (typeof user.enabled === 'boolean') {
    return user.enabled
  }
  if (typeof user.status === 'string') {
    return user.status !== 'DISABLED'
  }
  return true
}

// 权限检查函数
const canEditUser = (user) => {
  if (isSuperAdmin.value) return true
  if (isActivityAdmin.value) return user.role === 'STUDENT'
  return false
}

const canDeleteUser = (user) => {
  if (isSuperAdmin.value) return true
  if (isActivityAdmin.value) return user.role === 'STUDENT'
  return false
}

const setSort = (field, order) => {
  sortBy.value = field
  sortOrder.value = order
  loadData()
}

const loadData = async () => {
  if (!roleFilter.value) return
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      limit: pagination.limit,
      search: searchText.value?.trim(),
      role: roleFilter.value,
      sortBy: sortBy.value,
      sortOrder: sortOrder.value
    }
    Object.keys(params).forEach((key) => {
      if (params[key] === '' || params[key] === undefined) {
        delete params[key]
      }
    })
    const response = await request.get('/users', { params })
    tableData.value = response.data
    pagination.total = response.pagination.total
  } catch (error) {
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

const showDialog = (mode, row = null) => {
  dialogMode.value = mode
  dialogVisible.value = true

  if (mode === 'edit' && row) {
    Object.assign(form, {
      id: row.id,
      username: row.username,
      password: '',
      name: row.name,
      phone: row.phone,
      school: row.school || '',
      grade: row.grade || '',
      className: row.className || '',
      role: row.role,
      newPassword: '',
      confirmPassword: '',
      isDisabled: Boolean(row.isDisabled)
    })
  } else {
    Object.assign(form, {
      id: null,
      username: '',
      password: '',
      name: '',
      phone: '',
      school: '',
      grade: '',
      className: '',
      role: 'STUDENT',
      newPassword: '',
      confirmPassword: '',
      isDisabled: false
    })
  }
}

const showPasswordDialog = (row) => {
  currentUserId.value = row.id
  passwordForm.newPassword = ''
  passwordForm.confirmPassword = ''
  passwordDialogVisible.value = true
}

const openHistoryDialog = async (row) => {
  if (!row?.id) return
  historyDialogTitle.value = `历史记录 - ${row.username}`
  historyDialogVisible.value = true
  historyLoading.value = true
  historyRecords.value = []
  try {
    const response = await request.get(`/users/${row.id}/history`)
    historyRecords.value = (response.data || []).map((item) => ({
      ...item,
      username: item.username || row.username,
      name: item.name || row.name
    }))
  } catch (error) {
    console.error('加载历史记录失败:', error)
    ElMessage.error(error.response?.data?.error || '加载历史记录失败')
  } finally {
    historyLoading.value = false
  }
}

const handleUsernameClick = (row) => {
  showDialog('edit', row)
}

const handleDialogDelete = () => {
  if (dialogMode.value !== 'edit' || !form.id) return
  handleDelete(
    { id: form.id, name: form.name, role: form.role },
    { closeDialog: true }
  )
}

const handleToggleStatus = async () => {
  if (dialogMode.value !== 'edit' || !form.id || toggleStatusLoading.value) return
  toggleStatusLoading.value = true
  const nextStatus = !form.isDisabled
  try {
    await request.put(`/users/${form.id}/status`, { isDisabled: nextStatus })
    form.isDisabled = nextStatus
    ElMessage.success(nextStatus ? '用户已禁用' : '用户已启用')
    loadData()
  } catch (error) {
    ElMessage.error(error.response?.data?.error || '更新状态失败')
  } finally {
    toggleStatusLoading.value = false
  }
}


const handleSubmit = async () => {
  if (!formRef.value) return

  await formRef.value.validate(async (valid) => {
    if (!valid) return

    try {
      const data = {
        username: form.username,
        name: form.name,
        phone: form.phone,
      school: form.school,
      grade: form.grade,
      className: form.className,
      role: form.role
      }

      if (dialogMode.value === 'add') {
        data.password = form.password
        await request.post('/users', data)
        ElMessage.success('添加成功')
      } else {
        await request.put(`/users/${form.id}`, data)
        if (form.newPassword) {
          await request.put(`/users/${form.id}/password`, {
            newPassword: form.newPassword
          })
        }
        ElMessage.success(form.newPassword ? '用户信息与密码更新成功' : '更新成功')
      }

      form.newPassword = ''
      form.confirmPassword = ''
      dialogVisible.value = false
      loadData()
    } catch (error) {
      ElMessage.error(error.response?.data?.error || '操作失败')
    }
  })
}

const handlePasswordSubmit = async () => {
  if (!passwordFormRef.value) return

  await passwordFormRef.value.validate(async (valid) => {
    if (!valid) return

    try {
      await request.put(`/users/${currentUserId.value}/password`, {
        newPassword: passwordForm.newPassword
      })
      ElMessage.success('密码重置成功')
      passwordDialogVisible.value = false
    } catch (error) {
      ElMessage.error('密码重置失败')
    }
  })
}

const handleDelete = (row, options = {}) => {
  ElMessageBox.confirm(`确定要删除用户"${row.name}"吗？此操作不可恢复。`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      await request.delete(`/users/${row.id}`)
      ElMessage.success('删除成功')
      if (options.closeDialog) {
        dialogVisible.value = false
      }
      loadData()
    } catch (error) {
      ElMessage.error('删除失败')
    }
  })
}

const handlePageChange = (page) => {
  pagination.page = page
  loadData()
}

const formatDate = (date) => {
  return new Date(date).toLocaleString('zh-CN')
}

onMounted(() => {
  const firstTab = tabOptions.value[0]
  if (firstTab) {
    activeTab.value = firstTab.role
  }
})

watch(tabOptions, (tabs) => {
  if (!tabs.length) return
  if (!tabs.find(tab => tab.role === activeTab.value)) {
    activeTab.value = tabs[0].role
  }
})

watch(activeTab, (role) => {
  if (!role) return
  roleFilter.value = role
  pagination.page = 1
  loadData()
})

watch(
  () => form.newPassword,
  () => {
    if (dialogMode.value === 'edit' && formRef.value) {
      formRef.value.validateField('confirmPassword').catch(() => {})
    }
  }
)

watch(searchText, () => {
  pagination.page = 1
  loadData()
})
</script>

<style scoped>
.username-tag {
  cursor: pointer;
  user-select: none;
}

.username-tag--disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.users-dialog-footer {
  display: flex;
  justify-content: center;
  gap: 12px;
}

:deep(.users-tabs) {
  margin: 10px 0 20px;
  display: flex;
  justify-content: center;
}

:deep(.el-table th .cell),
:deep(.el-table td .cell) {
  text-align: center;
}
</style>
