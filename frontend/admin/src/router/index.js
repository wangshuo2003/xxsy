import { createRouter, createWebHistory } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录' }
  },
  {
    path: '/',
    name: 'Layout',
    component: () => import('@/views/Layout.vue'),
    redirect: '/dashboard',
    meta: { requiresAuth: true },
    children: [
      {
        path: '/dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '首页' }
      },
      {
        path: '/carousels',
        name: 'Carousels',
        component: () => import('@/views/Carousels.vue'),
        meta: { title: '轮播图管理', roles: ['SUPER_ADMIN'] }
      },
      {
        path: '/policies',
        name: 'Policies',
        component: () => import('@/views/Policies.vue'),
        meta: { title: '政策通知管理', roles: ['SUPER_ADMIN', 'ADMIN'] }
      },
      {
        path: '/achievements',
        name: 'Achievements',
        component: () => import('@/views/Achievements.vue'),
        meta: { title: '成果展示管理', roles: ['SUPER_ADMIN'] }
      },
      {
        path: '/bases',
        name: 'Bases',
        component: () => import('@/views/Bases.vue'),
        meta: { title: '基地管理', roles: ['SUPER_ADMIN', 'ADMIN'] }
      },
      {
        path: '/activities',
        name: 'Activities',
        component: () => import('@/views/Activities.vue'),
        meta: { title: '活动管理', roles: ['SUPER_ADMIN', 'ADMIN'] }
      },
      {
        path: '/services',
        name: 'Services',
        component: () => import('@/views/Services.vue'),
        meta: { title: '服务项目管理', roles: ['SUPER_ADMIN', 'ADMIN'] }
      },
      {
        path: '/events',
        name: 'Events',
        component: () => import('@/views/Events.vue'),
        meta: { title: '赛事活动管理', roles: ['SUPER_ADMIN', 'ADMIN'] }
      },
      {
        path: '/orders',
        name: 'Orders',
        component: () => import('@/views/Orders.vue'),
        meta: { title: '订单管理', roles: ['SUPER_ADMIN', 'ADMIN'] }
      },
      {
        path: '/users',
        name: 'Users',
        component: () => import('@/views/Users.vue'),
        meta: { title: '用户管理', roles: ['SUPER_ADMIN', 'ADMIN'] }
      },
      {
        path: '/gift-cards',
        name: 'GiftCards',
        component: () => import('@/views/GiftCards.vue'),
        meta: { title: '礼品卡管理', roles: ['SUPER_ADMIN'] }
      },
      {
        path: '/debug',
        name: 'DebugTest',
        component: () => import('@/views/DebugTest.vue'),
        meta: { title: '调试测试', requiresAuth: true }
      },
      ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore()
  const token = localStorage.getItem('token')

  if (to.meta.requiresAuth) {
    if (!token) {
      console.log('路由守卫: 无token，跳转登录页')
      next('/login')
      return
    }

    // 如果用户信息还没加载，先加载用户信息
    if (!userStore.user) {
      console.log('路由守卫: 用户信息未加载，尝试获取...')
      try {
        const userInfo = await userStore.getUserInfo()
        console.log('路由守卫: 用户信息获取成功:', userInfo.user)

        // 验证用户信息是否完整
        if (!userInfo.user || !userInfo.user.role) {
          console.error('路由守卫: 用户信息不完整:', userInfo)
          userStore.logout()
          next('/login')
          return
        }
      } catch (error) {
        console.error('路由守卫: 获取用户信息失败:', error)
        console.log('路由守卫: 清除token并跳转登录页')
        userStore.logout()
        next('/login')
        return
      }
    }

    console.log('路由守卫: 检查权限...')
    console.log('路由守卫: 用户角色:', userStore.user?.role)
    console.log('路由守卫: 需要权限:', to.meta.roles)

    // 检查角色权限
    if (to.meta.roles && !to.meta.roles.includes(userStore.user?.role)) {
      console.log('路由守卫: 权限不足')
      ElMessage.error(`权限不足。当前角色: ${userStore.user?.role}，需要: ${to.meta.roles?.join(', ')}`)
      next('/dashboard')
      return
    }

    console.log('路由守卫: 权限检查通过')
  }

  if (to.path === '/login' && token) {
    console.log('路由守卫: 已登录用户访问登录页，跳转首页')
    next('/dashboard')
    return
  }

  console.log('路由守卫: 导航到:', to.path)
  next()
})

export default router