<template>
  <div class="remark-page">
    <van-nav-bar title="设置备注" left-arrow @click-left="handleBack" right-text="保存" @click-right="handleSave" />
    <div class="body">
      <van-field
        v-model="remark"
        type="textarea"
        rows="3"
        maxlength="50"
        show-word-limit
        placeholder="请输入对联系人显示的备注"
      />
      <p class="tip">备注仅自己可见，在消息列表和聊天顶部显示。</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { getRemark, setRemark } from '@/utils/remarks'

const route = useRoute()
const router = useRouter()
const contactId = route.query.with
const remark = ref('')

onMounted(() => {
  remark.value = getRemark(contactId)
})

const handleSave = () => {
  setRemark(contactId, remark.value.trim())
  showToast('已保存备注')
  router.back()
}

const handleBack = () => router.back()
</script>

<style scoped>
.remark-page {
  min-height: 100vh;
  background: #f7f8fa;
}
.body {
  padding: 16px;
}
.tip {
  margin-top: 8px;
  color: #888;
  font-size: 12px;
}
</style>
