<template>
  <div class="messages-page">
    <van-nav-bar title="消息中心" left-arrow @click-left="handleBack">
      <template #right>
        <van-icon name="add-o" size="20" @click="handleAddFriend" />
      </template>
    </van-nav-bar>

    <div class="content">
      <div v-if="activeTab === 'messages'">
        <van-list>
          <van-cell
            v-for="item in recentContacts"
            :key="item.id"
            :icon="item.icon"
            is-link
            :title="item.title"
            @click="item.onClick"
          >
            <template #label>
              <span :class="['label-text', item.isUnread ? 'unread' : '']">{{ item.label }}</span>
            </template>
            <template #value>
              <span :class="['time', item.isUnread ? 'unread' : '']">{{ item.time }}</span>
            </template>
          </van-cell>
        </van-list>
        <div v-if="!recentContacts.length" class="empty-wrap">
          <van-empty description="暂无消息" />
        </div>
      </div>

      <div v-else-if="activeTab === 'contacts'">
        <van-cell title="朋友申请" icon="envelop-o" is-link @click="goRequests" />
        <van-list>
          <van-cell
            v-for="contact in contactsList"
            :key="contact.id"
            icon="user-o"
            is-link
            :title="contact.name"
            :label="contact.lastMessage || '点击进入聊天'"
            @click="goChat(contact)"
          >
            <template #value>
              <span class="time">{{ formatDate(contact.updatedAt || new Date()) }}</span>
            </template>
          </van-cell>
        </van-list>
        <div v-if="!contactsList.length" class="empty-wrap">
          <van-empty description="暂无联系人" />
        </div>
      </div>

      <div v-else class="more-panel">
        <van-cell title="设置" icon="setting-o" is-link to="/messages/settings" />
        <van-cell title="我的信息" icon="user-o" is-link to="/messages/me" />
        <van-cell title="添加联系人" icon="add-o" is-link @click="handleAddFriend" />
        <van-cell title="返回首页" icon="home-o" is-link to="/home" />
      </div>
    </div>

    <van-tabbar v-model="activeTab" active-color="#1989fa" inactive-color="#999" :style="tabbarStyle">
      <van-tabbar-item name="messages" icon="chat-o" :badge="messagesBadge">消息</van-tabbar-item>
      <van-tabbar-item name="contacts" icon="friends-o" :badge="contactsBadge">联系人</van-tabbar-item>
      <van-tabbar-item name="more" icon="ellipsis">更多</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { useUserStore } from '@/stores/user'
import { getRemarks } from '@/utils/remarks'

const router = useRouter()
const userStore = useUserStore()
const activeTab = ref('messages')
const tabbarStyle = { height: '60px', paddingBottom: 'env(safe-area-inset-bottom)' }
const unreadCount = ref(0)
const pendingRequestCount = ref(0)
const THREAD_KEEP = 100
const SORT_STORAGE = 'contact_sort_pref'
let pollTimer = null

const chats = ref([])
const contacts = ref([])
const threads = ref({})
const readMap = ref({})
const deletedSet = ref(new Set())
const mutedSet = ref(new Set())
const remarks = ref(getRemarks())

const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const goChat = (chat) => {
  // 进入聊天视为已读
  markAsRead(chat.id)
  router.push({ path: '/chat', query: { with: chat.id, name: chat.title } })
}

const syncRouteWithTab = (val) => {
  if (val === 'contacts') {
    router.replace('/messages/contacts')
  } else if (val === 'more') {
    router.replace({ path: '/messages', query: { tab: 'more' } })
  } else {
    router.replace('/messages')
  }
}

const handleBack = () => router.back()

const handleAddFriend = () => {
  router.push('/contacts/add')
}

const refreshRemarks = () => {
  remarks.value = getRemarks()
}

const goRequests = () => {
  router.push('/messages/contacts/requests')
}

