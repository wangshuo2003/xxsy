<template>
  <div class="approved-bases">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <el-input
          v-model="searchQuery"
          placeholder="搜索基地名称或类型"
          style="width: 300px"
          @input="handleSearch"
          clearable
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-button @click="loadData">刷新</el-button>
      </div>
      <div class="toolbar-right" v-if="['SUPER_ADMIN', 'ADMIN'].includes(userStore.user?.role)">
        <el-button type="primary" @click="handleAdd">添加基地</el-button>
      </div>
    </div>

    <!-- 数据表格 -->
    <el-table
      :data="bases"
      v-loading="loading"
      style="width: 100%"
    >
      <el-table-column label="基地名称" min-width="150">
        <template #default="{ row }">
          <el-tag
            :type="row.isActive ? 'success' : 'danger'"
            class="name-action-tag"
            @click="handleEdit(row)"
          >
            {{ row.name }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="type" label="基地类型" width="120" />
      <el-table-column prop="address" label="地址" min-width="200" show-overflow-tooltip />
      <el-table-column prop="contact" label="联系方式" width="150" />
      <el-table-column label="基地管理员" min-width="150">
        <template #default="{ row }">
          <el-button 
            type="primary" 
            link 
            @click="handleManageAdmins(row)"
          >
            {{ row.admins?.map(a => a.username).join(', ') || '未设置' }}
          </el-button>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="180">
        <template #default="{ row }">
          {{ formatDate(row.createdAt) }}
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
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>

    <!-- 查看详情对话框 -->
    <el-dialog
      v-model="detailVisible"
      title="基地详情"
      width="700px"
    >
      <div v-if="currentBase">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="基地名称">{{ currentBase.name }}</el-descriptions-item>
          <el-descriptions-item label="基地类型">{{ currentBase.type }}</el-descriptions-item>
          <el-descriptions-item label="地址" :span="2">{{ currentBase.address }}</el-descriptions-item>
          <el-descriptions-item label="联系方式">{{ currentBase.contact }}</el-descriptions-item>
          <el-descriptions-item label="基地管理员">
            {{ currentBase.admins?.map(a => a.name).join(', ') || '未设置' }}
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="currentBase.isActive ? 'success' : 'danger'">
              {{ currentBase.isActive ? '启用' : '禁用' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatDate(currentBase.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="描述" :span="2">
            {{ currentBase.description || '暂无描述' }}
          </el-descriptions-item>
        </el-descriptions>

        <!-- 拒绝原因（如果有） -->
        <el-alert
          v-if="currentBase.rejectReason"
          :title="`拒绝原因：${currentBase.rejectReason}`"
          type="error"
          show-icon
          style="margin-top: 20px"
        />
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button
          type="primary"
          @click="handleEdit(currentBase)"
          v-if="['SUPER_ADMIN', 'ADMIN'].includes(userStore.user?.role)"
        >
          编辑
        </el-button>
      </template>
    </el-dialog>

    <!-- 添加/编辑对话框 -->
    <el-dialog
      v-model="formVisible"
      :title="isEdit ? '编辑基地' : '添加基地'"
      width="600px"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="100px"
      >
        <el-form-item label="基地名称" prop="name">
          <el-input v-model="formData.name" placeholder="请输入基地名称" />
        </el-form-item>
        <el-form-item label="基地类型" prop="type">
          <el-select v-model="formData.type" placeholder="请选择基地类型" style="width: 100%">
            <el-option label="教育实践基地" value="教育实践基地" />
            <el-option label="研学基地" value="研学基地" />
            <el-option label="实训基地" value="实训基地" />
            <el-option label="创业基地" value="创业基地" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>
        <el-form-item label="地址" prop="address">
          <el-input v-model="formData.address" placeholder="请输入基地地址" />
        </el-form-item>
        <el-form-item label="联系方式" prop="contact">
          <el-input v-model="formData.contact" placeholder="请输入联系方式" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="4"
            placeholder="请输入基地描述"
            maxlength="500"
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
        <div class="dialog-action-bar">
          <el-button @click="formVisible = false">取消</el-button>
          <el-button
            v-if="isEdit"
            type="danger"
            @click="handleDeleteFromForm"
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
      </template>
    </el-dialog>

    <!-- 管理员编辑对话框 -->
    <el-dialog
      v-model="managerEditorVisible"
      title="管理基地管理员"
      width="800px"
      destroy-on-close
      @close="handleManagerEditorClose"
    >
      <BaseManagerEditor
        v-if="managerEditorVisible"
        :base-id="currentBaseId"
        :initial-manager-ids="currentManagerIds"
        @cancel="managerEditorVisible = false"
        @success="handleManagerEditorSuccess"
      />
    </el-dialog>

  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import request from '@/api/request'
import BaseManagerEditor from './BaseManagerEditor.vue'

const emit = defineEmits(['refresh'])
const userStore = useUserStore()

// 响应式数据
const loading = ref(false)
const bases = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
const searchQuery = ref('')

// 对话框相关
const detailVisible = ref(false)
const currentBase = ref(null)
const formVisible = ref(false)
const isEdit = ref(false)
const submitLoading = ref(false)
const availableManagers = ref([])
const originalManagerIds = ref([])

// 管理员编辑器相关
const managerEditorVisible = ref(false)
const currentBaseId = ref(0)
const currentManagerIds = ref([])

// 表单数据
const formRef = ref()
const formData = reactive({
  id: null,
  name: '',
  type: '',
  address: '',
  contact: '',
  description: '',
  isActive: true,
  managerIds: []
})

// 表单验证规则
const formRules = {
  name: [
    { required: true, message: '请输入基地名称', trigger: 'blur' }
  ],
  type: [
    { required: true, message: '请选择基地类型', trigger: 'change' }
  ],
  address: [
    { required: true, message: '请输入基地地址', trigger: 'blur' }
  ],
  contact: [
    { required: true, message: '请输入联系方式', trigger: 'blur' }
  ]
}

// 格式化日期
const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN')
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    console.log('ApprovedBases 开始加载数据，当前页:', currentPage.value)
    console.log('ApprovedBases 页面大小:', pageSize.value)
    console.log('ApprovedBases 搜索词:', searchQuery.value)

    // 使用标准的axios参数传递方式，而不是手动拼接URL
    const params = {
      page: currentPage.value,
      limit: pageSize.value,
      isApproved: true
    }

    if (searchQuery.value) {
      params.search = searchQuery.value
    }

    console.log('ApprovedBases 请求参数:', params)

    const response = await request.get('/bases', { params })
    console.log('ApprovedBases 完整API响应:', response)
    console.log('ApprovedBases 响应类型:', typeof response)
    console.log('ApprovedBases 响应结构:', {
      hasData: !!response.data,
      dataType: Array.isArray(response.data) ? `数组[${response.data.length}]` : typeof response.data,
      hasPagination: !!response.pagination,
      dataLength: response.data?.length || 0,
      total: response.pagination?.total || 0
    })

    bases.value = response.data || []
    total.value = response.pagination?.total || 0

    console.log('ApprovedBases 数据处理后:', {
      basesCount: bases.value.length,
      totalCount: total.value,
      basesSample: bases.value.slice(0, 2),
      currentPage: currentPage.value,
      pageSize: pageSize.value
    })
  } catch (error) {
    console.error('ApprovedBases 加载数据失败:', error)
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

// 分页大小变化处理
const handleSizeChange = (newSize) => {
  console.log('分页大小变化:', newSize)
  pageSize.value = newSize
  currentPage.value = 1  // 重置到第一页
  loadData()
}

// 当前页变化处理
const handleCurrentChange = (newPage) => {
  console.log('当前页变化:', newPage)
  currentPage.value = newPage
  loadData()
}

// 查看详情
const handleView = (base) => {
  currentBase.value = base
  detailVisible.value = true
}

// 添加基地
const handleAdd = () => {
  isEdit.value = false
  resetForm()
  formVisible.value = true
}

// 编辑基地
const handleEdit = (base) => {
  isEdit.value = true
  Object.assign(formData, {
    id: base.id,
    name: base.name,
    type: base.type,
    address: base.address,
    contact: base.contact,
    description: base.description || '',
    isActive: base.isActive,
    managerIds: base.admins?.map(a => a.id) || []
  })
  originalManagerIds.value = [...formData.managerIds]
  loadManagersList()
  formVisible.value = true
}

// 重置表单
const resetForm = () => {
  Object.assign(formData, {
    id: null,
    name: '',
    type: '',
    address: '',
    contact: '',
    description: '',
    isActive: true,
    managerIds: []
  })
  if (formRef.value) {
    formRef.value.clearValidate()
  }
  originalManagerIds.value = []
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
      address: formData.address,
      contact: formData.contact,
      description: formData.description,
      ...(isEdit.value && { isActive: formData.isActive })
    }

    if (isEdit.value) {
      await request.put(`/bases/${formData.id}`, submitData)
      ElMessage.success('基地更新成功')
    } else {
      await request.post('/bases', submitData)
      ElMessage.success('基地创建成功')
    }

    if (
      isEdit.value &&
      JSON.stringify(formData.managerIds.sort()) !== JSON.stringify(originalManagerIds.value.sort())
    ) {
      try {
        await request.put(`/bases/${formData.id}/manager`, {
          managerIds: formData.managerIds
        })
        ElMessage.success('基地管理员已更新')
        originalManagerIds.value = [...formData.managerIds]
      } catch (error) {
        ElMessage.error('管理员更新失败：' + (error.response?.data?.error || error.message))
      }
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

const handleDeleteFromForm = async () => {
  if (!formData.id) return
  await handleDelete({ id: formData.id })
  formVisible.value = false
}

const loadManagersList = async () => {
  try {
    const response = await request.get('/users', {
      params: { role: 'ACTIVITY_ADMIN', limit: 1000 }
    })
    availableManagers.value = response.data || response.data?.data || []
  } catch (error) {
    ElMessage.error('加载管理员列表失败：' + (error.response?.data?.error || error.message))
  }
}

// 切换状态
const handleToggleStatus = async (base, enable) => {
  try {
    // 检查权限：超级管理员可以操作所有基地，基地管理员可以操作所有已通过基地
    if (!['SUPER_ADMIN', 'ADMIN'].includes(userStore.user?.role)) {
      ElMessage.warning('权限不足')
      return
    }

    const action = enable ? '启用' : '禁用'
    await ElMessageBox.confirm(
      `确认${action}这个基地吗？`,
      `${action}基地`,
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: enable ? 'success' : 'warning'
      }
    )

    console.log(`准备${action}基地 ${base.id}, 当前状态:`, base.isActive)
    console.log(`新状态:`, enable)

    const response = await request.put(`/bases/${base.id}`, {
      isActive: enable
    })

    console.log('API响应:', response)
    ElMessage.success(`${action}成功`)

    // 刷新数据
    await loadData()
    emit('refresh')
  } catch (error) {
    if (error !== 'cancel') {
      console.error(`${action}失败:`, error)
      ElMessage.error('操作失败：' + (error.response?.data?.error || error.message))
    }
  }
}

// 删除基地
const handleDelete = async (base) => {
  try {
    await ElMessageBox.confirm(
      '确定要删除这个基地吗？删除后不可恢复。',
      '删除基地',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'error'
      }
    )

    await request.delete(`/bases/${base.id}`)
    ElMessage.success('删除成功')
    loadData()
    emit('refresh')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败：' + (error.response?.data?.error || error.message))
    }
  }
}

// 监听父组件的刷新请求，但保持分页状态
const refreshData = () => {
  loadData()
}

// 导出方法供父组件调用
defineExpose({
  refreshData
})

// 打开管理员编辑器
const handleManageAdmins = (base) => {
  currentBaseId.value = base.id
  currentManagerIds.value = base.admins?.map(a => a.id) || []
  managerEditorVisible.value = true
}

// 管理员编辑成功
const handleManagerEditorSuccess = () => {
  managerEditorVisible.value = false
  loadData()
  emit('refresh')
}

// 管理员编辑器关闭时刷新数据
const handleManagerEditorClose = () => {
  loadData()
  emit('refresh')
}

onMounted(() => {
  loadData()
  loadManagersList()
})
</script>

<style scoped>
.approved-bases {
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
.name-action-tag {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  font-weight: 500;
}
.name-action-tag:hover {
  opacity: 0.85;
}
.dialog-action-bar {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
}
</style>