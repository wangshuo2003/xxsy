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
            :label="item.label"
            @click="item.onClick"
          >
            <template #value>
              <span class="time">{{ item.time }}</span>
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
        <van-cell title="添加联系人" icon="add-o" is-link @click="handleAddFriend" />
        <van-cell title="返回首页" icon="home-o" is-link to="/home" />
      </div>
    </div>

    <van-tabbar v-model="activeTab" active-color="#1989fa" inactive-color="#999">
      <van-tabbar-item name="messages" icon="chat-o">消息</van-tabbar-item>
      <van-tabbar-item name="contacts" icon="friends-o">联系人</van-tabbar-item>
      <van-tabbar-item name="more" icon="ellipsis">更多</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()
const activeTab = ref('messages')

const chats = ref([
  { id: 'super-admin', title: '与超级管理员聊天', desc: '证书、订单与系统通知' },
  { id: 'base-admin', title: '与基地管理员聊天', desc: '咨询基地活动与安排' }
])
const contacts = ref([])
const threads = ref({})

const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const mapOrderStatus = (status) => {
  const statusMap = {
    'PENDING': '待支付',
    'PAID': '已支付',
    'CANCELLED': '已取消',
    'REFUNDING': '退款处理中',
    'REFUNDED': '已退款'
  }
  return statusMap[status] || status || '订单更新'
}

const goChat = (chat) => {
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

const goRequests = () => {
  router.push('/messages/contacts/requests')
}

onMounted(() => {
  // 初始 tab 与路由同步
  const path = router.currentRoute.value.path
  const queryTab = router.currentRoute.value.query.tab
  if (path.startsWith('/messages/contacts')) activeTab.value = 'contacts'
  else if (queryTab === 'more') activeTab.value = 'more'
  else activeTab.value = 'messages'

  loadThreads()
  ensureSystemNotifications()
  fetchContacts()
  syncRouteWithTab(activeTab.value)
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

  const getLastFromThread = (id) => {
    const list = threads.value[id] || []
    if (!list.length) return null
    const last = list[list.length - 1]
    return { text: last.text, time: last.time || last.createdAt }
  }

  chats.value.forEach(chat => {
    const last = getLastFromThread(chat.id)
    items.push({
      id: chat.id,
      icon: chat.id === 'super-admin' ? 'service-o' : 'chat-o',
      title: chat.title,
      label: last?.text || chat.desc,
      time: last?.time ? formatDate(last.time) : '随时',
      lastTS: last?.time ? new Date(last.time).getTime() : 0,
      onClick: () => goChat(chat)
    })
  })

  contacts.value.forEach(contact => {
    const last = getLastFromThread(contact.id)
    const lastTime = last?.time || contact.updatedAt || new Date().toISOString()
    items.push({
      id: contact.id,
      icon: 'user-o',
      title: contact.name,
      label: last?.text || contact.lastMessage || '点击进入聊天',
      time: formatDate(lastTime),
      lastTS: new Date(lastTime).getTime(),
      onClick: () => goChat(contact)
    })
  })

  return items.sort((a, b) => (b.lastTS || 0) - (a.lastTS || 0))
})

const fetchContacts = async () => {
  try {
    const res = await axios.get('/api/messages/contacts', {
      params: { limit: 20 },
      headers: userStore.token ? { Authorization: `Bearer ${userStore.token}` } : {}
    })
    const list = Array.isArray(res?.data?.data) ? res.data.data : []
    contacts.value = list.map(item => ({
      id: item.id || item.contactId || item.userId || item.name,
      name: item.name || item.nickname || '好友',
      lastMessage: item.lastMessage || item.preview,
      updatedAt: item.updatedAt || item.lastTime
    }))
  } catch (err) {
    console.error('获取联系人失败', err)
  }
}

const contactsList = computed(() => contacts.value)

const STORAGE_KEY = 'chatThreads'

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

const appendMessages = (id, msgs) => {
  if (!threads.value[id]) threads.value[id] = []
  const arr = threads.value[id]
  msgs.forEach(m => arr.push(m))
  saveThreads()
}

const ensureSystemNotifications = async () => {
  try {
    const headers = userStore.token ? { Authorization: `Bearer ${userStore.token}` } : {}
    const [certRes, orderRes] = await Promise.allSettled([
      axios.get('/api/certificates/my?limit=3', { headers }),
      axios.get('/api/orders', { params: { limit: 3, sortBy: 'updatedAt' }, headers })
    ])

    const msgs = []
    if (certRes.status === 'fulfilled') {
      const list = certRes.value.data?.data || []
      list.forEach(c => {
        msgs.push({
          from: 'them',
          text: `您获得新证书：${c.title}`,
          time: (c.issueDate || c.createdAt || new Date()).toString()
        })
      })
    }
    if (orderRes.status === 'fulfilled') {
      const list = Array.isArray(orderRes.value?.data?.data) ? orderRes.value.data.data : []
      list.forEach(o => {
        msgs.push({
          from: 'them',
          text: `订单 ${o.orderNo} 状态更新：${mapOrderStatus(o.status)}`,
          time: (o.updatedAt || o.createdAt || new Date()).toString()
        })
      })
    }
    if (msgs.length) {
      appendMessages('super-admin', msgs)
    }
  } catch (e) {
    console.error('同步系统通知失败', e)
  }
}
</script>

<style scoped>
.messages-page {
  min-height: 100vh;
  background: #f7f8fa;
  display: flex;
  flex-direction: column;
}

.content {
  flex: 1 1 auto;
  overflow-y: auto;
}

.time {
  font-size: 12px;
  color: #999;
}

.empty-wrap {
  padding: 40px 0;
}

.more-panel {
  padding: 8px 0;
}
</style>