// 排序设置
const sortPref = ref(loadSortPref())
function loadSortPref() {
  try {
    const raw = localStorage.getItem(SORT_STORAGE)
    if (raw) return JSON.parse(raw)
  } catch (_) {}
  return { field: 'updatedAt', order: 'desc' }
}
window.addEventListener('contact-sort-changed', (e) => {
  if (e?.detail) {
    sortPref.value = e.detail
    fetchContacts()
  }
})

onMounted(() => {
  // 初始 tab 与路由同步
  const path = router.currentRoute.value.path
  const queryTab = router.currentRoute.value.query.tab
  if (path.startsWith('/messages/contacts')) activeTab.value = 'contacts'
  else if (queryTab === 'more') activeTab.value = 'more'
  else activeTab.value = 'messages'

  loadThreads()
  loadReadMap()
  loadDeleted()
  loadMuted()
  refreshRemarks()
  syncRouteWithTab(activeTab.value)

  const start = () => {
    fetchContacts()
    fetchPendingRequests()
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = setInterval(() => {
      fetchContacts()
      fetchPendingRequests()
    }, 3000)
  }

  if (userStore.token) {
    start()
  }

  // 登录后再启动轮询
  watch(() => userStore.token, (val) => {
    if (val) start()
  }, { immediate: false })

  window.addEventListener('remark-updated', refreshRemarks)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
  window.removeEventListener('remark-updated', refreshRemarks)
})

watch(
  () => activeTab.value,
  (val) => {
    if (val === 'messages' || val === 'contacts') {
      fetchContacts()
    }
    syncRouteWithTab(val)
  }
)

const recentContacts = computed(() => {
  const items = []
  const existing = new Set()

  const getLastFromThread = (id) => {
    const list = threads.value[id] || []
    if (!list.length) return null
    const last = list[list.length - 1]
    return { text: last.text, time: last.time || last.createdAt }
  }

  contacts.value.forEach(contact => {
    existing.add(contact.id)
    const last = getLastFromThread(contact.id)
    const lastTime = last?.time || contact.updatedAt || new Date().toISOString()
    const displayName = remarks.value[contact.id] || contact.name
    items.push({
      id: contact.id,
      icon: 'user-o',
      title: displayName,
      label: last?.text || contact.lastMessage || '点击进入聊天',
      isUnread: Boolean(contact.isUnread),
      time: formatDate(lastTime),
      lastTS: new Date(lastTime).getTime(),
      onClick: () => goChat({ ...contact, name: displayName, title: displayName })
    })
  })

  // 允许在删除联系人但选择保留聊天记录时，仍在消息列表展示本地会话
  Object.entries(threads.value).forEach(([id, arr]) => {
    if (existing.has(id) || !arr.length) return
    const last = arr[arr.length - 1]
    const lastTime = last?.time || last?.createdAt || new Date().toISOString()
    items.push({
      id,
      icon: 'user-o',
      title: remarks.value[id] || id,
      label: last?.text || '点击进入聊天',
      isUnread: computeUnread(id, new Date(lastTime).getTime()),
      time: formatDate(lastTime),
      lastTS: new Date(lastTime).getTime(),
      onClick: () => goChat({ id, title: id })
    })
  })

  return items.sort((a, b) => (b.lastTS || 0) - (a.lastTS || 0))
})

const messagesBadge = computed(() => {
  if (!unreadCount.value) return ''
  return unreadCount.value > 99 ? '99+' : String(unreadCount.value)
})

const contactsBadge = computed(() => {
  if (!pendingRequestCount.value) return ''
  return pendingRequestCount.value > 99 ? '99+' : String(pendingRequestCount.value)
})

