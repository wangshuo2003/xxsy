<template>
  <div
    class="user-layout"
    :class="{
      'has-policies-pagination': isPoliciesPage,
      'has-nav-bar': showNavBar,
      'no-tabbar': !showTabbar
    }"
  >
    <!-- 只在需要导航栏的页面显示 -->
    <van-nav-bar
      v-if="showNavBar"
      :title="currentRoute.meta?.title || '教育实践平台'"
      left-arrow
      @click-left="handleGoBack"
    />

    <div id="page-bottom-controls" class="page-bottom-controls"></div>

    <div class="user-main">
      <div class="user-content" ref="contentRef" id="user-content">
        <router-view />
      </div>
      <div id="policies-pagination-anchor" class="policies-pagination-anchor"></div>
    </div>

    <van-tabbar v-if="showTabbar" v-model="active" active-color="#1989fa" @change="handleTabChange">
      <van-tabbar-item to="/home" icon="home-o">首页</van-tabbar-item>
      <van-tabbar-item to="/policies" icon="orders-o">通知</van-tabbar-item>
      <van-tabbar-item to="/activities" icon="medal-o">活动</van-tabbar-item>
      <van-tabbar-item to="/profile" icon="user-o">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showConfirmDialog, showSuccessToast } from 'vant'

const route = useRoute()
const router = useRouter()

const active = ref(0)
const tabRoutes = ['/home', '/policies', '/activities', '/profile']
const contentRef = ref(null)
const currentRoute = computed(() => route)
const isPoliciesPage = computed(() => route.path.startsWith('/policies'))
const hideTabbarPages = ['/messages', '/chat', '/contacts/add']
const showTabbar = computed(() => !hideTabbarPages.some(p => route.path.startsWith(p)))

// 需要显示导航栏的页面列表
const showNavBar = computed(() => {
  // 只在详情页面显示导航栏
  const pagesWithNavBar = [
    '/policy/',
    '/base/',
    '/achievement/',
    '/activity/',
    '/event/',
    '/activities/search',
    '/base-application',
    '/my-activities',
    '/achievements',
    '/favorites'
  ]

  const currentPath = route.path
  return pagesWithNavBar.some(path => currentPath.includes(path))
})

const handleGoBack = () => {
  if (window.history.length > 1) {
    router.go(-1)
  } else {
    router.push('/home')
  }
}

const updateActiveByRoute = () => {
  const path = route.path
  if (path.startsWith('/home')) {
    active.value = 0
    return
  }
  if (path.startsWith('/policies') || path.startsWith('/policy')) {
    active.value = 1
    return
  }
  if (path.startsWith('/activities') || path.startsWith('/activity')) {
    active.value = 2
    return
  }
  // 默认归为“我的”标签，覆盖 orders/profile/balance 等
  active.value = 3
}

const handleTabChange = (index) => {
  const target = tabRoutes[index] || '/profile'
  if (route.path !== target) {
    router.push(target)
  }
}

const scrollContentToTop = () => {
  nextTick(() => {
    const el = contentRef.value
    if (el) {
      if (typeof el.scrollTo === 'function') {
        el.scrollTo({ top: 0, behavior: 'auto' })
      } else {
        el.scrollTop = 0
      }
    }
    if (typeof window !== 'undefined' && window.scrollY > 0) {
      window.scrollTo({ top: 0, behavior: 'auto' })
    }
  })
}

watch(
  () => route.fullPath,
  () => {
    updateActiveByRoute()
    scrollContentToTop()
  }
)

onMounted(() => {
  updateActiveByRoute()
  scrollContentToTop()
})
</script>

<style scoped>
.user-layout {
  height: 100vh;
  display: flex;
  flex-direction: column;
  --tabbar-height: 60px;
  --navbar-height: 46px;
}

.user-main {
  flex: 1 1 auto;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  min-height: 0;
  height: calc(100vh - var(--tabbar-height) - env(safe-area-inset-bottom));
}

.user-layout.has-nav-bar .user-main {
  height: calc(100vh - var(--tabbar-height) - var(--navbar-height) - env(safe-area-inset-bottom));
}

.user-layout.no-tabbar .user-main {
  height: calc(100vh - env(safe-area-inset-bottom));
}

.user-layout.no-tabbar.has-nav-bar .user-main {
  height: calc(100vh - var(--navbar-height) - env(safe-area-inset-bottom));
}

.user-content {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  background-color: #f7f8fa;
  padding: 0;
}

:deep(#user-content > div) {
  display: contents;
  padding: 0;
}

:deep(#user-content > div > div) {
  padding: 0;
  min-height: auto;
  height: auto;
}

:deep(#policies-pagination-anchor > div) {
  position: static;
  width: 100%;
}

.policies-pagination-anchor {
  display: none;
}

.user-layout.has-policies-pagination .policies-pagination-anchor {
  display: block;
  min-height: 72px;
  position: sticky;
  bottom: calc(var(--tabbar-height) + env(safe-area-inset-bottom));
  z-index: 1800;
  background-color: #fff;
  padding: 10px 16px;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.04);
  display: flex;
  align-items: center;
}

:deep(#policies-pagination-anchor > div) {
  background-color: transparent;
  box-shadow: none;
  padding: 0;
  margin: 0;
}

.page-bottom-controls {
  position: sticky;
  bottom: calc(var(--tabbar-height) + env(safe-area-inset-bottom));
  z-index: 2000;
}

.user-layout :deep(.van-tabbar__item) {
  font-weight: 600 !important;
}

:global(html, body) {
  height: 100%;
  margin: 0;
  overflow: hidden;
}

:global(body) {
  overflow: hidden !important;
}

:global(#app) {
  height: 100vh;
}

:global(.van-tabbar) {
  height: var(--tabbar-height);
  padding-bottom: env(safe-area-inset-bottom);
  box-sizing: content-box;
}

:deep(#user-content > div > div.van-nav-bar.van-hairline--bottom) {
  border-bottom: none !important;
}

:deep(#user-content > div > div.van-nav-bar.van-hairline--bottom)::after {
  display: none !important;
}
</style>
