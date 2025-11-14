<template>
  <div class="debug-test">
    <h1>调试测试页面</h1>

    <!-- 用户信息 -->
    <div class="section">
      <h2>用户信息</h2>
      <p>用户名: {{ userStore.user?.username }}</p>
      <p>姓名: {{ userStore.user?.name }}</p>
      <p>角色: {{ userStore.user?.role }}</p>
      <p>Token: {{ userStore.token ? '已设置' : '未设置' }}</p>
      <p>登录状态: {{ userStore.isLoggedIn ? '已登录' : '未登录' }}</p>
    </div>

    <!-- 权限测试 -->
    <div class="section">
      <h2>权限测试</h2>
      <p>基地管理权限: {{ hasBasePermission ? '有权限' : '无权限' }}</p>
      <p>活动管理权限: {{ hasActivityPermission ? '有权限' : '无权限' }}</p>
      <p>基地管理员创建权限: {{ canCreateBase ? '有权限' : '无权限' }}</p>
      <p>实际计算结果: {{ hasBasePermission ? '有权限' : '无权限' }}</p>

      <el-button @click="testBaseAPI" :loading="baseTestLoading" type="primary">
        测试基地API
      </el-button>
      <el-button @click="testActivityAPI" :loading="activityTestLoading" type="success">
        测试活动API
      </el-button>
      <el-button @click="checkBaseCreatePermissions" type="warning">检查基地创建权限</el-button>

      <!-- 权限详情显示 -->
      <div class="permission-details">
        <h4>权限详情:</h4>
        <p><strong>用户角色:</strong> {{ userStore.user?.role || '未加载' }}</p>
        <p><strong>用户ID:</strong> {{ userStore.user?.id || '未加载' }}</p>
        <p><strong>登录状态:</strong> {{ userStore.isLoggedIn ? '已登录' : '未登录' }}</p>
        <p><strong>Token状态:</strong> {{ userStore.token ? '已设置' : '未设置' }}</p>
        <p><strong>hasBasePermission计算:</strong> {{ hasBasePermission }}</p>
        <p><strong>canCreateBase计算:</strong> {{ canCreateBase }}</p>
      </div>

      <div v-if="apiResult" class="api-result">
        <h3>API测试结果:</h3>
        <pre>{{ JSON.stringify(apiResult, null, 2) }}</pre>
      </div>
    </div>

    <!-- 路由测试 -->
    <div class="section">
      <h2>路由测试</h2>
      <el-button @click="navigateToBases" type="warning">跳转到基地管理</el-button>
      <el-button @click="navigateToActivities" type="info">跳转到活动管理</el-button>
      <el-button @click="navigateToDashboard" type="default">跳转到首页</el-button>
    </div>

    <!-- 组件测试 -->
    <div class="section">
      <h2>组件测试</h2>
      <el-button @click="testDirectClick" type="primary">直接点击测试</el-button>
      <el-button @click="testWithDelay" type="success">延迟点击测试</el-button>
      <div ref="testElement" class="test-element" @click="handleElementClick">
        点击这个区域测试
      </div>
      <p v-if="clickResult">点击结果: {{ clickResult }}</p>
    </div>

    <!-- 错误日志 -->
    <div class="section">
      <h2>错误日志</h2>
      <div v-if="errors.length > 0" class="error-list">
        <div v-for="(error, index) in errors" :key="index" class="error-item">
          <strong>{{ error.time }}</strong>: {{ error.message }}
        </div>
      </div>
      <div v-else class="no-errors">暂无错误</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { ElMessage } from 'element-plus'
import request from '@/api/request'

const router = useRouter()
const userStore = useUserStore()

// 响应式数据
const baseTestLoading = ref(false)
const activityTestLoading = ref(false)
const apiResult = ref(null)
const clickResult = ref(null)
const errors = ref([])
const testElement = ref(null)

// 计算属性
const hasBasePermission = computed(() => {
  const role = userStore.user?.role
  return ['SUPER_ADMIN', 'ADMIN'].includes(role)
})

const hasActivityPermission = computed(() => {
  const role = userStore.user?.role
  return ['SUPER_ADMIN', 'ADMIN'].includes(role)
})

const canCreateBase = computed(() => {
  const role = userStore.user?.role
  return ['SUPER_ADMIN', 'ADMIN'].includes(role)
})

// 检查基地创建权限
const checkBaseCreatePermissions = () => {
  console.log('=== 检查基地创建权限 ===')

  const user = userStore.user
  const token = userStore.token
  const role = user?.role
  const isLoggedIn = userStore.isLoggedIn

  console.log('用户完整信息:', JSON.stringify(user, null, 2))
  console.log('用户Token:', token)
  console.log('用户角色:', role)
  console.log('登录状态:', isLoggedIn)
  console.log('权限检查结果:')
  console.log('- hasBasePermission:', hasBasePermission.value)
  console.log('- canCreateBase:', canCreateBase.value)

  // 检查用户存储状态
  console.log('User Store 状态:')
  console.log('- userStore.user:', userStore.user)
  console.log('- userStore.token:', userStore.token)
  console.log('- userStore.isLoggedIn:', userStore.isLoggedIn)

  // 尝试从localStorage直接获取token
  const localToken = localStorage.getItem('token')
  console.log('localStorage中的token:', localToken)

  // 权限测试结果
  const permissionTest = {
    user: user,
    role: role,
    isLoggedIn: isLoggedIn,
    hasBasePermission: hasBasePermission.value,
    canCreateBase: canCreateBase.value,
    hasValidToken: !!token && token.length > 0,
    localStorageToken: localToken
  }

  logError(`权限检查完成: ${JSON.stringify(permissionTest, null, 2)}`)

  // 显示详细的权限信息
  if (role === 'SUPER_ADMIN') {
    ElMessage.success('超级管理员 - 拥有所有基地管理权限')
  } else if (role === 'ADMIN') {
    ElMessage.info('基地管理员 - 应该拥有基地管理权限')
  } else {
    ElMessage.warning(`当前角色: ${role || '未知'} - 可能没有基地管理权限`)
  }
}

