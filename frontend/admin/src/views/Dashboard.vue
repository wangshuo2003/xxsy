<template>
  <div>
    <div class="page-header">
      <h1>欢迎使用教育实践平台管理端</h1>
      <p>当前用户：{{ userStore.userName }} ({{ getRoleText(userStore.userRole) }})</p>
    </div>

    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stats-card">
          <div class="stats-content">
            <div class="stats-icon users">
              <el-icon><User /></el-icon>
            </div>
            <div class="stats-info">
              <div class="stats-number">{{ stats.totalUsers }}</div>
              <div class="stats-label">总用户数</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="6">
        <el-card class="stats-card">
          <div class="stats-content">
            <div class="stats-icon bases">
              <el-icon><OfficeBuilding /></el-icon>
            </div>
            <div class="stats-info">
              <div class="stats-number">{{ stats.totalBases }}</div>
              <div class="stats-label">基地数量</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="6">
        <el-card class="stats-card">
          <div class="stats-content">
            <div class="stats-icon activities">
              <el-icon><Calendar /></el-icon>
            </div>
            <div class="stats-info">
              <div class="stats-number">{{ stats.totalActivities }}</div>
              <div class="stats-label">活动数量</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="6">
        <el-card class="stats-card">
          <div class="stats-content">
            <div class="stats-icon orders">
              <el-icon><List /></el-icon>
            </div>
            <div class="stats-info">
              <div class="stats-number">{{ stats.totalOrders }}</div>
              <div class="stats-label">订单数量</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="content-row">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>最新活动</span>
              <el-button type="primary" text @click="$router.push('/activities')">查看更多</el-button>
            </div>
          </template>
          <el-table :data="recentActivities" style="width: 100%">
            <el-table-column prop="name" label="活动名称" />
            <el-table-column prop="base.name" label="基地" />
            <el-table-column prop="time" label="时间">
              <template #default="{ row }">
                {{ formatDate(row.time) }}
              </template>
            </el-table-column>
            <el-table-column prop="isApproved" label="状态">
              <template #default="{ row }">
                <el-tag :type="row.isApproved ? 'success' : 'warning'">
                  {{ row.isApproved ? '已通过' : '待审核' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>最新订单</span>
              <el-button type="primary" text @click="$router.push('/orders')">查看更多</el-button>
            </div>
          </template>
          <el-table :data="recentOrders" style="width: 100%">
            <el-table-column prop="orderNo" label="订单号" />
            <el-table-column prop="user.name" label="用户" />
            <el-table-column prop="service.title" label="服务项目" />
            <el-table-column prop="amount" label="金额">
              <template #default="{ row }">
                ¥{{ row.amount }}
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态">
              <template #default="{ row }">
                <el-tag :type="getOrderStatusType(row.status)">
                  {{ getOrderStatusText(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import request from '@/api/request'

const userStore = useUserStore()

const stats = ref({
  totalUsers: 0,
  totalBases: 0,
  totalActivities: 0,
  totalOrders: 0
})

const recentActivities = ref([])
const recentOrders = ref([])

const getRoleText = (role) => {
  const roleMap = {
    'SUPER_ADMIN': '超级管理员',
    'ADMIN': '管理员',
    'STUDENT': '学生用户'
  }
  return roleMap[role] || role
}

const getOrderStatusText = (status) => {
  const statusMap = {
    'PENDING': '待付款',
    'PAID': '已付款',
    'CANCELLED': '已取消'
  }
  return statusMap[status] || status
}

const getOrderStatusType = (status) => {
  const typeMap = {
    'PENDING': 'warning',
    'PAID': 'success',
    'CANCELLED': 'danger'
  }
  return typeMap[status] || 'info'
}

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('zh-CN')
}

const loadStats = async () => {
  try {
    console.log('Dashboard: 开始加载统计数据...')
    console.log('Dashboard: 用户角色:', userStore.user?.role)

    // 根据用户角色决定加载哪些统计数据
    const requests = []

    if (userStore.user?.role === 'SUPER_ADMIN') {
      // 超级管理员可以查看所有统计数据
      requests.push(
        request.get('/users?limit=1'),
        request.get('/bases?limit=1'),
        request.get('/activities?limit=1'),
        request.get('/orders?limit=1')
      )
    } else if (userStore.user?.role === 'ADMIN') {
      // 管理员可以查看基地相关统计，不能查看用户统计
      console.log('Dashboard: 管理员模式，跳过用户统计')
      requests.push(
        null, // 跳过用户统计
        request.get('/bases?limit=1'),
        request.get('/activities?limit=1'),
        request.get('/orders?limit=1')
      )
    } else {
      // 其他角色只看基地统计
      requests.push(
        null, // 跳过用户统计
        request.get('/bases?limit=1'),
        null, // 跳过活动统计
        null  // 跳过订单统计
      )
    }

    // 执行请求（跳过null值）
    const results = await Promise.all(
      requests.map(req => req ? req : Promise.resolve({ data: [], pagination: { total: 0 } }))
    )

    const [usersRes, basesRes, activitiesRes, ordersRes] = results

    stats.value = {
      totalUsers: usersRes.pagination?.total || 0,
      totalBases: basesRes.pagination?.total || 0,
      totalActivities: activitiesRes.pagination?.total || 0,
      totalOrders: ordersRes.pagination?.total || 0
    }

    console.log('Dashboard: 统计数据加载成功:', stats.value)
  } catch (error) {
    console.error('Dashboard: Failed to load stats:', error)
    // 如果某些统计加载失败，设置默认值
    stats.value = {
      totalUsers: userStore.user?.role === 'SUPER_ADMIN' ? 0 : '-', // 非超级管理员显示-
      totalBases: 0,
      totalActivities: 0,
      totalOrders: 0
    }
    console.log('Dashboard: 使用默认统计数据:', stats.value)
  }
}

const loadRecentData = async () => {
  try {
    console.log('Dashboard: 开始加载最近数据...')
    console.log('Dashboard: 用户角色:', userStore.user?.role)

    // 根据用户角色决定加载哪些最近数据
    const requests = []

    if (['SUPER_ADMIN', 'ADMIN'].includes(userStore.user?.role)) {
      // 超级管理员和殡理员可以查看活动和订单
      requests.push(
        request.get('/activities?limit=5'),
        request.get('/orders?limit=5')
      )
    } else {
      // 其他角色只能查看活动
      requests.push(
        request.get('/activities?limit=5'),
        null // 跳过订单
      )
    }

    // 执行请求（跳过null值）
    const results = await Promise.all(
      requests.map(req => req ? req : Promise.resolve({ data: [] }))
    )

    const [activitiesRes, ordersRes] = results

    recentActivities.value = activitiesRes.data || []
    recentOrders.value = ordersRes.data || []

    console.log('Dashboard: 最近数据加载成功')
    console.log('Dashboard: 活动数量:', recentActivities.value.length)
    console.log('Dashboard: 订单数量:', recentOrders.value.length)
  } catch (error) {
    console.error('Dashboard: Failed to load recent data:', error)
    // 如果加载失败，设置空数组
    recentActivities.value = []
    recentOrders.value = []
  }
}

onMounted(() => {
  loadStats()
  loadRecentData()
})
</script>

<style scoped>
.stats-row {
  margin-bottom: 20px;
}

.stats-card {
  height: 120px;
}

.stats-content {
  display: flex;
  align-items: center;
  height: 100%;
}

.stats-icon {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20px;
  font-size: 24px;
  color: white;
}

.stats-icon.users {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.stats-icon.bases {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.stats-icon.activities {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.stats-icon.orders {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
}

.stats-info {
  flex: 1;
}

.stats-number {
  font-size: 32px;
  font-weight: bold;
  color: #333;
  line-height: 1;
}

.stats-label {
  font-size: 14px;
  color: #666;
  margin-top: 5px;
}

.content-row {
  margin-top: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>