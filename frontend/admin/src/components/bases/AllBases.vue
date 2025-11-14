<template>
  <div class="all-bases">
    <!-- 筛选工具栏 -->
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

        <el-select
          v-model="statusFilter"
          placeholder="审核状态"
          style="width: 150px"
          @change="handleSearch"
          clearable
        >
          <el-option label="全部" value="" />
          <el-option label="待审核" value="false" />
          <el-option label="已通过" value="true" />
        </el-select>

        <el-select
          v-model="activeFilter"
          placeholder="启用状态"
          style="width: 150px"
          @change="handleSearch"
          clearable
        >
          <el-option label="全部" value="" />
          <el-option label="启用" value="true" />
          <el-option label="禁用" value="false" />
        </el-select>

        <el-button @click="loadData">刷新</el-button>
      </div>
      <el-button type="primary" @click="handleAdd">添加基地</el-button>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-cards">
      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-number">{{ stats.total }}</div>
          <div class="stat-label">总基地数</div>
        </div>
        <el-icon class="stat-icon"><School /></el-icon>
      </el-card>
      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-number">{{ stats.pending }}</div>
          <div class="stat-label">待审核</div>
        </div>
        <el-icon class="stat-icon pending"><Clock /></el-icon>
      </el-card>
      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-number">{{ stats.approved }}</div>
          <div class="stat-label">已通过</div>
        </div>
        <el-icon class="stat-icon approved"><Check /></el-icon>
      </el-card>
      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-number">{{ stats.active }}</div>
          <div class="stat-label">已启用</div>
        </div>
        <el-icon class="stat-icon active"><CircleCheck /></el-icon>
      </el-card>
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
      <el-table-column label="基地管理员" width="120">
        <template #default="{ row }">
          {{ row.manager?.name || '未设置' }}
        </template>
      </el-table-column>
      <el-table-column label="审核状态" width="100">
        <template #default="{ row }">
          <el-tag v-if="!row.isApproved" type="warning">待审核</el-tag>
          <el-tag v-else-if="row.rejectReason" type="danger">已拒绝</el-tag>
          <el-tag v-else type="success">已通过</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="启用状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.isActive ? 'success' : 'danger'">
            {{ row.isActive ? '启用' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="180">
        <template #default="{ row }">
          {{ formatDate(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="350" fixed="right">
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
            >
              编辑
            </el-button>

            <!-- 待审核状态的操作 -->
            <template v-if="!row.isApproved">
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

            <!-- 已通过状态的操作 -->
            <template v-else>
              <el-dropdown @command="(command) => handleDropdownCommand(command, row)">
                <el-button type="warning" size="small">
                  更多<el-icon><ArrowDown /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="manager">设置管理员</el-dropdown-item>
                    <el-dropdown-item :command="row.isActive ? 'disable' : 'enable'">
                      {{ row.isActive ? '禁用' : '启用' }}
                    </el-dropdown-item>
                    <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
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

    <!-- 批量操作 -->
    <div class="batch-actions" v-if="selectedBases.length > 0">
      <el-button type="success" @click="handleBatchApprove">批量通过</el-button>
      <el-button type="danger" @click="handleBatchReject">批量拒绝</el-button>
      <span class="selected-count">已选择 {{ selectedBases.length }} 项</span>
    </div>

    <!-- 复用其他组件的对话框 -->
    <!-- 详情对话框、编辑表单、设置管理员等 -->
    <!-- 这里可以复用ApprovedBases.vue中的对话框代码 -->
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, ArrowDown, School, Clock, Check, CircleCheck } from '@element-plus/icons-vue'
import request from '@/api/request'

const emit = defineEmits(['refresh'])

// 响应式数据
const loading = ref(false)
const bases = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
const searchQuery = ref('')
const statusFilter = ref('')
const activeFilter = ref('')
const selectedBases = ref([])

// 统计数据
const stats = reactive({
  total: 0,
  pending: 0,
  approved: 0,
  active: 0
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
      ...(searchQuery.value && { search: searchQuery.value }),
      ...(statusFilter.value !== '' && { isApproved: statusFilter.value === 'true' }),
      ...(activeFilter.value !== '' && { isActive: activeFilter.value === 'true' })
    }

    const response = await request.get('/bases', { params })
    bases.value = response.data.data || []
    total.value = response.data.pagination?.total || 0

    // 计算统计数据
    calculateStats()
  } catch (error) {
    ElMessage.error('加载数据失败：' + (error.response?.data?.error || error.message))
  } finally {
    loading.value = false
  }
}

// 计算统计数据
const calculateStats = async () => {
  try {
    // 获取总数
    const totalResponse = await request.get('/bases', { params: { limit: 1 } })
    stats.total = totalResponse.pagination?.total || 0

    // 获取待审核数
    const pendingResponse = await request.get('/bases', {
      params: { isApproved: false, limit: 1 }
    })
    stats.pending = pendingResponse.pagination?.total || 0

    // 获取已通过数
    const approvedResponse = await request.get('/bases', {
      params: { isApproved: true, limit: 1 }
    })
    stats.approved = approvedResponse.pagination?.total || 0

    // 获取已启用数
    const activeResponse = await request.get('/bases', {
      params: { isActive: true, limit: 1 }
    })
    stats.active = activeResponse.pagination?.total || 0
  } catch (error) {
    console.error('获取统计数据失败:', error)
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
  // 实现查看详情逻辑
  ElMessage.info('查看详情功能待实现')
}

// 编辑基地
const handleEdit = (base) => {
  // 实现编辑逻辑
  ElMessage.info('编辑功能待实现')
}

// 添加基地
const handleAdd = () => {
  // 实现添加逻辑
  ElMessage.info('添加功能待实现')
}

// 审核相关
const handleApprove = async (base, approved = true) => {
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
    loadData()
    emit('refresh')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('操作失败：' + (error.response?.data?.error || error.message))
    }
  }
}

const handleReject = (base) => {
  // 实现拒绝逻辑
  ElMessage.info('拒绝功能待实现')
}

// 下拉菜单命令处理
const handleDropdownCommand = (command, base) => {
  switch (command) {
    case 'manager':
      ElMessage.info('设置管理员功能待实现')
      break
    case 'enable':
    case 'disable':
      ElMessage.info('状态切换功能待实现')
      break
    case 'delete':
      ElMessage.info('删除功能待实现')
      break
  }
}

// 批量操作
const handleBatchApprove = async () => {
  const pendingBases = selectedBases.value.filter(base => !base.isApproved)
  if (pendingBases.length === 0) {
    ElMessage.warning('选中的基地中没有待审核的项目')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确认通过选中的 ${pendingBases.length} 个基地申请吗？`,
      '批量审核',
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: 'success'
      }
    )

    const promises = pendingBases.map(base =>
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

const handleBatchReject = () => {
  const pendingBases = selectedBases.value.filter(base => !base.isApproved)
  if (pendingBases.length === 0) {
    ElMessage.warning('选中的基地中没有待审核的项目')
    return
  }

  ElMessage.info('批量拒绝功能待实现')
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.all-bases {
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

.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.stat-card {
  display: flex;
  align-items: center;
  padding: 20px;
}

.stat-content {
  flex: 1;
}

.stat-number {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
  margin-bottom: 5px;
}

.stat-label {
  font-size: 14px;
  color: #909399;
}

.stat-icon {
  font-size: 40px;
  color: #409EFF;
  margin-left: 20px;
}

.stat-icon.pending {
  color: #E6A23C;
}

.stat-icon.approved {
  color: #67C23A;
}

.stat-icon.active {
  color: #409EFF;
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

.action-buttons .el-button,
.action-buttons .el-dropdown {
  margin: 0;
  flex-shrink: 0;
}
</style>