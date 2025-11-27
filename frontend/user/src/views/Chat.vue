<template>
  <div class="chat-page">
    <van-nav-bar :title="contactName" left-arrow @click-left="handleBack" />

    <div class="chat-body" ref="listRef">
      <div
        v-for="(msg, idx) in messages"
        :key="idx"
        :class="['bubble-row', msg.from === 'me' ? 'mine' : 'theirs']"
      >
        <div class="bubble">
          <div class="text">{{ msg.text }}</div>
          <div class="time">{{ formatTime(msg.time) }}</div>
        </div>
      </div>

      <div v-if="loading" class="loading">
        <van-loading size="20px">加载中...</van-loading>
      </div>
    </div>

    <div class="chat-input">
      <van-field
        v-model="draft"
        placeholder="输入消息"
        clearable
        @keyup.enter="sendMessage"
      />
      <van-button type="primary" size="small" @click="sendMessage">发送</van-button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { showToast } from 'vant'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const contactId = route.query.with || 'super-admin'
const contactName = route.query.name || mapContactName(contactId)

const messages = ref([])
const draft = ref('')
const loading = ref(false)
const listRef = ref(null)
const headers = computed(() => (userStore.token ? { Authorization: `Bearer ${userStore.token}` } : {}))

function mapContactName(id) {
  if (id === 'super-admin') return '超级管理员'
  if (id === 'base-admin') return '基地管理员'
  return route.query.name || '好友'
}

const formatTime = (t) => {
  const d = new Date(t)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${mi}`
}

const scrollToBottom = () => {
  nextTick(() => {
    const el = listRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

const sendMessage = async () => {
  const text = draft.value.trim()
  if (!text) return
  draft.value = ''
  try {
    const res = await axios.post(
      `/api/messages/contacts/${encodeURIComponent(contactId)}/messages`,
      { content: text },
      { headers: headers.value }
    )
    messages.value.push({
      from: 'me',
      text,
      time: res.data?.message?.createdAt || new Date().toISOString()
    })
    persistThread()
    scrollToBottom()
  } catch (e) {
    console.error('发送消息失败', e)
    showToast('发送失败')
  }
}

const loadMessagesFromServer = async () => {
  loading.value = true
  try {
    const res = await axios.get(`/api/messages/contacts/${encodeURIComponent(contactId)}/messages`, {
      headers: headers.value
    })
    messages.value = (res.data?.data || []).map(m => ({
      from: m.fromId === userStore.user?.id ? 'me' : 'them',
      text: m.content,
      time: m.createdAt
    }))
    persistThread()
  } catch (e) {
    console.error('加载消息失败', e)
    showToast('加载消息失败')
  } finally {
    loading.value = false
    scrollToBottom()
  }
}

const mapOrderStatus = (status) => {
  const statusMap = {
    PENDING: '待支付',
    PAID: '已支付',
    CANCELLED: '已取消',
    REFUNDING: '退款处理中',
    REFUNDED: '已退款'
  }
  return statusMap[status] || status || '订单更新'
}

onMounted(() => {
  loadFromStorage()
  loadMessagesFromServer()
  scrollToBottom()
})

const handleBack = () => router.back()

const STORAGE_KEY = 'chatThreads'

const loadFromStorage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const map = raw ? JSON.parse(raw) : {}
    messages.value = map[contactId] || []
  } catch (e) {
    messages.value = []
  }
}

const persistThread = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const map = raw ? JSON.parse(raw) : {}
    map[contactId] = messages.value
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch (e) {
    console.error('持久化会话失败', e)
  }
}
</script>

<style scoped>
.chat-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f7f8fa;
}

.chat-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 12px;
}

.bubble-row {
  display: flex;
  margin-bottom: 10px;
}

.bubble-row.mine {
  justify-content: flex-end;
}

.bubble-row.theirs {
  justify-content: flex-start;
}

.bubble {
  max-width: 80%;
  padding: 10px 12px;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.bubble-row.mine .bubble {
  background: #1989fa;
  color: #fff;
}

.text {
  font-size: 14px;
  line-height: 1.4;
}

.time {
  margin-top: 6px;
  font-size: 12px;
  color: #999;
  text-align: right;
}

.chat-input {
  display: flex;
  gap: 8px;
  padding: 8px 10px;
  background: #fff;
  border-top: 1px solid #f0f0f0;
}

.chat-input .van-field {
  flex: 1;
}

.loading {
  display: flex;
  justify-content: center;
  padding: 12px 0;
}
</style>
