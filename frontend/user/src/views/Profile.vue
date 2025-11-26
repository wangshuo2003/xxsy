<template>
  <div class="profile">
    <div v-if="loading" class="loading">
      <van-loading size="24px" vertical>加载中...</van-loading>
    </div>

    <div v-else-if="user" class="profile-content">
      <!-- 用户信息卡片 -->
      <div class="user-card">
        <div class="user-avatar">
          <van-image
            :src="user.avatar || bingFallback"
            round
            width="60"
            height="60"
            fit="cover"
          />
        </div>
        <div class="user-info">
          <h2 class="user-name">{{ user.name }}</h2>
          <p class="user-role">{{ getRoleText(user.role) }}</p>
          <p v-if="user.phone" class="user-phone">{{ user.phone }}</p>
          <p class="user-school">
            <span class="info-label">我的学校：</span>
            <span class="info-value">{{ user.school || '未填写' }}</span>
          </p>
          <p class="user-grade">
            <span class="info-label">年级：</span>
            <span class="info-value">{{ user.grade || '未填写' }}</span>
          </p>
          <p class="user-class">
            <span class="info-label">班级：</span>
            <span class="info-value">{{ user.className || '未填写' }}</span>
          </p>
        </div>
        <van-button size="small" type="primary" @click="editProfile">
          编辑资料
        </van-button>
      </div>

      <!-- 统计信息 -->
      <div class="stats-grid">
        <div class="stat-item clickable-stat-item" @click="goToBalance">
          <div class="stat-content">
            <div class="stat-value">账户余额：¥{{ userBalance?.toFixed(2) || '0.00' }}</div>
            <van-button size="small" type="primary" @click.stop="goToBalance">查看详情</van-button>
          </div>
        </div>
        <div class="stat-item" @click="goToActivities">
          <div class="stat-content">
            <div class="stat-value clickable">参与活动：{{ stats.activities || 0 }}</div>
            <van-button size="small" type="primary" @click.stop="goToActivities">查看详情</van-button>
          </div>
        </div>
        <div class="stat-item" @click="goToCertificates">
          <div class="stat-content">
            <div class="stat-value clickable">获得证书：{{ stats.certificates || 0 }}</div>
            <van-button size="small" type="primary" @click.stop="goToCertificates">查看详情</van-button>
          </div>
        </div>
        <div class="stat-item" @click="goToOrders">
          <div class="stat-content">
            <div class="stat-value clickable">服务订单：{{ stats.orders || 0 }}</div>
            <van-button size="small" type="primary" @click.stop="goToOrders">查看详情</van-button>
          </div>
        </div>
        <div class="stat-item" @click="goToFavorites">
          <div class="stat-content">
            <div class="stat-value clickable">我的收藏：{{ stats.favorites || 0 }}</div>
            <van-button size="small" type="primary" @click.stop="goToFavorites">查看详情</van-button>
          </div>
        </div>
      <div class="menu-section" v-if="userStore.userRole !== 'STUDENT'">
        <van-cell-group>
          <van-cell
            title="基地申请"
            icon="home"
            is-link
            @click="goToBaseApplication"
          />
        </van-cell-group>
      </div>

      <div class="menu-section">
        <van-cell-group>
          <van-cell
            title="修改密码"
            icon="lock"
            is-link
            @click="showPasswordDialog = true"
          />
          <van-cell
            title="关于我们"
            icon="info"
            is-link
            @click="showToast('关于页面开发中')"
          />
          <van-cell
            title="意见反馈"
            icon="chat"
            is-link
            @click="showToast('反馈功能开发中')"
          />
        </van-cell-group>
      </div>

      <!-- 退出登录 -->
      <div class="logout-section">
        <van-button
          type="danger"
          block
          @click="showLogoutDialog = true"
        >
          退出登录
        </van-button>
      </div>
    </div>
    </div>

    <!-- 修改密码弹窗 -->
    <van-dialog
      v-model:show="showPasswordDialog"
      title="修改密码"
      show-cancel-button
      @confirm="handleChangePassword"
    >
      <div class="password-form">
        <van-field
          v-model="passwordForm.oldPassword"
          type="password"
          label="原密码"
          placeholder="请输入原密码"
          required
        />
        <van-field
          v-model="passwordForm.newPassword"
          type="password"
          label="新密码"
          placeholder="请输入新密码"
          required
        />
        <van-field
          v-model="passwordForm.confirmPassword"
          type="password"
          label="确认密码"
          placeholder="请再次输入新密码"
          required
        />
      </div>
    </van-dialog>

    <!-- 退出登录确认 -->
    <van-dialog
      v-model:show="showLogoutDialog"
      title="确认退出"
      message="确定要退出登录吗？"
      show-cancel-button
      @confirm="handleLogout"
    />

    <!-- 编辑资料弹窗 -->
    <van-dialog
      v-model:show="showEditDialog"
      title="编辑资料"
      show-cancel-button
      @confirm="handleEditProfile"
      :confirm-button-loading="editDialogLoading"
      :confirm-button-disabled="editDialogLoading"
    >
      <div class="edit-form">
        <van-field
          v-model="editForm.name"
          label="姓名"
          placeholder="请输入姓名"
          required
        />
        <van-field
          v-model="editForm.phone"
          label="手机号"
          placeholder="请输入手机号"
          type="tel"
          required
        />
        <van-field
          v-model="editForm.school"
          label="学校"
          placeholder="请输入学校名称"
        />
        <van-field
          v-model="editForm.grade"
          label="年级"
          placeholder="请输入年级"
        />
        <van-field
          v-model="editForm.className"
          label="班级"
          placeholder="请输入班级"
        />
      </div>
    </van-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showSuccessToast, showFailToast } from 'vant'
