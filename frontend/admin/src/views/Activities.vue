<template>
  <div class="activities-management">
    <el-card class="content-card">
      <!-- 加载状态 -->
      <div v-if="!isPageReady" class="loading-container">
        <div class="loading-spinner"></div>
        <div class="loading-text">正在加载活动管理...</div>
      </div>

      <!-- 标签页 -->
      <el-tabs v-model="activeTab" @tab-change="handleTabChange" v-if="isPageReady">
        <!-- 待审核活动 -->
        <el-tab-pane label="待审核活动" name="pending" v-if="['SUPER_ADMIN', 'ADMIN'].includes(userStore.user?.role)">
          <PendingActivities @refresh="loadPendingActivities" />
        </el-tab-pane>

        <!-- 已通过活动 -->
        <el-tab-pane label="已通过活动" name="approved">
          <ApprovedActivities @refresh="loadApprovedActivities" />
        </el-tab-pane>

      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import PendingActivities from '@/components/activities/PendingActivities.vue'
import ApprovedActivities from '@/components/activities/ApprovedActivities.vue'

const userStore = useUserStore()
const route = useRoute()
const router = useRouter()
const activeTab = ref('pending')
const isPageReady = ref(false)

const handleTabChange = (tabName) => {
  activeTab.value = tabName
  // 更新URL查询参数
  router.push({
    path: '/activities',
    query: { tab: tabName }
  })
}

const loadPendingActivities = () => {
  // 待审核活动会自动加载
}

const loadApprovedActivities = () => {
  // 已通过活动会自动加载
}

onMounted(() => {
  // 延迟设置页面准备状态，防止闪动
  setTimeout(() => {
    isPageReady.value = true

    // 从URL查询参数中读取标签页状态
    const urlTab = route.query.tab
    if (urlTab && ['pending', 'approved'].includes(urlTab)) {
      // 检查用户是否有权限访问该标签页
      if (urlTab === 'pending' && ['SUPER_ADMIN', 'ADMIN'].includes(userStore.user?.role)) {
        activeTab.value = urlTab
      } else if (urlTab === 'approved') {
        activeTab.value = urlTab
      } else {
        // 如果没有权限，使用默认标签页
        setDefaultTab()
      }
    } else {
      // 如果URL中没有指定标签页，使用默认标签页
      setDefaultTab()
    }
  }, 100)
})

// 设置默认标签页的辅助函数
const setDefaultTab = () => {
  if (['SUPER_ADMIN', 'ADMIN'].includes(userStore.user?.role)) {
    activeTab.value = 'pending'
  } else {
    activeTab.value = 'approved'
  }
}
</script>

<style scoped>
.activities-management {
  padding: 0;
}

.content-card {
  min-height: 600px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  color: #909399;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #409EFF;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

.loading-text {
  font-size: 16px;
  margin-bottom: 8px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

:deep(.el-tabs__content) {
  padding: 20px 0;
}
</style>
