<template>
  <div class="bases-management">
    <el-card class="content-card">
      <!-- 标签页 -->
      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <!-- 待审核基地 -->
        <el-tab-pane label="待审核基地" name="pending">
          <PendingBases :key="`pending-${refreshKey}`" @refresh="loadPendingBases" />
        </el-tab-pane>

        <!-- 已通过基地 -->
        <el-tab-pane label="已通过基地" name="approved">
          <ApprovedBases ref="approvedBasesRef" @refresh="loadApprovedBases" />
        </el-tab-pane>

        <!-- 所有基地（超级管理员） -->
        <el-tab-pane label="所有基地" name="all" v-if="userStore.user?.role === 'SUPER_ADMIN'">
          <AllBases :key="`all-${refreshKey}`" @refresh="loadAllBases" />
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 创建基地对话框 -->
    <el-dialog
      v-model="createDialogVisible"
      title="创建基地"
      width="600px"
      @close="resetCreateForm"
    >
      <el-form
        ref="createFormRef"
        :model="createForm"
        :rules="createRules"
        label-width="100px"
      >
        <el-form-item label="基地名称" prop="name">
          <el-input v-model="createForm.name" placeholder="请输入基地名称" />
        </el-form-item>
        <el-form-item label="基地类型" prop="type">
          <el-select v-model="createForm.type" placeholder="请选择基地类型" style="width: 100%">
            <el-option label="研学活动" value="研学活动" />
            <el-option label="实践活动" value="实践活动" />
            <el-option label="科技创新" value="科技创新" />
            <el-option label="文化体验" value="文化体验" />
            <el-option label="生态环保" value="生态环保" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>
        <el-form-item label="基地地址" prop="address">
          <el-input v-model="createForm.address" placeholder="请输入基地地址" />
        </el-form-item>
        <el-form-item label="联系方式" prop="contact">
          <el-input v-model="createForm.contact" placeholder="请输入联系方式" />
        </el-form-item>
        <el-form-item label="基地描述" prop="description">
          <el-input
            v-model="createForm.description"
            type="textarea"
            :rows="4"
            placeholder="请输入基地描述"
          />
        </el-form-item>
        <el-form-item label="基地状态" prop="isActive" v-if="userStore.user?.role === 'SUPER_ADMIN'">
          <el-radio-group v-model="createForm.isActive">
            <el-radio :label="true">启用</el-radio>
            <el-radio :label="false">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="createDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleCreateSubmit" :loading="createLoading">
            {{ ['SUPER_ADMIN', 'ADMIN'].includes(userStore.user?.role) ? '创建' : '提交申请' }}
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import request from '@/api/request'
import PendingBases from '@/components/bases/PendingBases.vue'
import ApprovedBases from '@/components/bases/ApprovedBases.vue'

const userStore = useUserStore()
const route = useRoute()
const router = useRouter()
const activeTab = ref('pending')

// 组件引用
const approvedBasesRef = ref(null)

// 组件刷新标识（保留给其他组件使用）
const refreshKey = ref(0)

// 创建基地相关
const createDialogVisible = ref(false)
const createLoading = ref(false)
const createFormRef = ref()
const createForm = ref({
  name: '',
  type: '',
  address: '',
  contact: '',
  description: '',
  isActive: true
})

// 权限计算
const canCreateBase = computed(() => {
  const role = userStore.user?.role
  return ['SUPER_ADMIN', 'ADMIN'].includes(role)
})

// 表单验证规则
const createRules = {
  name: [
    { required: true, message: '请输入基地名称', trigger: 'blur' }
  ],
  type: [
    { required: true, message: '请选择基地类型', trigger: 'change' }
  ],
  address: [
    { required: true, message: '请输入基地地址', trigger: 'blur' }
  ]
}

const updateRouteTab = (tabName) => {
  if (route.query.tab === tabName) return
  router.replace({
    path: '/bases',
    query: { tab: tabName }
  })
}

const handleTabChange = (tabName) => {
  activeTab.value = tabName
  updateRouteTab(tabName)
}

const loadPendingBases = () => {
  console.log('刷新待审核基地列表')
  refreshKey.value++ // 强制重新渲染子组件
}

const loadApprovedBases = () => {
  console.log('刷新已通过基地列表')
  if (approvedBasesRef.value) {
    approvedBasesRef.value.refreshData()
  }
}