const fetchContacts = async () => {
  try {
    const res = await axios.get('/api/messages/contacts', {
      params: {
        limit: 20,
        sortBy: sortPref.value.field || 'updatedAt',
        order: sortPref.value.order || 'desc'
      },
      headers: userStore.token ? { Authorization: `Bearer ${userStore.token}` } : {}
    })
    let list = Array.isArray(res?.data?.data) ? res.data.data : []

    // 如果后端已经重新返回了曾被本地标记删除的联系人，说明双方重新建立了联系，此处自动解除本地删除标记并恢复显示
    list = list.filter(item => {
      const id = item.id || item.contactId || item.userId
      if (!id) return false
      if (deletedSet.value.has(id)) {
        deletedSet.value.delete(id)
        saveDeleted()
      }
      return true
    })

    const enriched = await Promise.all(
      list.map(async (item) => {
        const id = item.id || item.contactId || item.userId || item.name
        if (!id) return null

        const base = {
          id,
          name: item.name || item.nickname || '好友',
          lastMessage: item.lastMessage || item.preview,
          updatedAt: item.updatedAt || item.lastTime,
          isUnread: false
        }

        let serverLastTS = base.updatedAt ? new Date(base.updatedAt).getTime() : 0

        try {
          // 拉取该会话最新消息，不依赖后端排序，前端自行取最大时间
          const resMsg = await axios.get(`/api/messages/contacts/${encodeURIComponent(id)}/messages`, {
            params: { limit: 20 },
            headers: userStore.token ? { Authorization: `Bearer ${userStore.token}` } : {}
          })
          const msgs = Array.isArray(resMsg?.data?.data) ? resMsg.data.data : []
          if (msgs.length) {
            const latest = msgs.reduce((acc, cur) => {
              if (!acc) return cur
              const a = new Date(acc.createdAt || acc.time || 0).getTime()
              const b = new Date(cur.createdAt || cur.time || 0).getTime()
              return b >= a ? cur : acc
            }, null)

            base.lastMessage = latest?.content || latest?.text || base.lastMessage
            base.updatedAt = latest?.createdAt || latest?.time || base.updatedAt
            serverLastTS = base.updatedAt ? new Date(base.updatedAt).getTime() : serverLastTS
            base.isUnread =
              latest?.fromId !== userStore.user?.id && computeUnread(id, serverLastTS)

            const arr = Array.isArray(threads.value[id]) ? [...threads.value[id]] : []
            const ts = new Date(base.updatedAt || Date.now()).getTime()
            const last = arr[arr.length - 1]
            const lastTs = last?.time ? new Date(last.time).getTime() : 0
            if (!last || ts > lastTs) {
              arr.push({
                from: latest?.fromId === userStore.user?.id ? 'me' : 'them',
                text: base.lastMessage,
                time: base.updatedAt || new Date().toISOString()
              })
              if (arr.length > THREAD_KEEP) arr.splice(0, arr.length - THREAD_KEEP)
              threads.value[id] = arr
            }
          }
        } catch (e) {
          console.warn('拉取最新消息失败', id, e?.response?.status || e)
        }

        base.isUnread = computeUnread(id, serverLastTS)
        return base
      })
    )

    contacts.value = sortContacts(
      enriched
        .filter(Boolean)
        .filter(item => {
          // 若服务器已返回该联系人，视为有效，移除本地删除标记（说明已重新建立联系）
          if (item?.id && deletedSet.value.has(item.id)) {
            deletedSet.value.delete(item.id)
            saveDeleted()
          }
          const isPresetAdmin = ['super-admin', 'base-admin'].includes(item.id)
          return !isPresetAdmin || !!item.lastMessage
        })
    )

    unreadCount.value = contacts.value.filter(c => c.isUnread).length

    saveThreads()
  } catch (err) {
    console.error('获取联系人失败', err)
  }
}

const sortContacts = (list) => {
  const arr = [...list]
  const field = sortPref.value.field || 'updatedAt'
  const orderFlag = (sortPref.value.order || 'desc') === 'asc' ? 1 : -1
  const getKey = (c) => {
    if (field === 'name') return (c.name || c.username || '').toLowerCase()
    if (field === 'createdAt') return c.createdAt || c.created_at || 0
    return c.updatedAt || c.updated_at || c.lastMessageAt || 0
  }
  arr.sort((a, b) => {
    const ka = getKey(a)
    const kb = getKey(b)
    if (ka == null && kb == null) return 0
    if (ka == null) return 1
    if (kb == null) return -1
    if (typeof ka === 'string' && typeof kb === 'string') return ka.localeCompare(kb) * orderFlag
    return (new Date(ka).getTime() - new Date(kb).getTime()) * orderFlag
  })
  return arr
}

