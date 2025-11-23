<template>
  <div class="base-manager-editor">
    <!-- 搜索栏 -->
    <div class="search-bar">
      <el-input
        v-model="searchQuery"
        placeholder="搜索用户名、姓名或手机号"
        style="width: 300px"
        @input="handleSearch"
        clearable
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
    </div>

    <!-- 管理员列表 -->
    <el-table
      ref="tableRef"
      :data="managers"
      v-loading="loading"
      style="width: 100%; margin-top: 20px"
      height="400"
      @select="handleSelect"
      @select-all="handleSelectAll"
      row-key="id"
    >
      <el-table-column type="selection" width="55" :reserve-selection="true" />
      <el-table-column prop="username" label="用户名" width="150" />
      <el-table-column prop="name" label="姓名" width="120" />
      <el-table-column prop="phone" label="手机号" width="150" />
      <el-table-column prop="school" label="学校" min-width="150" show-overflow-tooltip />
    </el-table>

    <!-- 分页 -->
    <div class="pagination">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="handleCurrentChange"
      />
    </div>


  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import request from '@/api/request'

const props = defineProps({
  baseId: {
    type: Number,
    required: true
  },
  initialManagerIds: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['cancel', 'success'])

const loading = ref(false)
const saving = ref(false)
const managers = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
const searchQuery = ref('')
const tableRef = ref()

// 维护全局选中的ID集合
const globalSelectedIds = ref(new Set(props.initialManagerIds))

// 加载管理员列表
const loadManagers = async () => {
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      limit: pageSize.value,
      role: 'ACTIVITY_ADMIN',
      search: searchQuery.value
    }
    const response = await request.get('/users', { params })
    managers.value = response.data || []
    total.value = response.pagination?.total || 0
  } catch (error) {
    ElMessage.error('加载管理员列表失败')
  } finally {
    loading.value = false
  }
}

// 搜索
const handleSearch = () => {
  currentPage.value = 1
  loadManagers()
}

// 翻页
const handleCurrentChange = (val) => {
  currentPage.value = val
  loadManagers()
}

// 单选事件
const handleSelect = async (selection, row) => {
  if (globalSelectedIds.value.has(row.id)) {
    globalSelectedIds.value.delete(row.id)
  } else {
    globalSelectedIds.value.add(row.id)
  }
  await saveChanges()
}

// 全选事件
const handleSelectAll = async (selection) => {
  const isAllSelected = selection.length > 0
  managers.value.forEach(row => {
    if (isAllSelected) {
      globalSelectedIds.value.add(row.id)
    } else {
      globalSelectedIds.value.delete(row.id)
    }
  })
  await saveChanges()
}

// 更新表格选中状态
const updateTableSelection = () => {
  if (!tableRef.value) return
  managers.value.forEach(row => {
    tableRef.value.toggleRowSelection(row, globalSelectedIds.value.has(row.id))
  })
}

// 监听数据变化，更新选中状态
watch(managers, () => {
  nextTick(() => {
    updateTableSelection()
  })
})

// 保存更改
const saveChanges = async () => {
  try {
    const managerIds = Array.from(globalSelectedIds.value)
    await request.put(`/bases/${props.baseId}/manager`, {
      managerIds
    })
    ElMessage.success('管理员设置已更新')
    // 不关闭对话框，让用户可以继续编辑
  } catch (error) {
    ElMessage.error('更新失败：' + (error.response?.data?.error || error.message))
    // 如果失败，可能需要回滚状态，这里暂不处理复杂回滚
  }
}

onMounted(() => {
  loadManagers()
})
</script>

<style scoped>
.base-manager-editor {
  padding: 20px;
}
.search-bar {
  margin-bottom: 20px;
}
.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
.footer-actions {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
