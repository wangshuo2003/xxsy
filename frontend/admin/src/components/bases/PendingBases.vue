<template>
  <div class="pending-bases">
    <!-- 工具栏 -->
    <div class="toolbar">
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

    <!-- 数据表格 -->
    <el-table
      :data="bases"
      v-loading="loading"
      style="width: 100%"
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="55" />
      <el-table-column prop="name" label="基地名称" min-width="150" />
      <el-table-column prop="type" label="基地类型" width="120" />
      <el-table-column prop="address" label="地址" min-width="200" show-overflow-tooltip />
      <el-table-column prop="contact" label="联系方式" width="150" />
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
            <!-- 超级管理员和基地管理员都能看到审核按钮 -->
            <template v-if="userStore.user?.role === 'SUPER_ADMIN' || userStore.user?.role === 'ADMIN'">
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
            </template>
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

    <!-- 批量操作 - 管理员可见 -->
    <div class="batch-actions" v-if="selectedBases.length > 0 && ['SUPER_ADMIN', 'ADMIN'].includes(userStore.user?.role)">
      <el-button type="success" @click="handleBatchApprove">批量通过</el-button>
      <el-button type="danger" @click="handleBatchReject">批量拒绝</el-button>
      <span class="selected-count">已选择 {{ selectedBases.length }} 项</span>
    </div>

    <!-- 查看详情对话框 -->
    <el-dialog
      v-model="detailVisible"
      title="基地详情"
      width="600px"
    >
      <div v-if="currentBase">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="基地名称">{{ currentBase.name }}</el-descriptions-item>
          <el-descriptions-item label="基地类型">{{ currentBase.type }}</el-descriptions-item>
          <el-descriptions-item label="地址" :span="2">{{ currentBase.address }}</el-descriptions-item>
          <el-descriptions-item label="联系方式">{{ currentBase.contact }}</el-descriptions-item>
          <el-descriptions-item label="申请时间">{{ formatDate(currentBase.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="描述" :span="2">
            {{ currentBase.description || '暂无描述' }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <!-- 超级管理员和基地管理员都能看到审核按钮 -->
        <template v-if="userStore.user?.role === 'SUPER_ADMIN' || userStore.user?.role === 'ADMIN'">
          <el-button
            type="success"
            @click="handleApprove(currentBase, true)"
          >
            通过审核
          </el-button>
          <el-button
            type="danger"
            @click="handleReject(currentBase)"
          >
            拒绝审核
          </el-button>
        </template>
        <template v-else>
          <el-button type="info" disabled>无权限操作</el-button>
        </template>
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
import { useUserStore } from '@/stores/user'

const emit = defineEmits(['refresh'])
const userStore = useUserStore()

// 响应式数据
const loading = ref(false)
const bases = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
const searchQuery = ref('')
const selectedBases = ref([])

// 对话框相关
const detailVisible = ref(false)
const currentBase = ref(null)
const rejectVisible = ref(false)
const rejectLoading = ref(false)
const rejectForm = reactive({
  baseId: null,
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

    let response
    if (['SUPER_ADMIN', 'ADMIN'].includes(userStore.user?.role)) {
      // 任何管理员都可以看到所有待审核的基地
      console.log('PendingBases 管理员加载数据，参数:', params)
      response = await request.get('/bases', { params })
    } else {
      // 其他角色看不到数据
      console.log('PendingBases 其他角色无权限查看数据')
      bases.value = []
      total.value = 0
      return
    }

    console.log('PendingBases 完整API响应:', response)
    console.log('PendingBases 响应类型:', typeof response)
    console.log('PendingBases 响应结构:', {
      hasData: !!response.data,
      dataType: Array.isArray(response.data) ? `数组[${response.data.length}]` : typeof response.data,
      hasPagination: !!response.data?.pagination,
      dataLength: response.data?.data?.length || response.data?.length || 0,
      total: response.data?.pagination?.total || 0
    })

    bases.value = response.data?.data || response.data || []
    total.value = response.data?.pagination?.total || 0

    console.log('PendingBases 数据处理后:', {
      basesCount: bases.value.length,
      totalCount: total.value,
      basesSample: bases.value.slice(0, 2)
    })
  } catch (error) {
    console.error('PendingBases 加载数据失败:', error)
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
  selectedBases.value = selection
}

// 查看详情
const handleView = (base) => {
  currentBase.value = base
  detailVisible.value = true
}

// 审核通过 - 超级管理员和基地管理员可用
const handleApprove = async (base, approved = true) => {
  if (!['SUPER_ADMIN', 'ADMIN'].includes(userStore.user?.role)) {
    ElMessage.warning('权限不足，只有管理员可以审核基地')
    return
  }

  // 任何管理员都可以审核所有基地

  try {
    await ElMessageBox.confirm(
      approved ? '确认通过这个基地的申请吗？' : '确认拒绝这个基地的申请吗？',
      '确认操作',
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: approved ? 'success' : 'warning'
      }
    )

    await request.put(`/bases/${base.id}/approve`, {
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

// 拒绝审核 - 超级管理员和基地管理员可用
const handleReject = (base) => {
  if (!['SUPER_ADMIN', 'ADMIN'].includes(userStore.user?.role)) {
    ElMessage.warning('权限不足，只有管理员可以审核基地')
    return
  }

  // 任何管理员都可以审核所有基地

  currentBase.value = base
  rejectForm.baseId = base.id
  rejectForm.rejectReason = ''
  rejectVisible.value = true
}

// 确认拒绝 - 超级管理员和基地管理员可用
const confirmReject = async () => {
  if (!rejectForm.rejectReason.trim()) {
    ElMessage.warning('请输入拒绝原因')
    return
  }

  if (!['SUPER_ADMIN', 'ADMIN'].includes(userStore.user?.role)) {
    ElMessage.warning('权限不足，只有管理员可以审核基地')
    return
  }

  rejectLoading.value = true
  try {
    await request.put(`/bases/${rejectForm.baseId}/approve`, {
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

// 批量通过 - 管理员可用
const handleBatchApprove = async () => {
  if (!['SUPER_ADMIN', 'ADMIN'].includes(userStore.user?.role)) {
    ElMessage.warning('权限不足，只有管理员可以审核基地')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确认通过选中的 ${selectedBases.value.length} 个基地申请吗？`,
      '批量审核',
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: 'success'
      }
    )

    const promises = selectedBases.value.map(base =>
      request.put(`/bases/${base.id}/approve`, { approved: true })
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

// 批量拒绝 - 管理员可用
const handleBatchReject = async () => {
  if (!['SUPER_ADMIN', 'ADMIN'].includes(userStore.user?.role)) {
    ElMessage.warning('权限不足，只有管理员可以审核基地')
    return
  }

  try {
    const { value: rejectReason } = await ElMessageBox.prompt(
      `请输入拒绝原因（将应用到选中的 ${selectedBases.value.length} 个基地）：`,
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

    const promises = selectedBases.value.map(base =>
      request.put(`/bases/${base.id}/approve`, {
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
.pending-bases {
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