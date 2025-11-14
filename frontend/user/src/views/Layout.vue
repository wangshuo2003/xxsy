<template>
  <div class="user-layout">
    <!-- 只在需要导航栏的页面显示 -->
    <van-nav-bar
      v-if="showNavBar"
      :title="currentRoute.meta?.title || '教育实践平台'"
      left-arrow
      @click-left="handleGoBack"
    />

<div class="user-content" ref="contentRef">
  <router-view />
</div>

    <van-tabbar v-model="active" route>
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
const contentRef = ref(null)
const currentRoute = computed(() => route)

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
    scrollContentToTop()
  }
)

onMounted(() => {
  scrollContentToTop()
})
</script>

<style scoped>
.user-layout {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.user-content {
  flex: 1;
  overflow-y: auto;
  background-color: #f7f8fa;
}

.user-layout :deep(.van-tabbar__item) {
  font-weight: 600 !important;
}
</style>