// 错误日志记录
const logError = (message) => {
  errors.value.push({
    time: new Date().toLocaleTimeString(),
    message
  })
  console.error(message)
}

// 测试基地API
const testBaseAPI = async () => {
  baseTestLoading.value = true
  try {
    const response = await request.get('/bases')
    apiResult.value = {
      success: true,
      data: response.data,
      status: response.status
    }
    ElMessage.success('基地API测试成功')
  } catch (error) {
    logError(`基地API测试失败: ${error.response?.data?.error || error.message}`)
    apiResult.value = {
      success: false,
      error: error.response?.data?.error || error.message,
      status: error.response?.status
    }
    ElMessage.error('基地API测试失败')
  } finally {
    baseTestLoading.value = false
  }
}

// 测试活动API
const testActivityAPI = async () => {
  activityTestLoading.value = true
  try {
    const response = await request.get('/activities')
    apiResult.value = {
      success: true,
      data: response.data,
      status: response.status
    }
    ElMessage.success('活动API测试成功')
  } catch (error) {
    logError(`活动API测试失败: ${error.response?.data?.error || error.message}`)
    apiResult.value = {
      success: false,
      error: error.response?.data?.error || error.message,
      status: error.response?.status
    }
    ElMessage.error('活动API测试失败')
  } finally {
    activityTestLoading.value = false
  }
}

// 路由跳转测试
const navigateToBases = async () => {
  try {
    logError(`开始跳转到基地管理，当前用户: ${JSON.stringify(userStore.user)}`)
    await router.push('/bases')
    ElMessage.success('跳转到基地管理')
  } catch (error) {
    logError(`跳转到基地管理失败: ${error.message}`)
    ElMessage.error('跳转失败')
  }
}

const navigateToActivities = () => {
  try {
    router.push('/activities')
    ElMessage.success('跳转到活动管理')
  } catch (error) {
    logError(`跳转到活动管理失败: ${error.message}`)
    ElMessage.error('跳转失败')
  }
}

const navigateToDashboard = () => {
  try {
    router.push('/dashboard')
    ElMessage.success('跳转到首页')
  } catch (error) {
    logError(`跳转到首页失败: ${error.message}`)
    ElMessage.error('跳转失败')
  }
}

// 点击测试
const testDirectClick = () => {
  clickResult.value = `直接点击测试成功 - ${new Date().toLocaleTimeString()}`
  ElMessage.success('直接点击测试成功')
}

const testWithDelay = () => {
  setTimeout(() => {
    clickResult.value = `延迟点击测试成功 - ${new Date().toLocaleTimeString()}`
    ElMessage.success('延迟点击测试成功')
  }, 500)
}

const handleElementClick = () => {
  clickResult.value = `元素点击测试成功 - ${new Date().toLocaleTimeString()}`
  ElMessage.success('元素点击测试成功')
}

// 页面加载时的检查
onMounted(() => {
  console.log('DebugTest 页面加载完成')
  console.log('用户信息:', userStore.user)
  console.log('Token:', userStore.token)
  console.log('角色:', userStore.user?.role)
})
</script>

<style scoped>
.debug-test {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.section {
  margin-bottom: 30px;
  padding: 20px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  background-color: #fff;
}

.section h2 {
  margin-top: 0;
  color: #409eff;
  border-bottom: 2px solid #409eff;
  padding-bottom: 10px;
}

.section p {
  margin: 8px 0;
  font-size: 14px;
}

.api-result {
  margin-top: 15px;
  padding: 15px;
  background-color: #f5f7fa;
  border-radius: 4px;
  max-height: 300px;
  overflow-y: auto;
}

.api-result pre {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
}

.test-element {
  margin: 15px 0;
  padding: 20px;
  background-color: #f0f9ff;
  border: 2px dashed #409eff;
  border-radius: 8px;
  cursor: pointer;
  text-align: center;
  transition: all 0.3s ease;
}

.test-element:hover {
  background-color: #e1f3d8;
  border-color: #67c23a;
}

.error-list {
  max-height: 200px;
  overflow-y: auto;
}

.error-item {
  padding: 8px;
  margin: 5px 0;
  background-color: #fef0f0;
  border-left: 4px solid #f56c6c;
  color: #f56c6c;
  font-size: 12px;
}

.permission-details {
  margin-top: 15px;
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: 4px;
  border-left: 4px solid #409eff;
}

.permission-details h4 {
  margin-top: 0;
  color: #409eff;
  font-size: 14px;
  margin-bottom: 10px;
}

.permission-details p {
  margin: 5px 0;
  font-size: 12px;
  line-height: 1.5;
}

.no-errors {
  color: #67c23a;
  font-style: italic;
}
</style>