<template>
  <div class="more-page">
    <van-nav-bar :title="titleText" left-arrow @click-left="handleBack" />

    <div class="panel">
      <van-cell title="删除联系人" icon="delete" is-link @click="openSheet = true" />
      <van-cell title="消息免打扰">
        <template #right-icon>
          <van-switch v-model="muteEnabled" size="20px" active-color="#07c160" />
        </template>
      </van-cell>
      <van-cell title="黑名单">
        <template #right-icon>
          <van-switch
            :loading="blacklistLoading"
            v-model="blacklistEnabled"
            size="20px"
            active-color="#ee0a24"
            @change="toggleBlacklist"
          />
        </template>
      </van-cell>
      <van-cell
        title="备注"
        is-link
        :value="remarkText || '未设置'"
        @click="goRemark"
      />
    </div>

    <van-action-sheet
      v-model:show="openSheet"
      :actions="actions"
      cancel-text="取消"
      close-on-click-action
      @select="onSelectAction"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast, showConfirmDialog } from 'vant'
import axios from 'axios'
import { useUserStore } from '@/stores/user'
import { getRemark } from '@/utils/remarks'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const contactId = route.query.with
const contactName = route.query.name || '好友'
const remarkRef = ref(getRemark(contactId))
const remarkText = computed(() => remarkRef.value)
const titleText = computed(() => `${remarkText.value || contactName}（${contactId}）`)
const headers = computed(() => (userStore.token ? { Authorization: `Bearer ${userStore.token}` } : {}))

const openSheet = ref(false)
const actions = [
  { name: '删除并保留聊天记录', keep: true },
  { name: '删除并清除聊天记录', keep: false }
]

const STORAGE_KEY = 'chatThreads'
const READ_KEY = 'chatReadAt'
const DELETED_KEY = 'deletedContacts'
const MUTED_KEY = 'mutedContacts'

const loadMuted = () => {
  try {
    const raw = localStorage.getItem(MUTED_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return new Set(arr)
  } catch (e) {
    return new Set()
  }
}

const saveMuted = (set) => {
  try {
    localStorage.setItem(MUTED_KEY, JSON.stringify(Array.from(set)))
  } catch (e) {
    console.error('保存免打扰失败', e)
  }
}

const mutedSet = ref(loadMuted())
const muteEnabled = computed({
  get: () => mutedSet.value.has(contactId),
  set: (val) => {
    if (!contactId) return
    if (val) mutedSet.value.add(contactId)
    else mutedSet.value.delete(contactId)
    saveMuted(mutedSet.value)
  }
})

const blacklistEnabled = ref(false)
const blacklistLoading = ref(false)

const fetchBlacklist = async () => {
  if (!contactId) return
  try {
    const res = await axios.get(`/api/messages/contacts/${encodeURIComponent(contactId)}/blacklist`, {
      headers: headers.value,
      validateStatus: () => true
    })
    blacklistEnabled.value = !!res.data?.data?.blockedByMe
  } catch (e) {
    console.warn('获取黑名单状态失败', e)
  }
}

const toggleBlacklist = async (val) => {
  if (!contactId) return
  blacklistLoading.value = true
  const prev = blacklistEnabled.value
  blacklistEnabled.value = val
  try {
    const res = await axios.patch(
      `/api/messages/contacts/${encodeURIComponent(contactId)}/blacklist`,
      { block: val },
      { headers: headers.value, validateStatus: () => true }
    )
    if (res.status >= 400) throw new Error('set blacklist fail')
    showToast(val ? '已拉黑，对方无法再联系你' : '已取消拉黑')
  } catch (e) {
    console.error('切换黑名单失败', e)
    blacklistEnabled.value = prev
    showToast('操作失败')
  } finally {
    blacklistLoading.value = false
  }
}

onMounted(() => {
  fetchBlacklist()
  window.addEventListener('remark-updated', handleRemarkUpdate)
})

onUnmounted(() => {
  window.removeEventListener('remark-updated', handleRemarkUpdate)
})

const markDeleted = () => {
  try {
    const raw = localStorage.getItem(DELETED_KEY)
    const list = raw ? JSON.parse(raw) : []
    if (!contactId) return
    if (!list.includes(contactId)) {
      list.push(contactId)
      localStorage.setItem(DELETED_KEY, JSON.stringify(list))
    }
  } catch (e) {}
}

const removeLocalThread = (keep) => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const map = raw ? JSON.parse(raw) : {}
    if (!keep && contactId && map[contactId]) {
      delete map[contactId]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
    }
  } catch (e) {}

  try {
    const raw = localStorage.getItem(READ_KEY)
    const map = raw ? JSON.parse(raw) : {}
    if (!keep && contactId && map[contactId]) {
      delete map[contactId]
      localStorage.setItem(READ_KEY, JSON.stringify(map))
    }
  } catch (e) {}
}

const doDelete = async (keep) => {
  if (!contactId) return
  try {
    const res = await axios.delete(`/api/messages/contacts/${encodeURIComponent(contactId)}`, {
      params: { keepMessages: keep },
      headers: headers.value,
      validateStatus: () => true
    })
    if (res.status >= 400 && res.status !== 404) throw new Error('DELETE failed')
    markDeleted()
    removeLocalThread(keep)
    showToast('已删除联系人')
    router.replace('/messages')
  } catch (e) {
    console.error('删除联系人失败', e)
    // 若后端返回 404，也视作已删除成功，前端直接清理
    if (e?.response?.status === 404) {
      markDeleted()
      removeLocalThread(keep)
      showToast('联系人已不存在，已同步清理')
      router.replace('/messages')
    } else {
      showToast('删除失败')
    }
  }
}

const onSelectAction = (action) => {
  openSheet.value = false
  // 直接执行删除，不再弹二次确认
  doDelete(action.keep)
}

const handleBack = () => router.back()

const goRemark = () => {
  router.push({ path: '/chat/remark', query: { with: contactId } })
}

const handleRemarkUpdate = (e) => {
  if (e?.detail?.id === contactId) {
    remarkRef.value = e.detail.remark || ''
  }
}
</script>

<style scoped>
.more-page {
  min-height: 100vh;
  background: #f7f8fa;
}

.panel {
  margin-top: 12px;
  background: #fff;
}
</style>