// 创建基地相关函数
const handleCreateBase = () => {
  createDialogVisible.value = true
}

const resetCreateForm = () => {
  if (createFormRef.value) {
    createFormRef.value.resetFields()
  }
  createForm.value = {
    name: '',
    type: '',
    address: '',
    contact: '',
    description: '',
    isActive: true
  }
}

const handleCreateSubmit = async () => {
  console.log('=== 开始创建基地 ===')
  console.log('表单引用:', createFormRef.value)
  console.log('表单数据:', createForm.value)
  console.log('用户信息:', userStore.user)

  if (!createFormRef.value) {
    console.error('表单引用不存在')
    return
  }

  try {
    console.log('开始表单验证...')
    await createFormRef.value.validate()
    console.log('表单验证通过')

    createLoading.value = true

    const submitData = {
      name: createForm.value.name,
      type: createForm.value.type,
      address: createForm.value.address,
      contact: createForm.value.contact,
      description: createForm.value.description
    }

    console.log('提交数据:', submitData)

    // 根据用户角色调用不同的API
    let response
    if (userStore.user?.role === 'SUPER_ADMIN') {
      // 超级管理员直接创建基地
      submitData.isActive = createForm.value.isActive
      console.log('调用超级管理员创建API...')
      response = await request.post('/bases', submitData)
      console.log('API响应:', response)
      ElMessage.success('基地创建成功')
    } else if (userStore.user?.role === 'ADMIN') {
      // 基地管理员直接创建基地，无需审核
      console.log('调用基地管理员创建API...')
      response = await request.post('/bases', submitData)
      console.log('API响应:', response)
      ElMessage.success('基地创建成功')
    } else {
      // 其他用户申请基地
      console.log('调用基地申请API...')
      response = await request.post('/bases/apply', submitData)
      console.log('API响应:', response)
      ElMessage.success('基地申请提交成功，等待审核')
    }

    createDialogVisible.value = false
    console.log('对话框已关闭')

    // 根据用户角色和基地状态切换到相应的标签页
    if (userStore.user?.role === 'SUPER_ADMIN') {
      // 超级管理员创建的基地直接通过审核，切换到已通过基地标签页
      activeTab.value = 'approved'
    } else if (userStore.user?.role === 'ADMIN') {
      // 基地管理员创建的基地直接通过审核，切换到已通过基地标签页
      activeTab.value = 'approved'
    } else {
      // 其他用户申请的基地，切换到已通过基地标签页查看已申请的基地
      activeTab.value = 'approved'
    }

    // 刷新当前标签页数据
    refreshCurrentTab()
  } catch (error) {
    console.error('创建基地失败:', error)
    console.error('错误详情:', error.response?.data)
    ElMessage.error('操作失败：' + (error.response?.data?.error || error.message))
  } finally {
    createLoading.value = false
    console.log('创建流程结束')
  }
}

const refreshCurrentTab = () => {
  // 简单的刷新方式：重新加载当前标签页
  if (activeTab.value === 'pending') {
    loadPendingBases()
  } else if (activeTab.value === 'approved') {
    loadApprovedBases()
  }
}

const applyTabFromQuery = (tabName) => {
  if (tabName === 'pending' && ['SUPER_ADMIN', 'ADMIN'].includes(userStore.user?.role)) {
    activeTab.value = 'pending'
    return true
  }
  if (tabName === 'approved') {
    activeTab.value = 'approved'
    return true
  }
  return false
}

const setDefaultTab = () => {
  if (['SUPER_ADMIN', 'ADMIN'].includes(userStore.user?.role)) {
    activeTab.value = 'pending'
  } else {
    activeTab.value = 'approved'
  }
  updateRouteTab(activeTab.value)
}

onMounted(() => {
  const urlTab = route.query.tab
  if (!applyTabFromQuery(urlTab)) {
    setDefaultTab()
  } else {
    updateRouteTab(activeTab.value)
  }
})

watch(
  () => route.query.tab,
  (newTab) => {
    if (!applyTabFromQuery(newTab)) {
      setDefaultTab()
    }
  }
)
</script>

<style scoped>
.bases-management {
  padding: 0;
}

.content-card {
  min-height: 600px;
  margin: 0;
  width: 100%;
  border-radius: 0;
}

:deep(.el-tabs__content) {
  padding: 20px 0;
}
</style>
