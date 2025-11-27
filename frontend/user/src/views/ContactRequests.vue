<template>
  <div class="requests-page">
    <van-nav-bar title="新联系人申请" left-arrow @click-left="router.back()" />

    <van-tabs v-model:active="activeTab" type="card" @change="fetchRequests">
      <van-tab name="incoming" title="收到的" />
      <van-tab name="sent" title="我发出的" />
    </van-tabs>

    <van-list v-if="activeTab === 'incoming'">
      <van-cell
        v-for="group in groupedIncoming"
        :key="group.fromId"
        :class="cellClass(group.latest)"
        icon="friends-o"
        is-link
        @click="openHistory(group)"
        :title="group.displayName"
        :label="group.latest.message || '请求添加为联系人'"
      >
        <template #value>
          <span class="time">{{ formatDate(group.latest.createdAt) }}</span>
        </template>
        <template #right-icon>
          <div class="actions">
            <template v-if="group.pending">
              <van-button size="mini" @click.stop="handleAction(group.pending, 'ignore')">忽略</van-button>
              <van-button size="mini" type="danger" @click.stop="handleAction(group.pending, 'reject')">拒绝</van-button>
              <van-button size="mini" type="primary" @click.stop="handleAction(group.pending, 'accept')">同意</van-button>
            </template>
            <template v-else>
              <span class="status" :class="group.latest.status">{{ statusText(group.latest) }}</span>
            </template>
          </div>
        </template>
      </van-cell>
    </van-list>

    <van-list v-else>
      <van-cell
        v-for="req in requests"
        :key="req.id"
        :class="cellClass(req)"
        icon="friends-o"
        :title="displayName(req)"
        :label="req.message || '请求添加为联系人'"
      >
        <template #value>
          <span class="time">{{ formatDate(req.createdAt) }}</span>
        </template>
        <template #right-icon>
          <div class="actions">
            <span class="status" :class="req.status">{{ statusText(req) }}</span>
          </div>
        </template>
      </van-cell>
    </van-list>

    <div v-if="!requests.length" class="empty-wrap">
      <van-empty description="暂无申请" />
    </div>

    <van-popup
      v-model:show="showHistory"
      position="bottom"
      round
      :style="{ height: '60%' }"
      :close-on-click-overlay="true"
    >
      <div class="history-popup">
        <div class="popup-header">
          <span>{{ selectedGroup?.displayName }} 的申请记录</span>
          <van-icon name="close" @click="showHistory = false" />
        </div>
        <van-list>
          <van-cell
            v-for="req in (selectedGroup?.requests || [])"
            :key="req.id"
            :title="statusText(req)"
            :label="req.message || '无附加信息'"
          >
            <template #value>
              <span class="time">{{ formatDate(req.createdAt) }}</span>
            </template>
            <template #right-icon>
              <div class="actions" v-if="req.status === 'PENDING'">
                <van-button size="mini" @click.stop="handleAction(req, 'ignore')">忽略</van-button>
                <van-button size="mini" type="danger" @click.stop="handleAction(req, 'reject')">拒绝</van-button>
                <van-button size="mini" type="primary" @click.stop="handleAction(req, 'accept')">同意</van-button>
              </div>
            </template>
          </van-cell>
        </van-list>
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { showToast } from 'vant'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()
const requests = ref([])
const activeTab = ref('incoming')
const showHistory = ref(false)
const selectedGroup = ref(null)
const refreshTimer = ref(null)

const formatDate = (dateString) => {
  const d = new Date(dateString)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const displayName = (req) => {
  if (activeTab.value === 'incoming') return req.fromUser?.name || req.fromUser?.username || req.from
  return req.toUser?.name || req.toUser?.username || req.to
}

const fetchRequests = async () => {
  try {
    const headers = userStore.token ? { Authorization: `Bearer ${userStore.token}` } : {}
    const url = activeTab.value === 'incoming' ? '/api/messages/requests' : '/api/messages/requests/sent'
    const res = await axios.get(url, { headers })
    requests.value = res.data?.data || []
  } catch (e) {
    console.error('获取申请失败', e)
  }
}

const handleAction = async (reqObj, action) => {
  try {
    const headers = userStore.token ? { Authorization: `Bearer ${userStore.token}` } : {}
    await axios.post(`/api/messages/requests/${reqObj.id}/action`, { action }, { headers })
    showToast(action === 'accept' ? '已同意' : action === 'reject' ? '已拒绝' : '已忽略')
    await fetchRequests()
  } catch (e) {
    console.error('处理申请失败', e)
    showToast('操作失败')
  }
}

const statusText = (req) => {
  if (req.status === 'PENDING') return activeTab.value === 'incoming' ? '等待处理' : '等待对方处理'
  if (req.status === 'ACCEPTED') return '已同意'
  if (req.status === 'REJECTED') return '已拒绝'
  if (req.status === 'IGNORED') return '已忽略'
  return req.status
}

const cellClass = (req) => {
  return {
    'accepted-cell': req.status === 'ACCEPTED',
    'rejected-cell': req.status === 'REJECTED',
    'ignored-cell': req.status === 'IGNORED'
  }
}

const groupedIncoming = computed(() => {
  const groups = {}
  requests.value.forEach((req) => {
    if (!req.fromId) return
    if (!groups[req.fromId]) {
      groups[req.fromId] = { fromId: req.fromId, fromUser: req.fromUser, requests: [] }
    }
    groups[req.fromId].requests.push(req)
  })

  return Object.values(groups)
    .map((g) => {
      const sorted = [...g.requests].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      const latest = sorted[0]
      const pending = sorted.find((r) => r.status === 'PENDING')
      return {
        ...g,
        displayName: g.fromUser?.name || g.fromUser?.username || '未知用户',
        latest,
        pending,
        requests: sorted
      }
    })
    .sort((a, b) => new Date(b.latest.createdAt) - new Date(a.latest.createdAt))
})

const openHistory = (group) => {
  selectedGroup.value = group
  showHistory.value = true
}

onMounted(fetchRequests)

onMounted(() => {
  refreshTimer.value = setInterval(fetchRequests, 5000)
})

onBeforeUnmount(() => {
  if (refreshTimer.value) clearInterval(refreshTimer.value)
})
</script>

<style scoped>
.requests-page {
  min-height: 100vh;
  background: #f7f8fa;
  display: flex;
  flex-direction: column;
}
.van-tabs {
  margin: 8px;
}
.time {
  font-size: 12px;
  color: #999;
}
.actions {
  display: flex;
  gap: 6px;
  align-items: center;
}
.status {
  font-size: 13px;
  color: #999;
}
.status.ACCEPTED { color: #07c160; }
.status.REJECTED { color: #ee0a24; }
.status.IGNORED { color: #999; }
.accepted-cell { background: #e8f8ef; }
.accepted-cell :deep(.van-cell__title),
.accepted-cell :deep(.van-cell__label),
.accepted-cell :deep(.status) { color: #07c160; }
.rejected-cell { background: #ffecec; }
.rejected-cell :deep(.van-cell__title),
.rejected-cell :deep(.van-cell__label),
.rejected-cell :deep(.status) { color: #ee0a24; }
.ignored-cell { background: #f7f8fa; }
.empty-wrap {
  padding: 40px 0;
}
</style>