const fetchPendingRequests = async () => {
  try {
    const res = await axios.get('/api/messages/requests', {
      headers: userStore.token ? { Authorization: `Bearer ${userStore.token}` } : {},
      validateStatus: () => true
    })
    const list = Array.isArray(res?.data?.data) ? res.data.data : []
    pendingRequestCount.value = list.filter(r => r.status === 'PENDING').length
  } catch (e) {
    console.warn('获取好友申请失败', e)
  }
}

const contactsList = computed(() =>
  contacts.value.map(c => ({
    ...c,
    name: remarks.value[c.id] || c.name
  }))
)

const STORAGE_KEY = 'chatThreads'
const READ_KEY = 'chatReadAt'
const DELETED_KEY = 'deletedContacts'
const MUTED_KEY = 'mutedContacts'

const loadThreads = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    threads.value = raw ? JSON.parse(raw) : {}
  } catch (e) {
    threads.value = {}
  }
}

const saveThreads = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(threads.value))
  } catch (e) {
    console.error('保存会话失败', e)
  }
}

const loadReadMap = () => {
  try {
    const raw = localStorage.getItem(READ_KEY)
    readMap.value = raw ? JSON.parse(raw) : {}
  } catch (e) {
    readMap.value = {}
  }
}

const saveReadMap = () => {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(readMap.value))
  } catch (e) {
    console.error('保存已读状态失败', e)
  }
}

const loadDeleted = () => {
  try {
    const raw = localStorage.getItem(DELETED_KEY)
    const arr = raw ? JSON.parse(raw) : []
    deletedSet.value = new Set(arr)
  } catch (e) {
    deletedSet.value = new Set()
  }
}

const loadMuted = () => {
  try {
    const raw = localStorage.getItem(MUTED_KEY)
    const arr = raw ? JSON.parse(raw) : []
    mutedSet.value = new Set(arr)
  } catch (e) {
    mutedSet.value = new Set()
  }
}

const saveDeleted = () => {
  try {
    localStorage.setItem(DELETED_KEY, JSON.stringify(Array.from(deletedSet.value)))
  } catch (e) {
    console.error('保存删除联系人失败', e)
  }
}

const saveMuted = () => {
  try {
    localStorage.setItem(MUTED_KEY, JSON.stringify(Array.from(mutedSet.value)))
  } catch (e) {
    console.error('保存免打扰失败', e)
  }
}

const markAsRead = (id) => {
  if (!id) return
  readMap.value[id] = Date.now()
  saveReadMap()
}

const computeUnread = (id, ts) => {
  if (mutedSet.value.has(id)) return false
  if (!ts) return false
  const readTs = readMap.value[id] || 0
  return ts > readTs
}

const appendMessages = (id, msgs) => {
  if (!threads.value[id]) threads.value[id] = []
  const arr = threads.value[id]
  msgs.forEach(m => arr.push(m))
  saveThreads()
}

// 已移除系统通知写入本地“超级管理员”会话，避免出现占位对话
</script>

<style scoped>
.messages-page {
  min-height: 100vh;
  background: #f7f8fa;
  display: flex;
  flex-direction: column;
}

:deep(.van-tabbar) {
  height: 60px;
  padding-bottom: env(safe-area-inset-bottom);
}

:deep(.van-tabbar-item__icon) {
  font-size: 22px;
}

.content {
  flex: 1 1 auto;
  overflow-y: auto;
}

.time {
  font-size: 12px;
  color: #999;
}

.label-text {
  color: #666;
}

.unread {
  color: #07c160;
  font-weight: 600;
}

.empty-wrap {
  padding: 40px 0;
}

.more-panel {
  padding: 8px 0;
}
</style>