import { useUserStore } from '@/stores/user'
import { getBingFallback } from '@/utils/bingFallback'
import request from '@/api/request'

const router = useRouter()
const userStore = useUserStore()
const bingFallback = getBingFallback()

const loading = ref(true)
const user = ref(null)
const userBalance = ref(0)
const stats = ref({})
const showPasswordDialog = ref(false)
const showLogoutDialog = ref(false)
const showEditDialog = ref(false)
const editDialogLoading = ref(false)

const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const editForm = reactive({
  name: '',
  phone: '',
  school: '',
  grade: '',
  className: ''
})

const getRoleText = (role) => {
  const roleMap = {
    'SUPER_ADMIN': '超级管理员',
    'ACTIVITY_ADMIN': '活动管理员',
    'STUDENT': '学生'
  }
  return roleMap[role] || '用户'
}

const loadUserData = async () => {
  try {
    const response = await request.get('/auth/me')
    user.value = response.user
  } catch (error) {
    showFailToast('获取用户信息失败')
  }
}

const loadUserBalance = async () => {
  try {
    const response = await request.get('/balance')
    userBalance.value = response.balance || 0
  } catch (error) {
    console.error('获取余额失败:', error)
    userBalance.value = 0
  }
}

const loadStats = async () => {
  try {
    // 获取用户报名的活动数量
    const activitiesResponse = await request.get('/activities/my-registrations', {
      params: {
        page: 1,
        limit: 1  // 只需要获取总数，不需要数据
      }
    })

    const activitiesCount = activitiesResponse.pagination?.total || 0

    // 获取用户的证书数量
    let certificatesCount = 0
    try {
      const certificatesResponse = await request.get('/certificates/my', {
        params: {
          page: 1,
          limit: 1
        }
      })
      certificatesCount = certificatesResponse.pagination?.total || 0
    } catch (error) {
      console.log('获取证书统计失败:', error)
    }

    // 获取用户的订单数量
    let ordersCount = 0
    try {
      const ordersResponse = await request.get('/orders', {
        params: {
          page: 1,
          limit: 1
        }
      })
      ordersCount = ordersResponse.pagination?.total || 0
    } catch (error) {
      // 如果订单API不存在，使用默认值
      console.log('获取订单统计失败:', error)
    }

    // 获取用户的收藏数量
    let favoritesCount = 0
    try {
      const favoritesResponse = await request.get('/favorites', {
        params: {
          page: 1,
          limit: 1
        }
      })
      favoritesCount = favoritesResponse.data?.length || 0
    } catch (error) {
      console.log('获取收藏统计失败:', error)
    }

    stats.value = {
      activities: activitiesCount,
      certificates: certificatesCount,
      orders: ordersCount,
      favorites: favoritesCount
    }
  } catch (error) {
    console.error('获取统计信息失败:', error)
    stats.value = {
      activities: 0,
      certificates: 0,
      orders: 0,
      favorites: 0
    }
  }
}

