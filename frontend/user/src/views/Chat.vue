<template>
  <div class="chat-page">
    <van-nav-bar
      :title="contactName"
      left-arrow
      fixed
      placeholder
      @click-left="handleBack"
    >
      <template #right>
        <van-button size="mini" type="primary" plain @click="goMore">更多</van-button>
      </template>
    </van-nav-bar>

    <div class="chat-body" ref="listRef">
      <div v-if="contactMissing" class="missing">
        <p>双方已不是好友，无法查看历史消息。</p>
        <van-button size="small" type="primary" plain @click="goAddFriend">发送好友申请</van-button>
      </div>

      <template v-else>
        <div
          v-for="(msg, idx) in messages"
          :key="msg.localId || msg.type || idx"
          v-bind="msg.type === 'notice' ? {} : null"
        >
          <template v-if="msg.type === 'notice'">
            <div class="accept-notice">{{ msg.text }}</div>
          </template>
          <template v-else>
            <div
              :class="['bubble-row', msg.from === 'me' ? 'mine' : 'theirs']"
              @click="msg.status === 'failed' ? resendMessage(msg) : null"
            >
              <div
                class="time-outside"
                :class="[msg.from === 'me' ? 'time-left' : 'time-right', msg.status === 'failed' ? 'failed' : '']"
              >
                <span v-if="msg.status === 'failed'" class="fail-tag">未发送</span>
                {{ formatTime(msg.time) }}
              </div>
              <div class="bubble" :class="msg.status === 'failed' ? 'failed' : ''">
                <div class="text" :class="msg.status === 'failed' ? 'failed' : ''">
                  {{ msg.text }}
                </div>
              </div>
            </div>
          </template>
        </div>

        <div v-if="loading" class="loading">
          <van-loading size="20px">加载中...</van-loading>
        </div>
      </template>
    </div>

    <div class="chat-input">
      <van-field
        v-model="draft"
        placeholder="我想说："
        clearable
        @keyup.enter="sendMessage"
      />
      <van-button type="primary" size="small" @click="sendMessage">发送</van-button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, computed, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { showToast, showConfirmDialog } from 'vant'
import { useUserStore } from '@/stores/user'
import { getRemark } from '@/utils/remarks'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const contactId = route.query.with || 'super-admin'
const contactName = ref(mapContactName(contactId))
const otherUserId = ref(null)

const messages = ref([])
const MAX_KEEP = 100
const draft = ref('')
const loading = ref(false)
const firstLoad = ref(true)
const listRef = ref(null)
const headers = computed(() => (userStore.token ? { Authorization: `Bearer ${userStore.token}` } : {}))
let pollTimer = null
const contactMissing = ref(false)
const READ_KEY = 'chatReadAt'
const acceptNoticeMeta = ref(null) // 保留字段，现主要依赖系统消息
let lastNoticeFetch = 0
const lastAcceptNoticeTs = ref(0)

const markThreadRead = () => {
  try {
    const raw = localStorage.getItem(READ_KEY)
    const map = raw ? JSON.parse(raw) : {}
    map[contactId] = Date.now()
    localStorage.setItem(READ_KEY, JSON.stringify(map))
  } catch (e) {
    console.warn('保存已读状态失败', e)
  }
}

