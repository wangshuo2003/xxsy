import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录' }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/Register.vue'),
    meta: { title: '注册' }
  },
  {
    path: '/forgot-password',
    name: 'ForgotPassword',
    component: () => import('@/views/ForgotPassword.vue'),
    meta: { title: '忘记密码' }
  },
  {
    path: '/',
    name: 'Layout',
    component: () => import('@/views/Layout.vue'),
    redirect: '/home',
    children: [
      {
        path: '/home',
        name: 'Home',
        component: () => import('@/views/Home.vue'),
        meta: { title: '首页' }
      },
      {
        path: '/policies',
        name: 'Policies',
        component: () => import('@/views/Policies.vue'),
        meta: { title: '政策通知' }
      },
      {
        path: '/policy/:id',
        name: 'PolicyDetail',
        component: () => import('@/views/PolicyDetail.vue'),
        meta: { title: '政策通知详情' }
      },
      {
        path: '/bases',
        name: 'Bases',
        component: () => import('@/views/Bases.vue'),
        meta: { title: '基地展示', requiresAuth: true, roles: ['SUPER_ADMIN', 'ADMIN'] }
      },
      {
        path: '/base/:id',
        name: 'BaseDetail',
        component: () => import('@/views/BaseDetail.vue'),
        meta: { title: '基地详情', requiresAuth: true, roles: ['SUPER_ADMIN', 'ADMIN'] }
      },
      {
        path: '/achievements',
        name: 'Achievements',
        component: () => import('@/views/Achievements.vue'),
        meta: { title: '成果展示' }
      },
      {
        path: '/achievement/:id',
        name: 'AchievementDetail',
        component: () => import('@/views/AchievementDetail.vue'),
        meta: { title: '成果详情' }
      },
      {
        path: '/profile',
        name: 'Profile',
        component: () => import('@/views/Profile.vue'),
        meta: { title: '个人中心', requiresAuth: true }
      },
      {
        path: '/favorites',
        redirect: '/favorites/activities'
      },
      {
        path: '/favorites/activities',
        name: 'ActivityFavorites',
        component: () => import('@/views/Favorites.vue'),
        props: { initialType: 'activity' },
        meta: { title: '活动收藏', requiresAuth: true }
      },
      {
        path: '/favorites/policies',
        name: 'PolicyFavorites',
        component: () => import('@/views/Favorites.vue'),
        props: { initialType: 'policy' },
        meta: { title: '通知收藏', requiresAuth: true }
      },
      {
        path: '/base-application',
        name: 'BaseApplication',
        component: () => import('@/views/BaseApplication.vue'),
        meta: { title: '基地申请', requiresAuth: true, roles: ['SUPER_ADMIN', 'ADMIN'] }
      },
      {
        path: '/events',
        name: 'Events',
        component: () => import('@/views/Events.vue'),
        meta: { title: '赛事活动' }
      },
      {
        path: '/events/:id',
        name: 'EventDetail',
        component: () => import('@/views/EventDetail.vue'),
        meta: { title: '活动详情' }
      },
      {
        path: '/activities',
        name: 'Activities',
        component: () => import('@/views/Activities.vue'),
        meta: { title: '活动中心' }
      },
      {
        path: '/activities/search',
        name: 'ActivitySearch',
        component: () => import('@/views/ActivitySearch.vue'),
        meta: { title: '搜索结果' }
      },
      {
        path: '/activity/:id',
        name: 'ActivityDetail',
        component: () => import('@/views/ActivityDetail.vue'),
        meta: { title: '活动详情' }
      },
      {
        path: '/my-activities',
        name: 'MyActivities',
        component: () => import('@/views/MyActivities.vue'),
        meta: { title: '我的活动', requiresAuth: true }
      },
      {
        path: '/payment',
        name: 'Payment',
        component: () => import('@/views/Payment.vue'),
        meta: { title: '确认支付', requiresAuth: true }
      },
      {
        path: '/balance',
        name: 'Balance',
        component: () => import('@/views/Balance.vue'),
        meta: { title: '我的余额', requiresAuth: true }
      },
      {
        path: '/orders',
        name: 'Orders',
        component: () => import('@/views/Orders.vue'),
        meta: { title: '我的订单', requiresAuth: true }
      }
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
      next('/login')
      return
    }

    if (!userStore.user) {
      try {
        await userStore.getUserInfo()
      } catch (error) {
        console.error('路由守卫: 获取用户信息失败:', error)
        next('/login')
        return
      }
    }

    if (to.meta.roles && !to.meta.roles.includes(userStore.user?.role)) {
      next('/home')
      return
    }
  }

  if (to.path === '/login' && token) {
    next('/home')
    return
  }

  next()
})

export default router
