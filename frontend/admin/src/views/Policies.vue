<template>
  <div class="policy-management">
    <div class="page-header">
      <h1>政策通知管理</h1>
    </div>

    <div class="policy-card-wrapper">
      <el-card class="content-card policy-card">
      <!-- 工具栏 -->
      <div class="toolbar">
        <div class="toolbar-left">
          <el-input
            v-model="searchQuery"
            placeholder="搜索政策标题或标签"
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
            placeholder="状态筛选"
            style="width: 150px"
            clearable
            @change="handleSearch"
          >
            <el-option label="全部" value="" />
            <el-option label="已发布" value="false" />
            <el-option label="隐藏" value="true" />
          </el-select>

          <el-button @click="loadData">刷新</el-button>
        </div>
        <div class="toolbar-right">
          <el-button type="primary" @click="handleAdd">发布政策通知</el-button>
        </div>
      </div>

      <!-- 数据表格 -->
      <div class="table-wrapper">
        <el-table
          class="policy-table"
          :data="policies"
          v-loading="loading"
          style="width: 100%"
          row-key="id"
        >
          <el-table-column prop="title" label="标题" min-width="220">
            <template #default="{ row }">
              <el-button
                class="title-button"
                :class="row.isDraft ? 'is-draft' : 'is-published'"
                size="small"
                @click="handleEdit(row)"
              >
                {{ row.title || '未命名' }}
              </el-button>
            </template>
          </el-table-column>
          <el-table-column prop="tags" label="标签" width="150">
            <template #default="{ row }">
              <el-tag v-if="row.tags" size="small">{{ row.tags }}</el-tag>
              <span v-else class="text-gray">-</span>
            </template>
          </el-table-column>
          <el-table-column label="附件" width="120">
            <template #default="{ row }">
              <div class="attachment-preview">
                <el-button v-if="row.videoUrl" type="text" size="small" @click="previewFile(row.videoUrl, 'video')">
                  <el-icon><VideoPlay /></el-icon>
                  视频
                </el-button>
                <el-button v-if="row.fileUrl" type="text" size="small" @click="previewFile(row.fileUrl, 'file')">
                  <el-icon><Document /></el-icon>
                  文件
                </el-button>
                <span v-if="!row.videoUrl && !row.fileUrl" class="text-gray">无</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="creator.name" label="创建人" width="120" />
          <el-table-column prop="createdAt" label="创建时间" width="180">
            <template #default="{ row }">
              {{ formatDate(row.createdAt) }}
            </template>
          </el-table-column>
        </el-table>
      </div>

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
      </el-card>
    </div>

    <!-- 编辑对话框 -->
    <el-dialog
      class="policy-edit-dialog"
      v-model="editDialogVisible"
      :title="isEdit ? '编辑政策通知' : '发布政策通知'"
      width="900px"
      @close="resetForm"
      :close-on-click-modal="true"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="100px"
      >
        <el-form-item label="标题" prop="title">
          <el-input
            v-model="formData.title"
            placeholder="请输入政策通知标题"
            maxlength="100"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="标签">
          <el-input
            v-model="formData.tags"
            placeholder="请输入标签，多个标签用逗号分隔"
            maxlength="100"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="内容" prop="content">
          <el-input
            v-model="formData.content"
            type="textarea"
            :rows="8"
            placeholder="请输入政策通知内容"
            maxlength="5000"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="视频上传" class="upload-video-item">
          <el-upload
            class="upload-demo"
            :action="uploadUrl"
            :headers="uploadHeaders"
            :on-success="handleVideoSuccess"
            :on-remove="handleVideoRemove"
            :file-list="videoFileList"
            :before-upload="beforeVideoUpload"
            accept="video/*"
            :limit="1"
          >
            <el-button type="primary">上传视频</el-button>
            <template #tip>
              <div class="el-upload__tip">
                支持常见视频格式，文件大小不超过50MB
              </div>
            </template>
          </el-upload>
        </el-form-item>

        <el-form-item label="文件上传">
          <el-upload
            class="upload-demo"
            :action="uploadUrl"
            :headers="uploadHeaders"
            :on-success="handleFileSuccess"
            :on-remove="handleFileRemove"
            :file-list="fileFileList"
            :before-upload="beforeFileUpload"
            :limit="1"
          >
            <el-button type="primary">上传文件</el-button>
            <template #tip>
              <div class="el-upload__tip">
                支持PDF、Word、Excel等格式，文件大小不超过20MB
              </div>
            </template>
          </el-upload>
        </el-form-item>

      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="editDialogVisible = false">取消</el-button>
          <el-button
            class="draft-toggle-btn"
            :class="{ 'is-hidden': formData.isDraft }"
            :loading="submitting"
            @click="handleDraftAction"
          >
            {{ formData.isDraft ? '显示' : '隐藏' }}
          </el-button>
          <el-button type="primary" @click="handleSubmit" :loading="submitting">
            {{ isEdit ? '更新' : '发布' }}
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 文件预览对话框 -->
    <el-dialog
      v-model="previewDialogVisible"
      title="文件预览"
      width="800px"
    >
      <div v-if="previewType === 'video'" class="video-preview">
        <video :src="previewUrl" controls style="width: 100%; max-height: 500px;">
          您的浏览器不支持视频播放
        </video>
      </div>
      <div v-else class="file-preview">
        <el-alert
          title="文件预览"
          description="点击下方链接下载或在新窗口打开文件"
          type="info"
          show-icon
        />
        <div class="file-link">
          <el-link :href="previewUrl" target="_blank" type="primary">
            {{ previewUrl }}
          </el-link>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, VideoPlay, Document } from '@element-plus/icons-vue'