function mapContactName(id) {
  const remark = getRemark(id)
  if (remark) return remark
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

onMounted(() => {
  // 进入聊天即视为已读当前会话
  markThreadRead()
  fetchAcceptNotice()
  window.addEventListener('remark-updated', handleRemarkUpdate)
})

onUnmounted(() => {
  // 离开时再次写入已读时间，防止列表误判为未读
  markThreadRead()
  window.removeEventListener('remark-updated', handleRemarkUpdate)
})

const handleRemarkUpdate = (e) => {
  if (e?.detail?.id === contactId) {
    contactName.value = mapContactName(contactId)
  }
}

const isAtBottom = () => {
  const el = listRef.value
  if (!el) return true
  const distance = el.scrollHeight - el.scrollTop - el.clientHeight
  return distance < 50 // 阈值：距离底部小于 50px 视为在底部
}

const scrollToLatestIfNew = (newCount, shouldScroll) => {
  if (!shouldScroll) return
  nextTick(() => {
    const el = listRef.value
    if (!el) return
    if (newCount > 0) {
      el.scrollTop = el.scrollHeight
    }
  })
}

const injectAcceptNotice = (meta) => {
  if (!meta?.time) return
  const { time, byMe, otherName, otherId } = meta
  const ts = new Date(time).getTime()
  if (ts <= lastAcceptNoticeTs.value) return
  const nameBest = otherName || contactName.value
  const idBest = otherId || contactId
  const targetLabel = nameBest && nameBest !== '好友'
    ? `${nameBest}（${idBest}）`
    : idBest
  const text = byMe
    ? `我通过了 ${targetLabel} 的好友申请 ${formatTime(time)}`
    : `对方通过了好友申请 ${formatTime(time)}`
  messages.value.push({ type: 'notice', text, time })
  lastAcceptNoticeTs.value = ts
  messages.value.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
  persistThread()
}

const fetchAcceptNotice = async () => {
  const now = Date.now()
  if (now - lastNoticeFetch < 5000) return
  lastNoticeFetch = now
  try {
    const headersObj = headers.value
    const [incomingRes, sentRes] = await Promise.all([
      axios.get('/api/messages/requests', { headers: headersObj, validateStatus: () => true }),
      axios.get('/api/messages/requests/sent', { headers: headersObj, validateStatus: () => true })
    ])
    const incoming = Array.isArray(incomingRes?.data?.data) ? incomingRes.data.data : []
    const sent = Array.isArray(sentRes?.data?.data) ? sentRes.data.data : []
    const meId = userStore.user?.id

    const acceptedByThem = sent
      .filter(r => r.status === 'ACCEPTED')
      .filter(r => (
        r.toUser?.username === contactId ||
        r.to === contactId ||
        (otherUserId.value && r.toId === otherUserId.value)
      ))
      .map(r => ({
        time: r.updatedAt || r.createdAt,
        byMe: false,
        otherName: r.toUser?.name || r.toUser?.username || contactName.value,
        otherId: r.toUser?.username || r.to
      }))

    const acceptedByMe = incoming
      .filter(r => r.status === 'ACCEPTED')
      .filter(r => (
        r.fromUser?.username === contactId ||
        r.from === contactId ||
        (otherUserId.value && r.fromId === otherUserId.value)
      ))
      .map(r => ({
        time: r.updatedAt || r.createdAt,
        byMe: true,
        otherName: r.fromUser?.name || r.fromUser?.username || contactName.value,
        otherId: r.fromUser?.username || r.from
      }))

    const merged = [...acceptedByMe, ...acceptedByThem].filter(n => n.time)
    if (!merged.length) return

    const latest = merged.reduce((acc, cur) => {
      const a = new Date(acc.time || 0).getTime()
      const b = new Date(cur.time || 0).getTime()
      return b >= a ? cur : acc
    })

    acceptNoticeMeta.value = latest
    injectAcceptNotice(latest)
  } catch (e) {
    console.warn('获取好友通过提示失败', e)
  }
}

const sendMessage = async () => {
  const text = draft.value.trim()
  if (!text) return
  draft.value = ''
  const msg = {
    localId: Date.now() + Math.random(),
    from: 'me',
    text,
    time: new Date().toISOString(),
    status: 'sending'
  }
  messages.value.push(msg)
  // 自己发送消息时无论列表是否在底部都滚动到最新，保持输入体验
  scrollToLatestIfNew(1, true)
  persistThread()

  try {
    const res = await axios.post(
      `/api/messages/contacts/${encodeURIComponent(contactId)}/messages`,
      { content: text },
      { headers: headers.value }
    )
    msg.status = 'sent'
    msg.time = res.data?.message?.createdAt || msg.time
    markThreadRead()
    persistThread()
  } catch (e) {
    console.error('发送消息失败', e)
    const status = e?.response?.status
    msg.status = 'failed'
    const errText = e?.response?.data?.error
    if (errText === '被拉黑') {
      msg.failReason = 'blocked'
      showToast('被拉黑')
    } else {
      msg.failReason = status === 403 || status === 404 ? 'not-friend' : 'net'
      if (msg.failReason !== 'not-friend') {
        showToast('发送失败')
      } else {
        maybeAskAddFriend()
      }
    }
    persistThread()
    // 强制刷新列表以立即呈现红色状态
    messages.value = [...messages.value]
  }
}

const resendMessage = async (msg) => {
  if (msg.status !== 'failed') return
  msg.status = 'sending'
  try {
    const res = await axios.post(
      `/api/messages/contacts/${encodeURIComponent(contactId)}/messages`,
      { content: msg.text },
      { headers: headers.value }
    )
    msg.status = 'sent'
    msg.time = res.data?.message?.createdAt || msg.time
    markThreadRead()
    persistThread()
  } catch (e) {
    console.error('重发失败', e)
    const status = e?.response?.status
    msg.status = 'failed'
    const errText = e?.response?.data?.error
    if (errText === '被拉黑') {
      msg.failReason = 'blocked'
      showToast('被拉黑')
    } else {
      msg.failReason = status === 403 || status === 404 ? 'not-friend' : 'net'
      if (msg.failReason !== 'not-friend') {
        showToast('发送失败')
      } else {
        maybeAskAddFriend()
      }
    }
    persistThread()
    messages.value = [...messages.value]
  }
}

const maybeAskAddFriend = () => {
  showConfirmDialog({
    title: '对方不是好友',
    message: '是否发送好友申请？',
    closeOnClickOverlay: true,
    confirmButtonText: '是',
    cancelButtonText: '否'
  })
    .then(() => {
      router.push({ path: '/contacts/add', query: { prefill: contactId } })
    })
    .catch(() => {})
}

const goAddFriend = () => {
  router.push({ path: '/contacts/add', query: { prefill: contactId } })
}

const loadMessagesFromServer = async (withLoading = false) => {
  if (withLoading) loading.value = true
  try {
    // 先拿本地存储，保留失败记录
    const stored = readStorageThread()
    const noticeLocal = (stored || []).filter(m => m.type === 'notice')
    const wasBottom = isAtBottom()

    const res = await axios.get(`/api/messages/contacts/${encodeURIComponent(contactId)}/messages`, {
      headers: headers.value
    })
    const before = messages.value.length
    const serverMsgs = (res.data?.data || []).map(m => ({
      from: m.fromId === userStore.user?.id ? 'me' : 'them',
      text: m.content,
      time: m.createdAt,
      status: 'sent',
      fromId: m.fromId,
      toId: m.toId,
      type: m.content && m.content.includes('通过了') && m.content.includes('好友申请') ? 'notice' : undefined
    }))

    const failedLocal = (stored || []).filter(m => m.status === 'failed')
    const merged = [...serverMsgs]
    failedLocal.forEach(f => {
      if (!merged.find(m => m.localId === f.localId && m.text === f.text && m.time === f.time)) {
        merged.push(f)
      }
    })
    noticeLocal.forEach(n => {
      if (!merged.find(m => m.type === 'notice' && m.time === n.time && m.text === n.text)) {
        merged.push(n)
      }
      const ts = new Date(n.time).getTime()
      if (ts > lastAcceptNoticeTs.value) lastAcceptNoticeTs.value = ts
    })
    merged.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
    messages.value = merged.slice(-MAX_KEEP)
    // 记录对方的用户ID，便于匹配好友申请
    if (!otherUserId.value) {
      const first = merged.find(m => m.fromId || m.toId)
      if (first) {
        const meId = userStore.user?.id
        otherUserId.value = first.fromId === meId ? first.toId : first.fromId
      }
    }
    persistThread(messages.value)
    const after = messages.value.length
    scrollToLatestIfNew(Math.max(0, after - before), wasBottom)
  } catch (e) {
    console.error('加载消息失败', e)
    const status = e?.response?.status
    if (status === 404) {
      stopPolling()
      contactMissing.value = true
      messages.value = []
      persistThread([])
    } else {
      showToast('加载消息失败')
    }
  } finally {
    if (withLoading) loading.value = false
    firstLoad.value = false
  }
}

const startPolling = () => {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = setInterval(() => {
    loadMessagesFromServer()
  }, 2000)
}

const stopPolling = () => {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
}

const ensureContactName = async () => {
  const remark = getRemark(contactId)
  if (remark) {
    contactName.value = remark
    return
  }
  if (contactName.value && contactName.value !== mapContactName(contactId)) return
  try {
    const res = await axios.get('/api/messages/contacts', {
      params: { limit: 100 },
      headers: headers.value
    })
    const list = Array.isArray(res?.data?.data) ? res.data.data : []
    const match = list.find(item => (item.id || item.contactId || item.userId) === contactId)
    if (match) {
      contactName.value = getRemark(contactId) || match.name || match.nickname || contactName.value
    }
  } catch (e) {
    console.error('获取联系人名称失败', e)
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
  loadMessagesFromServer(true)
  ensureContactName()
  scrollToBottom()
  startPolling()
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})

const handleBack = () => router.back()

const goMore = () => {
  router.push({ path: '/chat/more', query: { with: contactId, name: contactName.value } })
}

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

const persistThread = (payload) => {
  const data = payload || messages.value
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const map = raw ? JSON.parse(raw) : {}
    map[contactId] = data
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch (e) {
    console.error('持久化会话失败', e)
  }
}

const readStorageThread = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const map = raw ? JSON.parse(raw) : {}
    return map[contactId] || []
  } catch (e) {
    return []
  }
}
</script>

