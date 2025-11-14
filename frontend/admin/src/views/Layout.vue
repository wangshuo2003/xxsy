<template>
  <div class="admin-layout">
    <el-aside
      class="admin-aside has-transition"
      @mouseenter="isAsideExpanded = true"
      @mouseleave="isAsideExpanded = false"
      :class="{ collapsed: !isAsideExpanded }"
      :style="{ width: isAsideExpanded ? '200px' : '64px' }"
    >
      <div class="logo">
        <el-icon><Menu /></el-icon>
        <transition name="fade">
          <span v-if="isAsideExpanded">教育实践平台</span>
        </transition>
      </div>
      <el-menu
        :default-active="$route.path"
        :collapse="!isAsideExpanded"
        :collapse-transition="false"
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409EFF"
        router
      >
        <el-menu-item
          v-for="item in menuItems"
          :key="item.path"
          :index="item.path"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-main class="admin-main">
      <router-view />
    </el-main>

    <el-dialog v-model="passwordDialog" title="修改密码" width="400px">
      <el-form ref="passwordFormRef" :model="passwordForm" :rules="passwordRules">
        <el-form-item label="原密码" prop="oldPassword">
          <el-input v-model="passwordForm.oldPassword" type="password" show-password />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input v-model="passwordForm.newPassword" type="password" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="passwordDialog = false">取消</el-button>
        <el-button type="primary" @click="handleChangePassword">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { changePassword } from '@/api/auth'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const passwordDialog = ref(false)
const passwordFormRef = ref()
const currentRoute = computed(() => route)

const passwordForm = reactive({
  oldPassword: '',
  newPassword: ''
})

const passwordRules = {
  oldPassword: [
    { required: true, message: '请输入原密码', trigger: 'blur' }
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' }
  ]
}

const isAsideExpanded = ref(false)

const sidebarMenu = [
  { path: '/dashboard', label: '首页', icon: 'HomeFilled' },
  { path: '/carousels', label: '轮播图管理', icon: 'Picture', roles: ['SUPER_ADMIN'] },
  { path: '/policies', label: '政策通知管理', icon: 'Document', roles: ['SUPER_ADMIN', 'ACTIVITY_ADMIN'] },
  { path: '/achievements', label: '成果展示管理', icon: 'Trophy', roles: ['SUPER_ADMIN'] },
  { path: '/bases', label: '基地管理', icon: 'OfficeBuilding', roles: ['SUPER_ADMIN', 'ACTIVITY_ADMIN'] },
  { path: '/activities', label: '活动管理', icon: 'Calendar', roles: ['SUPER_ADMIN', 'ACTIVITY_ADMIN'] },
  { path: '/services', label: '服务项目管理', icon: 'ShoppingBag', roles: ['SUPER_ADMIN', 'ACTIVITY_ADMIN'] },
  { path: '/orders', label: '订单管理', icon: 'List', roles: ['SUPER_ADMIN', 'ACTIVITY_ADMIN'] },
  { path: '/users', label: '用户管理', icon: 'User', roles: ['SUPER_ADMIN', 'ACTIVITY_ADMIN'] },
  { path: '/gift-cards', label: '礼品卡管理', icon: 'Money', roles: ['SUPER_ADMIN'] },
  { path: '/debug', label: '调试测试', icon: 'Tools' }
]

const menuItems = computed(() => {
  const role = userStore.userRole
  return sidebarMenu.filter((item) => {
    if (!item.roles) return true
    return !!role && item.roles.includes(role)
  })
})

const handleCommand = (command) => {
  if (command === 'changePassword') {
    passwordDialog.value = true
  } else if (command === 'logout') {
    handleLogout()
  }
}

const handleLogout = () => {
  ElMessageBox.confirm('确定要退出登录吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    userStore.logout()
    router.push('/login')
    ElMessage.success('退出成功')
  })
}

const handleChangePassword = async () => {
  if (!passwordFormRef.value) return

  await passwordFormRef.value.validate(async (valid) => {
    if (!valid) return

    try {
      await changePassword(passwordForm)
      ElMessage.success('密码修改成功')
      passwordDialog.value = false
      Object.assign(passwordForm, { oldPassword: '', newPassword: '' })
    } catch (error) {
      ElMessage.error(error.response?.data?.error || '密码修改失败')
    }
  })
}
</script>

<style scoped>
.logo {
  padding: 20px;
  text-align: center;
  border-bottom: 1px solid #434a50;
}

.logo h3 {
  color: #fff;
  margin: 0;
  font-size: 16px;
}

.header-left {
  flex: 1;
}

.header-right {
  display: flex;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  cursor: pointer;
  color: #333;
  gap: 8px;
}

.user-info:hover {
  color: #409EFF;
}

.logo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  border-bottom: 1px solid #434a50;
  color: #fff;
}

.logo span {
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
}

.admin-aside {
  min-width: 64px;
  transition: width 0.2s ease;
  border-right: none;
  background-color: #304156;
}

.admin-aside.has-transition {
  overflow: hidden;
}

.admin-aside .logo span {
  opacity: 0;
  transition: opacity 0.15s ease;
}

.admin-aside:not(.collapsed) .logo span {
  opacity: 1;
}

:deep(.el-menu) {
  border-right: none;
  width: 100%;
  transition: none !important;
  overflow: hidden;
  background-color: transparent;
}

:deep(.el-menu--collapse .el-menu-item span) {
  display: none;
}

:deep(.el-menu--collapse .el-menu-item) {
  justify-content: center;
}

.logo :deep(.el-icon) {
  font-size: 18px;
}

.admin-layout {
  display: flex;
  height: 100vh;
  width: 100%;
  overflow: hidden;
  background: #f5f6fa;
}

.admin-main {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: #f5f6fa;
  min-width: 0;
}

:deep(.el-main) {
  padding: 0 !important;
  background: transparent;
  height: 100%;
}
</style>
