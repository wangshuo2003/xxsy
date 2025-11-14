<template>
  <div class="pending-activities">
    <!-- 工具栏 -->
    <div class="toolbar">
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
      <el-button @click="loadData">刷新</el-button>
    </div>

    <!-- 数据表格 -->
    <el-table
      :data="activities"
      v-loading="loading"
      style="width: 100%"
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="55" />
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
      <el-table-column prop="createdAt" label="申请时间" width="180">
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
              查看详情
            </el-button>
            <el-button
              type="success"
              size="small"
              @click="handleApprove(row, true)"
            >
              通过
            </el-button>
            <el-button
              type="danger"
              size="small"
              @click="handleReject(row)"
            >
              拒绝
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

    <!-- 批量操作 -->
    <div class="batch-actions" v-if="selectedActivities.length > 0">
      <el-button type="success" @click="handleBatchApprove">批量通过</el-button>
      <el-button type="danger" @click="handleBatchReject">批量拒绝</el-button>
      <span class="selected-count">已选择 {{ selectedActivities.length }} 项</span>
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
          <el-descriptions-item label="申请时间">
            {{ formatDate(currentActivity.createdAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="描述" :span="2">
            {{ currentActivity.description || '暂无描述' }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button
          type="success"
          @click="handleApprove(currentActivity, true)"
        >
          通过审核
        </el-button>
        <el-button
          type="danger"
          @click="handleReject(currentActivity)"
        >
          拒绝审核
        </el-button>
      </template>
    </el-dialog>

    <!-- 拒绝原因对话框 -->
    <el-dialog
      v-model="rejectVisible"
      title="拒绝原因"
      width="500px"
    >
      <el-form :model="rejectForm" label-width="80px">
        <el-form-item label="拒绝原因">
          <el-input
            v-model="rejectForm.rejectReason"
            type="textarea"
            :rows="4"
            placeholder="请输入拒绝原因"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectVisible = false">取消</el-button>
        <el-button
          type="danger"
          @click="confirmReject"
          :loading="rejectLoading"
        >
          确认拒绝
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import request from '@/api/request'

const emit = defineEmits(['refresh'])

// 响应式数据
const loading = ref(false)
const activities = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
const searchQuery = ref('')
const selectedActivities = ref([])

// 对话框相关
const detailVisible = ref(false)
const currentActivity = ref(null)
const rejectVisible = ref(false)
const rejectLoading = ref(false)
const rejectForm = reactive({
  activityId: null,
  rejectReason: ''
})

// 格式化日期
const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN')
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      limit: pageSize.value,
      isApproved: false,
      ...(searchQuery.value && { search: searchQuery.value })
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

// 搜索处理
const handleSearch = () => {
  currentPage.value = 1
  loadData()
}

// 选择变化处理
const handleSelectionChange = (selection) => {
  selectedActivities.value = selection
}

// 查看详情
const handleView = (activity) => {
  currentActivity.value = activity
  detailVisible.value = true
}

// 审核通过
const handleApprove = async (activity, approved = true) => {
  try {
    await ElMessageBox.confirm(
      approved ? '确认通过这个活动的申请吗？' : '确认拒绝这个活动的申请吗？',
      '确认操作',
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: approved ? 'success' : 'warning'
      }
    )

    await request.put(`/activities/${activity.id}/approve`, {
      approved,
      rejectReason: approved ? null : '审核不通过'
    })

    ElMessage.success(approved ? '审核通过成功' : '审核拒绝成功')
    detailVisible.value = false
    loadData()
    emit('refresh')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('操作失败：' + (error.response?.data?.error || error.message))
    }
  }
}

// 拒绝审核
const handleReject = (activity) => {
  currentActivity.value = activity
  rejectForm.activityId = activity.id
  rejectForm.rejectReason = ''
  rejectVisible.value = true
}

// 确认拒绝
const confirmReject = async () => {
  if (!rejectForm.rejectReason.trim()) {
    ElMessage.warning('请输入拒绝原因')
    return
  }

  rejectLoading.value = true
  try {
    await request.put(`/activities/${rejectForm.activityId}/approve`, {
      approved: false,
      rejectReason: rejectForm.rejectReason
    })

    ElMessage.success('审核拒绝成功')
    rejectVisible.value = false
    detailVisible.value = false
    loadData()
    emit('refresh')
  } catch (error) {
    ElMessage.error('操作失败：' + (error.response?.data?.error || error.message))
  } finally {
    rejectLoading.value = false
  }
}

// 批量通过
const handleBatchApprove = async () => {
  try {
    await ElMessageBox.confirm(
      `确认通过选中的 ${selectedActivities.value.length} 个活动申请吗？`,
      '批量审核',
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: 'success'
      }
    )

    const promises = selectedActivities.value.map(activity =>
      request.put(`/activities/${activity.id}/approve`, { approved: true })
    )

    await Promise.all(promises)
    ElMessage.success('批量审核通过成功')
    loadData()
    emit('refresh')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('批量操作失败：' + (error.response?.data?.error || error.message))
    }
  }
}

// 批量拒绝
const handleBatchReject = async () => {
  try {
    const { value: rejectReason } = await ElMessageBox.prompt(
      `请输入拒绝原因（将应用到选中的 ${selectedActivities.value.length} 个活动）：`,
      '批量拒绝',
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        inputType: 'textarea',
        inputValidator: (value) => {
          if (!value || !value.trim()) {
            return '请输入拒绝原因'
          }
          return true
        }
      }
    )

    const promises = selectedActivities.value.map(activity =>
      request.put(`/activities/${activity.id}/approve`, {
        approved: false,
        rejectReason
      })
    )

    await Promise.all(promises)
    ElMessage.success('批量审核拒绝成功')
    loadData()
    emit('refresh')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('批量操作失败：' + (error.response?.data?.error || error.message))
    }
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.pending-activities {
  width: 100%;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.pagination {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.batch-actions {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: white;
  padding: 10px 20px;
  border-radius: 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 1000;
}

.selected-count {
  color: #666;
  font-size: 14px;
}

.action-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: nowrap;
  align-items: center;
}

.action-buttons .el-button {
  margin: 0;
  flex-shrink: 0;
}
</style>