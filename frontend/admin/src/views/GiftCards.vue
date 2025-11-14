<template>
  <div class="gift-cards-container">
    <el-card class="gift-card">

      <!-- 搜索和筛选 -->
      <div class="filters">
        <el-row :gutter="20">
          <el-col :span="8">
            <el-input
              v-model="searchParams.cardCode"
              placeholder="输入礼品卡码搜索"
              clearable
              @input="handleSearch"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
          </el-col>
          <el-col :span="6">
            <el-select
              v-model="searchParams.status"
              placeholder="筛选状态"
              clearable
              @change="handleSearch"
            >
              <el-option label="全部" value="" />
              <el-option label="未使用" value="unused" />
              <el-option label="已使用" value="used" />
            </el-select>
          </el-col>
          <el-col :span="10">
            <div class="filter-actions">
              <el-button type="primary" @click="loadGiftCards">
                <el-icon><Refresh /></el-icon>
                刷新
              </el-button>
              <el-button @click="exportGiftCards">
                <el-icon><Download /></el-icon>
                导出
              </el-button>
              <el-button type="primary" @click="showCreateDialog = true">
                <el-icon><Plus /></el-icon>
                创建礼品卡
              </el-button>
            </div>
          </el-col>
        </el-row>
      </div>

      <!-- 礼品卡列表 -->
      <div class="table-wrapper">
        <div class="table-scroll">
          <el-table
            :data="giftCards"
            v-loading="loading"
            stripe
            border
          >
            <el-table-column prop="cardCode" label="礼品卡码" min-width="180">
              <template #default="{ row }">
                <el-button
                  class="card-code-btn"
                  :class="{ 'card-code-btn--disabled': row.isActive === false }"
                  @click="openEditPanel(row)"
                >
                  {{ row.cardCode }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column label="次数" min-width="200">
              <template #default="{ row }">
                <el-button
                  class="times-btn"
                  :class="{
                    'times-btn--danger': Math.max((row.totalUses ?? 0) - (row.usedCount ?? 0), 0) === 0,
                    'times-btn--success': Math.max((row.totalUses ?? 0) - (row.usedCount ?? 0), 0) > 0
                  }"
                  @click.stop="handleTimesButtonClick(row)"
                >
                  可用 {{ Math.max((row.totalUses ?? 0) - (row.usedCount ?? 0), 0) }}
                  / 已用 {{ row.usedCount ?? 0 }}
                  / 总计 {{ row.totalUses ?? 0 }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="amount" label="金额" width="100">
              <template #default="{ row }">
                <span style="color: #67c23a; font-weight: bold;">¥{{ row.amount }}</span>
              </template>
            </el-table-column>
            <el-table-column label="使用用户" width="150">
              <template #default="{ row }">
                <el-button
                  class="user-usage-btn"
                  type="info"
                  plain
                  size="small"
                  :disabled="!Number(row.usedCount ?? 0)"
                  @click.stop="openUsagePanel(row)"
                >
                  <template v-if="row.user">
                    {{ row.user.name || row.user.username }}
                  </template>
                  <template v-else-if="Number(row.usedCount ?? 0)">
                    查看记录
                  </template>
                  <template v-else>
                    暂无使用
                  </template>
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="expiresAt" label="有效期" width="200">
              <template #default="{ row }">
                <span v-if="row.expiresAt">{{ formatDateTime(row.expiresAt) }}</span>
                <span v-else style="color: #999;">-</span>
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="创建时间" width="200">
              <template #default="{ row }">
                {{ formatDateTime(row.createdAt) }}
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>

      <!-- 分页 -->
      <div class="pagination">
        <div class="pagination-control">
          <el-pagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.limit"
            :page-sizes="[10, 20, 50, 100]"
            :total="pagination.total"
            layout="total, sizes, prev, pager, next"
            @size-change="loadGiftCards"
            @current-change="loadGiftCards"
          />
          <span class="el-pagination__jump is-last">
            <el-input-number
              v-model="gotoPage"
              :min="1"
              :max="maxPage"
              :step="1"
              size="small"
              controls-position="right"
              @keyup.enter.native="handleGotoPage"
            />
            <span
              class="el-pagination__goto pagination-goto-btn"
              @click="handleGotoPage"
            >
              跳转
            </span>
          </span>
        </div>
      </div>
    </el-card>

    <!-- 创建礼品卡对话框 -->
    <el-dialog
      v-model="showCreateDialog"
      title="创建礼品卡"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="createFormRef"
        :model="createForm"
        :rules="createRules"
        label-width="100px"
      >
        <el-form-item label="充值金额" prop="amount">
          <el-input-number
            v-model="createForm.amount"
            :min="0.01"
            :max="10000"
            :precision="2"
            :step="1"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="生成数量" prop="quantity">
          <el-input-number
            v-model="createForm.quantity"
            :min="1"
            :max="100"
            :step="1"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleCreate" :loading="creating">
          创建
        </el-button>
      </template>
    </el-dialog>

    <!-- 编辑礼品卡对话框 -->
    <el-dialog
      v-model="showEditDialog"
      title="编辑礼品卡"
      width="520px"
      :close-on-click-modal="true"
    >
      <el-form
        ref="editFormRef"
        :model="editForm"
        :rules="editRules"
        label-width="100px"
      >
        <el-form-item label="礼品卡码" prop="cardCode">
          <el-input v-model="editForm.cardCode" />
        </el-form-item>
        <el-form-item label="充值金额" prop="amount">
          <el-input-number
            v-model="editForm.amount"
            :min="0.01"
            :max="10000"
            :precision="2"
            :step="1"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="有效期">
          <el-date-picker
            v-model="editForm.expiresAt"
            type="datetime"
            placeholder="选择有效期（可选）"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="总可用次数" prop="totalUses">
          <el-input-number
            v-model="editForm.totalUses"
            :min="1"
            :max="100"
            :step="1"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="使用情况">
          <span class="times-summary">
            已使用：{{ editForm.usedCount }} 次
            ，剩余：{{ remainingUses }} 次
          </span>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="edit-dialog-footer">
          <el-button @click="showEditDialog = false">取消</el-button>
          <el-popconfirm
            title="确定要删除这张礼品卡吗？"
            confirm-button-text="删除"
            cancel-button-text="取消"
            @confirm="currentGiftCard && handleDelete(currentGiftCard)"
          >
            <template #reference>
              <el-button type="danger" plain>删除礼品卡</el-button>
            </template>
          </el-popconfirm>
          <el-button
            :type="editForm.isActive ? 'warning' : 'danger'"
            :class="editForm.isActive ? 'toggle-btn-disable' : 'toggle-btn-enable'"
            :loading="toggleStatusLoading"
            @click="handleToggleActive"
          >
            {{ editForm.isActive ? '禁用' : '启用' }}
          </el-button>
          <el-button type="primary" @click="handleUpdate" :loading="updating">
            保存
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 详情对话框 -->
    <el-dialog
      v-model="showDetailsDialog"
      title="礼品卡详情"
      width="600px"
    >
      <el-descriptions :column="2" border>
        <el-descriptions-item label="礼品卡码">
          {{ selectedGiftCard?.cardCode }}
        </el-descriptions-item>
        <el-descriptions-item label="金额">
          <span style="color: #67c23a; font-weight: bold;">¥{{ selectedGiftCard?.amount }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="selectedGiftCard?.isUsed ? 'danger' : 'success'">
            {{ selectedGiftCard?.isUsed ? '已使用' : '未使用' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">
          {{ formatDateTime(selectedGiftCard?.createdAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="使用用户" v-if="selectedGiftCard?.user">
          {{ selectedGiftCard.user.name || selectedGiftCard.user.username }}
        </el-descriptions-item>
        <el-descriptions-item label="使用时间" v-if="selectedGiftCard?.usedAt">
          {{ formatDateTime(selectedGiftCard.usedAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="用户电话" v-if="selectedGiftCard?.user">
          {{ selectedGiftCard.user.phone }}
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>
    <el-dialog
      v-model="showUsageDialog"
      :title="usageDialogTitle"
      width="1000px"
    >
      <el-table
        :data="usageRecords"
        border
        height="300"
        v-loading="usageLoading"
      >
        <el-table-column prop="name" label="姓名" min-width="120" />
        <el-table-column prop="username" label="用户名" min-width="120" />
        <el-table-column prop="school" label="学校" min-width="140" />
        <el-table-column prop="grade" label="年级" min-width="120" />
        <el-table-column prop="className" label="班级" min-width="120" />
        <el-table-column label="使用时间" min-width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.usedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="金额" min-width="100">
          <template #default="{ row }">
            ¥{{ row.amount?.toFixed?.(2) ?? (row.amount ?? '-') }}
          </template>
        </el-table-column>
      </el-table>
      <div v-if="!usageLoading && usageRecords.length === 0" class="usage-empty-tip">
        暂无使用记录
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Refresh, Download } from '@element-plus/icons-vue'
import request from '@/api/request'

// 数据状态
const loading = ref(false)
const creating = ref(false)
const updating = ref(false)
const toggleStatusLoading = ref(false)
const giftCards = ref([])
const selectedGiftCard = ref(null)

// 统计信息
const statistics = reactive({
  total: 0,
  used: 0,
  unused: 0,
  totalAmount: 0
})

// 分页
const pagination = reactive({
  page: 1,
  limit: 10,
  total: 0
})
const gotoPage = ref(1)
const maxPage = computed(() => {
  if (!pagination.total || !pagination.limit) return 1
  return Math.max(1, Math.ceil(pagination.total / pagination.limit))
})

// 搜索参数
const searchParams = reactive({
  cardCode: '',
  status: ''
})

// 对话框状态
const showCreateDialog = ref(false)
const showEditDialog = ref(false)
const showDetailsDialog = ref(false)
const showUsageDialog = ref(false)
const usageDialogTitle = ref('礼品卡使用记录')
const usageRecords = ref([])
const usageLoading = ref(false)

// 表单数据
const createForm = reactive({
  amount: 100,
  quantity: 1
})

const editForm = reactive({
  id: null,
  cardCode: '',
  amount: 0,
  expiresAt: null,
  isActive: true,
  totalUses: 1,
  usedCount: 0
})
const currentGiftCard = ref(null)
const remainingUses = computed(() => {
  const total = Number(editForm.totalUses || 0)
  const used = Number(editForm.usedCount || 0)
  return Math.max(total - used, 0)
})

// 表单验证规则
const createRules = {
  amount: [
    { required: true, message: '请输入充值金额', trigger: 'blur' },
    { type: 'number', min: 0.01, max: 10000, message: '金额必须在0.01-10000元之间', trigger: 'blur' }
  ],
  quantity: [
    { required: true, message: '请输入生成数量', trigger: 'blur' },
    { type: 'number', min: 1, max: 100, message: '数量必须在1-100之间', trigger: 'blur' }
  ]
}

const editRules = {
  cardCode: [
    { required: true, message: '请输入礼品卡码', trigger: 'blur' }
  ],
  amount: [
    { required: true, message: '请输入充值金额', trigger: 'blur' },
    { type: 'number', min: 0.01, max: 10000, message: '金额必须在0.01-10000元之间', trigger: 'blur' }
  ],
  totalUses: [
    { required: true, message: '请输入总可用次数', trigger: 'blur' },
    { type: 'number', min: 1, max: 100, message: '次数必须在1-100之间', trigger: 'blur' }
  ]
}

// 表单引用
const createFormRef = ref()
const editFormRef = ref()

// 加载礼品卡列表
const loadGiftCards = async () => {
  try {
    loading.value = true
    const params = {
      page: pagination.page,
      limit: pagination.limit,
      ...searchParams
    }

    const response = await request.get('/gift-cards', { params })
    giftCards.value = response.data
    pagination.total = response.pagination.total
    gotoPage.value = pagination.page
  } catch (error) {
    console.error('加载礼品卡列表失败:', error)
    ElMessage.error('加载礼品卡列表失败')
  } finally {
    loading.value = false
  }
}

// 加载统计信息
const loadStatistics = async () => {
  try {
    const response = await request.get('/gift-cards/statistics')
    Object.assign(statistics, response)
  } catch (error) {
    console.error('加载统计信息失败:', error)
  }
}

// 搜索处理
const handleSearch = () => {
  pagination.page = 1
  loadGiftCards()
}

// 创建礼品卡
const handleCreate = async () => {
  try {
    await createFormRef.value.validate()
    creating.value = true

    const response = await request.post('/gift-cards', createForm)
    ElMessage.success(response.message)
    showCreateDialog.value = false

    // 重置表单
    createForm.amount = 100
    createForm.quantity = 1

    // 刷新数据
    await Promise.all([
      loadGiftCards(),
      loadStatistics()
    ])
  } catch (error) {
    if (error.response?.data?.details) {
      // 表单验证错误
      return
    }
    console.error('创建礼品卡失败:', error)
    ElMessage.error(error.response?.data?.error || '创建礼品卡失败')
  } finally {
    creating.value = false
  }
}

const copyGiftCardCode = async (cardCode) => {
  if (!cardCode) return
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(cardCode)
    } else if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea')
      textarea.value = cardCode
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'absolute'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    ElMessage.success('礼品卡码已复制')
  } catch (error) {
    console.error('复制礼品卡码失败:', error)
    ElMessage.error('复制礼品卡码失败')
  }
}

const handleTimesButtonClick = async (row) => {
  await copyGiftCardCode(row.cardCode)
}

const openUsagePanel = async (row) => {
  if (!row?.cardCode) return
  const cardCode = row.cardCode
  usageDialogTitle.value = `礼品卡 ${cardCode} 使用记录`
  showUsageDialog.value = true
  usageLoading.value = true
  usageRecords.value = []
  try {
    const response = await request.get(`/gift-cards/${encodeURIComponent(cardCode)}/usages`)
    usageRecords.value = response.data || []
  } catch (error) {
    console.error('获取使用记录失败:', error)
    ElMessage.error(error.response?.data?.error || '获取使用记录失败')
  } finally {
    usageLoading.value = false
  }
}

const handleGotoPage = () => {
  const target = Number(gotoPage.value)
  if (!target) {
    ElMessage.warning('请输入要跳转的页码')
    return
  }
  const clamped = Math.min(Math.max(1, target), maxPage.value)
  if (clamped !== pagination.page) {
    pagination.page = clamped
    gotoPage.value = clamped
    loadGiftCards()
  } else {
    gotoPage.value = clamped
  }
}

// 打开编辑面板
const openEditPanel = (row) => {
  currentGiftCard.value = row
  Object.assign(editForm, {
    id: row.id,
    cardCode: row.cardCode,
    amount: row.amount,
    expiresAt: row.expiresAt ? new Date(row.expiresAt) : null,
    isActive: row.isActive ?? true,
    totalUses: row.totalUses ?? 1,
    usedCount: row.usedCount ?? 0
  })
  showEditDialog.value = true
}

// 更新礼品卡
const handleUpdate = async () => {
  try {
    await editFormRef.value.validate()
    updating.value = true
    if (editForm.totalUses < editForm.usedCount) {
      ElMessage.error('总可用次数不能小于已使用次数')
      updating.value = false
      return
    }

    const payload = {
      cardCode: editForm.cardCode,
      amount: editForm.amount,
      expiresAt: editForm.expiresAt ? editForm.expiresAt.toISOString() : null,
      isActive: editForm.isActive,
      totalUses: editForm.totalUses
    }

    const response = await request.put(`/gift-cards/${editForm.id}`, payload)
    ElMessage.success(response.message)
    if (currentGiftCard.value && response.data) {
      Object.assign(currentGiftCard.value, response.data)
    }
    showEditDialog.value = false

    // 刷新数据
    await Promise.all([
      loadGiftCards(),
      loadStatistics()
    ])
  } catch (error) {
    if (error.response?.data?.details) {
      // 表单验证错误
      return
    }
    console.error('更新礼品卡失败:', error)
    ElMessage.error(error.response?.data?.error || '更新礼品卡失败')
  } finally {
    updating.value = false
  }
}

// 删除礼品卡
const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除礼品卡 ${row.cardCode} 吗？此操作不可恢复。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await request.delete(`/gift-cards/${row.id}`)
    ElMessage.success('礼品卡删除成功')
    if (currentGiftCard.value?.id === row.id) {
      showEditDialog.value = false
    }

    // 刷新数据
    await Promise.all([
      loadGiftCards(),
      loadStatistics()
    ])
  } catch (error) {
    if (error === 'cancel') return
    console.error('删除礼品卡失败:', error)
    ElMessage.error(error.response?.data?.error || '删除礼品卡失败')
  }
}

const handleToggleActive = async () => {
  if (!editForm.id) return
  try {
    toggleStatusLoading.value = true
    const nextStatus = !editForm.isActive
    const response = await request.put(`/gift-cards/${editForm.id}`, {
      isActive: nextStatus
    })
    editForm.isActive = response.data?.isActive ?? nextStatus
    if (currentGiftCard.value && currentGiftCard.value.id === editForm.id) {
      currentGiftCard.value.isActive = editForm.isActive
    }
    ElMessage.success(`礼品卡已${editForm.isActive ? '启用' : '禁用'}`)
    await loadGiftCards()
  } catch (error) {
    console.error('更新礼品卡状态失败:', error)
    ElMessage.error(error.response?.data?.error || '更新状态失败')
  } finally {
    toggleStatusLoading.value = false
  }
}

// 查看详情
const handleViewDetails = (row) => {
  selectedGiftCard.value = row
  showDetailsDialog.value = true
}

// 导出礼品卡
const exportGiftCards = () => {
  ElMessage.info('导出功能开发中...')
}

// 格式化日期时间
const formatDateTime = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('zh-CN')
}

// 页面加载时初始化
onMounted(() => {
  Promise.all([
    loadGiftCards(),
    loadStatistics()
  ])
})

watch(
  () => pagination.page,
  (val) => {
    gotoPage.value = val
  }
)
</script>

<style scoped>
.gift-cards-container {
  padding: 20px;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.gift-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  min-height: 0;
}

.gift-card :deep(.el-card__body) {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding-bottom: 0;
}

.table-wrapper {
  flex: 1;
  min-height: 0;
  margin-top: 10px;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.table-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 0;
  width: 100%;
}

.table-scroll :deep(.el-table__inner-wrapper) {
  min-width: 100%;
}

.table-scroll :deep(.el-table) {
  width: 100% !important;
}

.table-scroll :deep(.el-table th .cell) {
  text-align: center;
  justify-content: center;
}

.table-scroll :deep(.el-table td .cell) {
  text-align: center;
  justify-content: center;
}

.table-scroll :deep(.el-table__body-wrapper),
.table-scroll :deep(.el-scrollbar__wrap) {
  width: 100% !important;
  overflow-y: auto;
  margin-bottom: 0 !important;
}

.table-scroll::-webkit-scrollbar {
  width: 6px;
}

.table-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.table-scroll::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h3 {
  margin: 0;
  color: #303133;
}

.card-code-btn {
  background-color: #67c23a;
  border-color: #67c23a;
  color: #fff;
  font-weight: bold;
  user-select: text;
  -webkit-user-select: text;
}

.card-code-btn--disabled {
  background-color: #f56c6c;
  border-color: #f56c6c;
}

.card-code-btn:hover {
  filter: brightness(1.1);
}

.times-summary {
  color: #606266;
  font-size: 13px;
}

.times-btn {
  border: none;
  padding: 2px 12px;
  font-size: 12px;
  font-weight: bold;
  color: #fff;
  user-select: text;
  -webkit-user-select: text;
}

.times-btn--success {
  background-color: #67c23a;
}

.times-btn--danger {
  background-color: #f56c6c;
}

.user-usage-btn {
  font-weight: bold;
  user-select: text;
  -webkit-user-select: text;
}

.filters {
  margin-bottom: 20px;
}

.filter-actions {
  display: flex;
  width: 100%;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
}

.pagination {
  margin-bottom: 10px;
  display: flex;
  justify-content: center;
}

.pagination-control {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.pagination :deep(.el-pagination__jump) {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pagination :deep(.pagination-goto-btn) {
  background-color: #409eff;
  color: #fff;
  padding: 4px 12px;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
}

.pagination :deep(.pagination-goto-btn:hover) {
  filter: brightness(1.1);
}

:deep(.el-statistic__content) {
  color: #409eff;
  font-weight: bold;
}

:deep(.el-descriptions__label) {
  font-weight: bold;
}

.edit-dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  gap: 12px;
}

.edit-dialog-footer :deep(.el-button--warning) {
  background-color: #f56c6c;
  border-color: #f56c6c;
  color: #fff;
}

.edit-dialog-footer :deep(.toggle-btn-enable) {
  background-color: #67c23a !important;
  border-color: #67c23a !important;
  color: #fff !important;
}

.edit-dialog-footer :deep(.toggle-btn-disable) {
  background-color: #f56c6c !important;
  border-color: #f56c6c !important;
  color: #fff !important;
}

.usage-empty-tip {
  text-align: center;
  margin-top: 16px;
  color: #999;
}
</style>
