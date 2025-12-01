<template>
  <div class="edit-page">
    <van-nav-bar :title="pageTitle" left-arrow @click-left="goBack" />

    <div class="form">
      <template v-if="field === 'all'">
        <van-field v-model="form.name" label="姓名" placeholder="请输入姓名" />
        <van-field v-model="form.age" label="年龄" type="number" placeholder="请输入年龄" />
        <van-field v-model="form.phone" label="手机号" type="tel" placeholder="请输入手机号" />
        <van-field v-model="form.signature" label="个性签名" type="textarea" rows="2" placeholder="写点什么吧" />
      </template>
      <template v-else-if="field === 'username'">
        <van-field v-model="form.username" label="ID" placeholder="请输入ID" />
      </template>
      <template v-else>
        <van-field
          v-model="form[field]"
          :label="labelMap[field]"
          :placeholder="`请输入${labelMap[field]}`"
          :rows="field === 'signature' ? 2 : 1"
          :type="field === 'signature' ? 'textarea' : (field === 'age' ? 'number' : (field === 'phone' ? 'tel' : 'text'))"
        />
      </template>
    </div>

    <div class="actions">
      <van-button type="primary" block round :loading="saving" @click="handleSave">保存</van-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { useUserStore } from '@/stores/user'
import request from '@/api/request'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const field = route.params.field
const saving = ref(false)
const form = ref({
  name: '',
  age: '',
  phone: '',
  signature: '',
  username: '',
  school: '',
  grade: '',
  className: ''
})

const labelMap = {
  name: '姓名',
  age: '年龄',
  phone: '手机号',
  signature: '个性签名',
  username: 'ID'
}

const pageTitle = computed(() => {
  if (field === 'all') return '编辑信息'
  return `编辑${labelMap[field] || '信息'}`
})

const fillForm = () => {
  const u = userStore.user || {}
  form.value = {
    name: u.name || '',
    age: u.age ?? '',
    phone: u.phone || '',
    signature: u.signature || '',
    username: u.username || '',
    school: u.school || '',
    grade: u.grade || '',
    className: u.className || ''
  }
}

onMounted(async () => {
  if (!userStore.user) {
    try {
      await userStore.getUserInfo()
    } catch (e) {
      console.error('获取用户失败', e)
    }
  }
  fillForm()
})

const goBack = () => {
  router.back()
}

const handleSave = async () => {
  saving.value = true
  try {
    const payload = {}

    // 按需提交字段，避免全量提交
    if (field === 'all' || field === 'name') {
      if (!form.value.name) {
        showToast('请先填写姓名')
        saving.value = false
        return
      }
      payload.name = form.value.name
    }

    if (field === 'all' || field === 'phone') {
      if (!form.value.phone) {
        showToast('请先填写手机号')
        saving.value = false
        return
      }
      payload.phone = form.value.phone
    }

    if (field === 'all' || field === 'school') payload.school = form.value.school
    if (field === 'all' || field === 'grade') payload.grade = form.value.grade
    if (field === 'all' || field === 'className') payload.className = form.value.className
    if (field === 'all' || field === 'username') payload.username = form.value.username

    if (field === 'all' || field === 'age') {
      payload.age = form.value.age === '' ? null : Number(form.value.age)
    }

    if (field === 'all' || field === 'signature') {
      payload.signature = form.value.signature ?? ''
    }

    // 如果当前字段不是 all，但用户想清空其他字段不在此次提交范围，保持不传，交由后端部分更新

    // 后端资料更新接口
    await request.put('/auth/profile', payload)
    await userStore.getUserInfo()
    showToast('保存成功')
    router.back()
  } catch (e) {
    console.error('保存失败', e)
    showToast(e?.response?.data?.error || '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.edit-page {
  min-height: 100vh;
  background: #f7f8fa;
}
.form {
  padding: 12px;
}
.actions {
  padding: 12px;
}
</style>