const editProfile = () => {
  console.log('==> editProfile 被调用')
  console.log('==> 当前 user.value:', user.value)
  
  if (user.value) {
    // 直接使用当前的 user 数据
    editForm.name = user.value.name || ''
    editForm.phone = user.value.phone || ''
    editForm.school = user.value.school || ''
    editForm.grade = user.value.grade || ''
    editForm.className = user.value.className || ''
    
    console.log('==> 表单已填充:', {
      name: editForm.name,
      phone: editForm.phone,
      school: editForm.school,
      grade: editForm.grade
    })
    
    showEditDialog.value = true
  } else {
    console.error('==> user.value 为空！')
  }
}

const handleEditProfile = async () => {
  console.log('==> handleEditProfile called')
  
  // 验证输入
  if (!editForm.name) {
    console.log('==> Validation failed: name is empty')
    showToast({
      message: '请输入姓名',
      type: 'fail',
      position: 'middle'
    })
    return
  }

  if (!editForm.phone) {
    console.log('==> Validation failed: phone is empty')
    showToast({
      message: '请输入手机号',
      type: 'fail',
      position: 'middle'
    })
    return
  }

  // 验证手机号格式
  const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/
  if (!phoneRegex.test(editForm.phone.trim()) || editForm.phone.trim().length < 3 || editForm.phone.trim().length > 20) {
    console.log('==> Validation failed: invalid phone format')
    showToast({
      message: '请输入有效的手机号（3-20位）',
      type: 'fail',
      position: 'middle'
    })
    return
  }

  console.log('==> Validation passed, sending request...')
  
  try {
    editDialogLoading.value = true
    console.log('==> Loading started, request data:', {
      name: editForm.name,
      phone: editForm.phone.trim()
    })
    
    const payload = {
      name: editForm.name.trim(),
      phone: editForm.phone.trim(),
      school: editForm.school.trim(),
      grade: editForm.grade.trim(),
      className: editForm.className.trim()
    }

    const response = await request.put('/auth/profile', payload)
    
    console.log('==> 更新成功，响应数据:', response)
    console.log('==> 调用 showToast')
    showToast({
      message: '资料修改成功',
      type: 'success',
      position: 'middle',
      duration: 2000
    })
    console.log('==> showToast 已调用')

    // 直接更新本地 user 数据
    const updatedUser = response.user || {
      ...user.value,
      name: editForm.name,
      phone: editForm.phone.trim(),
      school: editForm.school,
      grade: editForm.grade,
      className: editForm.className
    }
    
    console.log('==> 准备更新 user.value 为:', updatedUser)
    user.value = updatedUser
    console.log('==> user.value 已更新为:', user.value)

    // 同步更新 userStore
    try {
      console.log('==> 开始刷新 userStore')
      await userStore.getUserInfo()
      console.log('==> userStore 刷新成功, userStore.user:', userStore.user)
      
      // 从 userStore 同步最新数据
      if (userStore.user) {
        user.value = userStore.user
        console.log('==> 从 userStore 同步后 user.value:', user.value)
      }
    } catch (error) {
      console.error('==> userStore 刷新失败:', error)
    }

    // 关闭对话框
    showEditDialog.value = false
    console.log('==> 对话框已关闭')
    console.log('==> 最终 user.value:', user.value)
  } catch (error) {
    console.error('==> Profile update failed:', error)
    const errorMessage = error.response?.data?.errors?.[0]?.msg || error.response?.data?.error || '修改失败'
    showToast({
      message: errorMessage,
      type: 'fail',
      position: 'middle'
    })
  } finally {
    editDialogLoading.value = false
    console.log('==> Loading ended')
  }
}