<style scoped>
.chat-page {
  --nav-h: 46px;
  --input-space: 80px; /* 输入区及安全距离，避免列表被遮挡 */
  position: relative;
  min-height: 100vh;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f7f8fa;
  overflow: hidden;
  padding-top: var(--nav-h);
}

.chat-body {
  position: absolute;
  top: var(--nav-h);
  left: 0;
  right: 0;
  bottom: var(--input-space);
  overflow-y: auto;
  padding: 12px;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  -ms-overflow-style: none;
  display: flex;
  flex-direction: column;
  overscroll-behavior: contain;
  box-sizing: border-box;
}

.missing {
  padding: 24px;
  text-align: center;
  color: #666;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}

.chat-body::-webkit-scrollbar {
  display: none;
}

.bubble-row {
  display: flex;
  margin: 10px;
  width: calc(100% - 20px);
  box-sizing: border-box;
  gap: 8px;
}

.bubble-row.mine {
  justify-content: flex-end;
  align-items: flex-end;
}

.bubble-row.theirs {
  justify-content: flex-start;
}

.bubble {
  order: 1;
  max-width: 80%;
  padding: 10px 12px;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.bubble.failed {
  border: 1px solid #ffd6d6;
  background: #fff0f0;
  color: #111;
}

.bubble-row.mine .bubble {
  background: #1989fa;
  color: #fff;
  align-self: flex-end;
}

.bubble-row.mine .bubble.failed {
  background: #ffecec !important;
  color: #111 !important;
  border: 1px solid #ffd6d6;
}

.text {
  font-size: 14px;
  line-height: 1.4;
}

.text.failed {
  color: #111;
}

.time-outside.failed {
  color: #ff4d4f;
}

.time-outside {
  font-size: 12px;
  color: #999;
  white-space: nowrap;
  align-self: center;
  order: 0;
}

.bubble-row.mine .time-outside {
  margin-right: 6px;
}

.bubble-row.theirs .time-outside {
  order: 2;
  margin-left: 6px;
}

.accept-notice {
  text-align: center;
  color: #07c160;
  font-size: 12px;
  margin-top: 6px;
  margin-bottom: 4px;
}

.chat-input {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  margin: 0;
  align-items: center;
  background: #fff;
  border: 2px solid #f0f0f0;
  border-radius: 12px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: 30px;
  z-index: 20;
  padding-bottom: calc(10px + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.chat-input .van-field {
  border: 1px solid #eee;
  flex: 1;
  padding-left: 0;
  padding-right: 0;
  margin-left: auto;
  margin-right: 0;
  max-width: calc(100% - 70px); /* 略缩短输入框，给右侧按钮留更宽的余量 */
}

.chat-input .van-button {
  margin-right: 10px;
}

.loading {
  display: flex;
  justify-content: center;
  padding: 12px 0;
}
</style>