import request from '@/api/request'

// 响应式数据
const policies = ref([])
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)
const loading = ref(false)
const searchQuery = ref('')
const statusFilter = ref('')

// 对话框相关
const editDialogVisible = ref(false)
const previewDialogVisible = ref(false)
const isEdit = ref(false)
const submitting = ref(false)
const formRef = ref()
const previewUrl = ref('')
const previewType = ref('')

// 文件上传相关
const uploadUrl = `${import.meta.env.VITE_API_BASE_URL || ''}/api/policies/upload`
const uploadHeaders = computed(() => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`
}))
const videoFileList = ref([])
const fileFileList = ref([])

// 表单数据
const formData = reactive({
  title: '',
  content: '',
  tags: '',
  isDraft: false,
  videoUrl: '',
  fileUrl: ''
})

// 表单验证规则
const formRules = {
  title: [
    { required: true, message: '请输入政策通知标题', trigger: 'blur' }
  ],
  content: [
    { required: true, message: '请输入政策通知内容', trigger: 'blur' }
  ]
}


// 获取政策通知列表
const loadData = async () => {
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      limit: pageSize.value,
      ...(searchQuery.value && { search: searchQuery.value }),
      ...(statusFilter.value && { isDraft: statusFilter.value === 'true' })
    }

    const response = await request.get('/policies', { params })
    policies.value = response.data || []
    total.value = response.pagination?.total || 0
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


// 添加政策通知
const handleAdd = () => {
  isEdit.value = false
  editDialogVisible.value = true
  resetForm()
}

// 编辑政策通知
const handleEdit = (row) => {
  isEdit.value = true
  Object.assign(formData, {
    id: row.id,
    title: row.title,
    content: row.content,
    tags: row.tags,
    isDraft: row.isDraft,
    videoUrl: row.videoUrl || '',
    fileUrl: row.fileUrl || ''
  })

  // 设置文件列表
  videoFileList.value = row.videoUrl ? [{ name: '视频文件', url: row.videoUrl }] : []
  fileFileList.value = row.fileUrl ? [{ name: '附件文件', url: row.fileUrl }] : []

  editDialogVisible.value = true
}

// 文件上传相关
const beforeVideoUpload = (file) => {
  const isVideo = file.type.startsWith('video/')
  const isLt50M = file.size / 1024 / 1024 < 50

  if (!isVideo) {
    ElMessage.error('只能上传视频文件!')
    return false
  }
  if (!isLt50M) {
    ElMessage.error('视频文件大小不能超过50MB!')
    return false
  }
  return true
}

const beforeFileUpload = (file) => {
  const isLt20M = file.size / 1024 / 1024 < 20
  if (!isLt20M) {
    ElMessage.error('文件大小不能超过20MB!')
    return false
  }
  return true
}

const handleVideoSuccess = (response) => {
  if (response.fileUrl) {
    formData.videoUrl = response.fileUrl
    ElMessage.success('视频上传成功')
  }
}

const handleVideoRemove = () => {
  formData.videoUrl = ''
}

const handleFileSuccess = (response) => {
  if (response.fileUrl) {
    formData.fileUrl = response.fileUrl
    ElMessage.success('文件上传成功')
  }
}

const handleFileRemove = () => {
  formData.fileUrl = ''
}

// 文件预览
const previewFile = (url, type) => {
  previewUrl.value = url
  previewType.value = type
  previewDialogVisible.value = true
}

const submitPolicyRequest = async () => {
  const submitData = {
    title: formData.title,
    content: formData.content,
    tags: formData.tags,
    isDraft: formData.isDraft,
    videoUrl: formData.videoUrl,
    fileUrl: formData.fileUrl
  }

  if (isEdit.value) {
    await request.put(`/policies/${formData.id}`, submitData)
  } else {
    await request.post('/policies', submitData)
  }
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()

    submitting.value = true

    await submitPolicyRequest()
    ElMessage.success(isEdit.value ? '更新成功' : '发布成功')
    editDialogVisible.value = false
    loadData()
  } catch (error) {
    ElMessage.error('提交失败：' + (error.response?.data?.error || error.message))
  } finally {
    submitting.value = false
  }
}

const handleDraftAction = async () => {
  if (!formRef.value) return
  const previousDraft = formData.isDraft
  formData.isDraft = !previousDraft
  const actionText = formData.isDraft ? '隐藏' : '显示'

  try {
    await formRef.value.validate()
    submitting.value = true
    await submitPolicyRequest()
    ElMessage.success(`${actionText}成功`)
    editDialogVisible.value = false
    loadData()
  } catch (error) {
    formData.isDraft = previousDraft
    ElMessage.error(`${actionText}失败：` + (error.response?.data?.error || error.message))
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
    tags: '',
    isDraft: false,
    videoUrl: '',
    fileUrl: ''
  })
  videoFileList.value = []
  fileFileList.value = []
  if (formRef.value) {
    formRef.value.resetFields()
  }
}

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleString('zh-CN')
}

// 页面加载时获取数据
onMounted(() => {
  loadData()
})
</script>

<style scoped>
.policy-management {
  padding: 20px;
}

.table-wrapper {
  width: 100%;
}

:deep(.table-wrapper .el-table__inner-wrapper),
:deep(.policy-table .el-table__inner-wrapper) {
  overflow: visible !important;
}

:deep(.table-wrapper .el-table__body-wrapper),
:deep(.policy-table .el-table__body-wrapper) {
  overflow: visible !important;
  height: auto !important;
  max-height: none !important;
}

:deep(.table-wrapper .el-scrollbar__wrap),
:deep(.policy-table .el-scrollbar__wrap) {
  overflow: visible !important;
  height: auto !important;
  max-height: none !important;
}

:deep(.table-wrapper .el-scrollbar__wrap::-webkit-scrollbar) {
  display: none;
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
  margin: 0;
  padding: 0 20px;
  background: #f8f9fc;
  border-radius: 4px;
}

.toolbar-left {
  display: flex;
  gap: 10px;
  align-items: center;
}

.toolbar-right {
  display: flex;
  gap: 10px;
  align-items: center;
}


.pagination-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.attachment-preview {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.text-gray {
  color: #909399;
}


.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.video-preview {
  text-align: center;
}

.file-preview {
  padding: 20px 0;
}

.file-link {
  margin-top: 16px;
  word-break: break-all;
}

:deep(.el-table .cell) {
  line-height: 1.8;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.title-button {
  width: 100%;
  justify-content: flex-start;
  white-space: normal;
  line-height: 1.2;
  border: none;
  color: #fff;
  min-height: 28px;
  height: auto;
  padding: 2px 8px;
}

.title-button.is-draft {
  background-color: #909399;
}

.title-button.is-published {
  background-color: #67c23a;
}

.draft-toggle-btn {
  background-color: #909399 !important;
  border-color: #909399 !important;
  color: #fff !important;
}

.draft-toggle-btn.is-hidden {
  background-color: #67c23a !important;
  border-color: #67c23a !important;
  color: #fff !important;
}

.policy-card-wrapper {
  margin-top: 0;
  margin-bottom: 0;
}

.policy-card-wrapper :deep(.el-card__body) {
  line-height: 1.8;
  padding: 0 !important;
}

.policy-card-wrapper :deep(.el-card__body > div) {
  padding: 0 !important;
}

.policy-card-wrapper :deep(.el-card__body > div > div) {
  padding: 0 !important;
}

.policy-card-wrapper :deep(#el-id-3319-2 > form > *) {
  margin: 10px !important;
}

.policy-card-wrapper :deep(.upload-video-item) {
  margin: 0 !important;
}

.policy-card-wrapper :deep(#el-id-3319-2 > form > div:nth-child(5)) {
  margin: 0 !important;
}

.policy-card-wrapper :deep(#el-id-9794-2) {
  padding: 0 !important;
}

.policy-card-wrapper :deep(#el-id-2554-2) {
  padding: 0 !important;
}

.policy-card-wrapper :deep(#el-id-2827-2) {
  padding: 0 !important;
}

.policy-card-wrapper :deep(#el-id-8720-2) {
  padding: 0 !important;
}

.policy-card-wrapper > div > div > div {
  padding: 0 !important;
}

.policy-card-wrapper :deep(.el-table__cell) {
  padding-top: 6px;
  padding-bottom: 6px;
  line-height: 1.2;
}

.policy-card-wrapper :deep(.el-table__body tr) {
  height: auto;
}

.policy-edit-dialog {
  margin-top: 30px !important;
}

.policy-edit-dialog :deep(.el-dialog__body) {
  padding: 0 !important;
}

.policy-edit-dialog :deep(.el-dialog__body > div) {
  padding: 0 !important;
}

.policy-edit-dialog :deep(.el-dialog__body > div > div) {
  padding: 0 !important;
}

.policy-edit-dialog :deep(.el-form-item.asterisk-left) {
  margin: 0 !important;
  margin-bottom: 0 !important;
}

.policy-edit-dialog :deep(.el-dialog__footer) {
  margin-top: 0 !important;
  padding-top: 0 !important;
  border-top: none !important;
}

</style>