const handleChangePassword = async () => {
  try {
    if (!passwordForm.oldPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      showFailToast('请填写完整信息')
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showFailToast('两次输入的密码不一致')
      return
    }

    await request.put('/auth/password', {
      oldPassword: passwordForm.oldPassword,
      newPassword: passwordForm.newPassword
    })

    showSuccessToast('密码修改成功')
    showPasswordDialog.value = false

    // 重置表单
    Object.assign(passwordForm, {
      oldPassword: '',
      newPassword: '',
      confirmPassword: ''
    })
  } catch (error) {
    showFailToast(error.response?.data?.error || '密码修改失败')
  }
}

const handleLogout = () => {
  userStore.logout()
  router.push('/login')
  showSuccessToast('已退出登录')
}

const goToActivities = () => {
  router.push('/my-activities')
}

const goToCertificates = () => {
  router.push('/achievements')
}

const goToOrders = () => {
  router.push('/orders')
}

const goToBaseApplication = () => {
  router.push('/base-application')
}

const goToFavorites = () => {
  router.push('/favorites/activities')
}

const goToBalance = () => {
  router.push('/balance')
}

onMounted(async () => {
  await loadUserData()
  await loadUserBalance()
  await loadStats()
  loading.value = false
})
</script>

<style scoped>
.profile {
  min-height: 100vh;
  background-color: #f7f8fa;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 300px;
}

.profile-content {
  padding-bottom: 20px;
}

.user-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 30px 20px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-info {
  flex: 1;
}

.user-name {
  margin: 0 0 4px 0;
  font-size: 24px;
  font-weight: 600;
}

.user-role {
  margin: 0 0 4px 0;
  font-size: 24px;
  opacity: 0.9;
}

.user-phone {
  margin: 0 0 4px 0;
  font-size: 20px;
  opacity: 0.85;
  font-weight: 500;
}

.user-school,
.user-grade,
.user-class {
  margin: 0;
  font-size: 18px;
  opacity: 0.9;
  display: flex;
  align-items: center;
  gap: 4px;
}

.info-label {
  font-weight: 500;
}

.info-value {
  font-weight: 600;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1px;
  background-color: #ebedf0;
  margin: 12px 0;
}

.stat-item {
  background: white;
  padding: 20px;
  text-align: left;
}

.stat-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #323233;
  margin-bottom: 4px;
}

.clickable-stat-item {
  cursor: pointer;
  position: relative;
}

.clickable-stat-item:hover {
  background-color: #f7f8fa;
}

.clickable-stat-item:active {
  background-color: #f2f3f5;
}

.stat-label {
  font-size: 12px;
  color: #969799;
}

.stat-label.clickable {
  color: #1989fa;
  cursor: pointer;
}

.stat-label.clickable:hover {
  color: #1666c7;
}

.stat-item:active {
  background-color: #f2f3f5;
}

.menu-section {
  margin: 12px 0;
}

.logout-section {
  padding: 20px;
}

.password-form {
  padding: 20px 0;
}

.edit-form {
  padding: 20px 0;
}

.menu-section :deep(.van-cell__title) {
  font-size: 24px !important;
}

.menu-section :deep(.van-cell__value) {
  font-size: 24px !important;
}

.logout-section :deep(.van-button__text) {
  font-size: 24px !important;
}

</style>
