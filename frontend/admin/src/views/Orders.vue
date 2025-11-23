<template>
  <div class="orders-page">
    <div class="page-header">
      <h1>退款审核</h1>
      <p>活动管理员和超级管理员可以在此审核用户的退款申请。</p>
    </div>

    <div class="content-card">
      <div class="filters">
        <el-select v-model="filters.status" placeholder="请选择状态" @change="handleStatusChange" size="large">
          <el-option label="待审核" value="PENDING" />
          <el-option label="已同意" value="APPROVED" />
          <el-option label="已拒绝" value="REJECTED" />
          <el-option label="全部" value="ALL" />
        </el-select>
      </div>

      <el-table :data="refunds" v-loading="loading" border>
        <el-table-column label="订单信息" min-width="120" show-overflow-tooltip>
          <template #default="scope">
            <div class="order-info">
              <div class="order-title">{{ scope.row.order?.orderNo }}</div>
              <div class="order-subtitle">
                {{ scope.row.order?.activity?.name || scope.row.order?.service?.title || '未知订单' }}
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="用户" min-width="90" show-overflow-tooltip>
          <template #default="scope">
            <div class="user-info">
              <div>{{ scope.row.order?.user?.name || '用户' }}</div>
              <div class="user-sub">{{ scope.row.order?.user?.phone }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="amount" label="金额" width="90">
          <template #default="scope">
            ¥{{ scope.row.amount.toFixed(2) }}
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="退款原因" min-width="100" show-overflow-tooltip />
        <el-table-column label="状态" width="90">
          <template #default="scope">
            <el-tag :type="statusTagType(scope.row.status)">
              {{ formatStatus(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="申请时间" width="150">
          <template #default="scope">
            {{ formatDate(scope.row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="处理信息" min-width="120" show-overflow-tooltip>
          <template #default="scope">
            <div v-if="scope.row.status !== 'PENDING'">
              <div>{{ scope.row.decisionNote || '无备注' }}</div>
              <div class="user-sub">
                {{ scope.row.processedBy ? '管理员 ID: ' + scope.row.processedBy : '' }}
                <span v-if="scope.row.processedAt"> · {{ formatDate(scope.row.processedAt) }}</span>
              </div>
            </div>
            <span v-else>--</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150">
          <template #default="scope">
            <el-button
              type="success"
              size="small"
              :disabled="scope.row.status !== 'PENDING'"
              @click="handleApprove(scope.row)"
            >
              同意
            </el-button>
            <el-button
              type="danger"
              size="small"
              :disabled="scope.row.status !== 'PENDING'"
              @click="openRejectDialog(scope.row)"
            >
              拒绝
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination" v-if="pagination.total > 0">
        <el-pagination
          layout="total, prev, pager, next"
          :page-size="pagination.limit"
          :current-page="pagination.page"
          :total="pagination.total"
          @current-change="handlePageChange"
        />
      </div>
    </div>

    <el-dialog v-model="rejectDialogVisible" title="拒绝退款" width="400px">
      <el-form :model="rejectForm">
        <el-form-item label="理由">
          <el-input
            v-model="rejectForm.note"
            type="textarea"
            :rows="4"
            maxlength="200"
            show-word-limit
            placeholder="请输入拒绝理由"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitReject" :loading="rejectLoading">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@/api/request'

const loading = ref(false)
const refunds = ref([])
const filters = reactive({ status: 'PENDING' })
const pagination = reactive({ page: 1, limit: 10, total: 0 })
const rejectDialogVisible = ref(false)
const rejectForm = reactive({ id: null, note: '' })
const rejectLoading = ref(false)

const formatStatus = (status) => {
  const map = {
    'PENDING': '待审核',
    'APPROVED': '已同意',
    'REJECTED': '已拒绝'
  }
  return map[status] || status
}

const statusTagType = (status) => {
  const map = {
    'PENDING': 'warning',
    'APPROVED': 'success',
    'REJECTED': 'danger'
  }
  return map[status] || 'info'
}

const formatDate = (date) => {
  if (!date) return '--'
  return new Date(date).toLocaleString()
}

const fetchRefunds = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      limit: pagination.limit,
      status: filters.status
    }

    const response = await request.get('/refunds', { params })
    refunds.value = response.data || []
    const pg = response.pagination || {}
    pagination.total = pg.total || 0
    pagination.limit = pg.limit || 10
    pagination.page = pg.page || 1
  } catch (error) {
    console.error('获取退款申请失败:', error)
    ElMessage.error(error.response?.data?.error || '加载失败')
  } finally {
    loading.value = false
  }
}

const handlePageChange = (page) => {
  pagination.page = page
  fetchRefunds()
}

const handleStatusChange = () => {
  pagination.page = 1
  fetchRefunds()
}

const handleApprove = async (row) => {
  try {
    await ElMessageBox.confirm('确定同意该退款申请吗？', '提示', {
      type: 'warning'
    })
    await request.put(`/refunds/${row.id}/decision`, { action: 'APPROVED' })
    ElMessage.success('已同意退款')
    fetchRefunds()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('同意退款失败:', error)
      ElMessage.error(error.response?.data?.error || '操作失败')
    }
  }
}

const openRejectDialog = (row) => {
  rejectForm.id = row.id
  rejectForm.note = ''
  rejectDialogVisible.value = true
}

const submitReject = async () => {
  if (!rejectForm.note.trim()) {
    ElMessage.error('请输入拒绝原因')
    return
  }
  rejectLoading.value = true
  try {
    await request.put(`/refunds/${rejectForm.id}/decision`, {
      action: 'REJECTED',
      note: rejectForm.note
    })
    ElMessage.success('已拒绝该退款申请')
    rejectDialogVisible.value = false
    fetchRefunds()
  } catch (error) {
    console.error('拒绝退款失败:', error)
    ElMessage.error(error.response?.data?.error || '操作失败')
  } finally {
    rejectLoading.value = false
  }
}

onMounted(() => {
  fetchRefunds()
})
</script>

<style scoped>
.orders-page {
  display: grid;
  gap: 16px;
}

.filters {
  margin-bottom: 16px;
}

.order-info .order-title {
  font-weight: 600;
}

.order-info .order-subtitle,
.user-sub {
  font-size: 12px;
  color: #909399;
}

.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
