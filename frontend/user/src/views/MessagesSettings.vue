<template>
  <div class="settings-page">
    <van-nav-bar title="消息设置" left-arrow @click-left="goBack" />

    <div class="dropdown-wrap">
      <span class="label">联系人排序方式</span>
      <van-dropdown-menu :z-index="9999" active-color="#1989fa" ref="menuRef" teleport="false">
        <van-dropdown-item
          v-model="selected"
          :options="options"
          :duration="0"
          :overlay="true"
          overlay-class="ms-overlay"
          @open="onOpen"
          @close="onClosed"
          @change="onChange"
        />
      </van-dropdown-menu>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'

const STORAGE_KEY = 'contact_sort_pref'
const router = useRouter()
const toKey = (obj) => `${obj.field}-${obj.order}`
const toObj = (key) => {
  const [field, order] = key.split('-')
  return { field: field || 'updatedAt', order: order || 'desc' }
}

const pref = ref(loadPref())
const selected = ref(toKey(pref.value))
const menuRef = ref(null)
let rafId = null

const options = [
  { text: '字母顺序升序', value: 'name-asc' },
  { text: '字母顺序降序', value: 'name-desc' },
  { text: '添加时间升序', value: 'createdAt-asc' },
  { text: '添加时间降序', value: 'createdAt-desc' },
  { text: '最近聊天时间升序', value: 'updatedAt-asc' },
  { text: '最近聊天时间降序', value: 'updatedAt-desc' }
]

const currentLabel = computed(() => {
  const match = options.find(o => o.value === selected.value)
  return match ? match.text : '最近聊天时间降序'
})

function loadPref() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.warn('读取排序设置失败', e)
  }
  return { field: 'updatedAt', order: 'desc' }
}

function savePref(p) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
    window.dispatchEvent(new CustomEvent('contact-sort-changed', { detail: p }))
  } catch (e) {
    console.warn('保存排序设置失败', e)
  }
}

const onChange = (val) => {
  selected.value = val
  const obj = toObj(val)
  pref.value = obj
  savePref(obj)
}

const goBack = () => router.replace({ path: '/messages', query: { tab: 'more' } })

const positionDropdown = () => {
  const bar = menuRef.value?.$el?.querySelector('.van-dropdown-menu__bar')
  const content = document.querySelector('.van-dropdown-item__content')
  if (!bar || !content) return
  const rect = bar.getBoundingClientRect()
  const naturalWidth = Math.max(rect.width, 240)
  const left = rect.left + rect.width / 2 - naturalWidth / 2
  content.style.position = 'fixed'
  content.style.display = 'block'
  content.style.opacity = '1'
  content.style.visibility = 'visible'
  content.style.width = `${naturalWidth}px`
  content.style.left = `${left}px`
  content.style.top = `${rect.bottom + 6}px`
  content.style.transform = 'none'
  content.style.transformOrigin = 'center top'
  content.style.transition = 'none'
  content.style.maxHeight = '70vh'
}

const onOpen = () => {
  nextTick(() => {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(() => {
      positionDropdown()
    })
  })
}

const onClosed = () => {
  const content = document.querySelector('.van-dropdown-item__content')
  if (content) {
    content.style.display = 'none'
    content.style.opacity = '0'
  }
}

const handleResize = () => positionDropdown()

onMounted(() => {
  pref.value = loadPref()
  selected.value = toKey(pref.value)
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId)
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.settings-page {
  min-height: 100vh;
  background: #f7f8fa;
}
.user-content {
  overflow: visible !important;
}
.dropdown-wrap {
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
  overflow: visible;
}
.dropdown-wrap :deep(.van-dropdown-menu) {
  flex: 0 0 auto;
  display: inline-flex;
  position: relative;
  z-index: 12000;
}
.label {
  font-size: 14px;
  color: #666;
  flex-shrink: 0;
}
:deep(.van-dropdown-menu__bar) {
  width: 220px;
  justify-content: center;
  margin-left: 8px;
  position: relative;
  z-index: 12000;
  border-radius: 12px;
  background: #fff;
  border: 1px solid #e5e6eb;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
}
:deep(.van-dropdown-menu) {
  width: auto;
  position: relative;
}
:deep(.van-dropdown-menu__item) {
  flex: 0 0 auto;
  position: relative;
}
:deep(.van-dropdown-item) {
  width: auto;
  display: inline-flex;
  position: relative;
}
:deep(.van-dropdown-item__content) {
  z-index: 13000 !important;
  min-width: 240px;
  max-width: min(92vw, 320px);
  width: auto !important;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.16);
  border-radius: 14px;
  overflow: hidden;
  background: #fff;
}
:deep(.van-dropdown-item__option) {
  padding: 12px 16px;
}
:deep(.van-dropdown-item__option--active) {
  background: #f2f8ff;
  color: #1989fa;
}
:deep(.ms-overlay) {
  background: rgba(0, 0, 0, 0.15);
  z-index: 9998;
}
</style>
