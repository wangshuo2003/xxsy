<template>
  <div class="balance-transactions-page">
    <van-nav-bar title="交易记录" left-arrow @click-left="goBack" />

    <div class="transactions-filters">
      <div class="filter-select">
        <van-dropdown-menu :z-index="4000">
          <van-dropdown-item v-model="searchCategory" :options="searchOptions" />
        </van-dropdown-menu>
      </div>
      <van-field
        v-model="searchKeyword"
        placeholder="请输入搜索关键词"
        :clearable="false"
        class="search-input"
        @keyup.enter="handleSearch"
        @clear="handleClear"
        @click-clear="handleClear"
        @click-right-icon="handleClear"
      >
        <template #right-icon>
          <van-icon
            name="clear"
            class="manual-clear-icon"
            @click.stop="handleClear"
          />
        </template>
      </van-field>
    </div>

    <van-tabs v-model:active="activeTab" @change="handleTabChange">
      <van-tab title="全部" name="all" />
      <van-tab title="收入" name="income" />
      <van-tab title="支出" name="expense" />
    </van-tabs>

    <div class="transactions-section">
      <div v-if="loading" class="loading">
        <van-loading size="24px" vertical>加载中...</van-loading>
      </div>
      <div v-else-if="paginatedTransactions.length === 0" class="empty">
        <van-empty description="暂无交易记录" />
      </div>
      <div v-else class="transaction-list">
        <div
          v-for="transaction in paginatedTransactions"
          :key="transaction.id"
          class="transaction-item"
        >
          <div class="transaction-info">
            <div class="transaction-desc">{{ transaction.description }}</div>
            <div class="transaction-time">{{ formatTime(transaction.createdAt) }}</div>
          </div>
          <div :class="['transaction-amount', getAmountClass(transaction.type, transaction.amount)]">
            {{ formatAmount(transaction.amount, transaction.type) }}
          </div>
        </div>
      </div>

      <div v-if="totalPages > 1" class="transactions-pagination">
        <van-button size="small" :disabled="page <= 1" @click="goToFirst">首页</van-button>
        <van-button size="small" :disabled="page <= 1" @click="prevPage">上一页</van-button>
        <span class="page-info">第 {{ page }} / {{ totalPages }} 页</span>
        <van-button size="small" :disabled="page >= totalPages" @click="nextPage">下一页</van-button>
        <van-button size="small" :disabled="page >= totalPages" @click="goToLast">末页</van-button>
        <div class="jump-section">
          <van-field
            v-model="jumpPageInput"
            type="digit"
            placeholder="页码"
            class="jump-input"
            maxlength="4"
            @keyup.enter="handleJump"
          />
          <van-button size="small" type="primary" @click="handleJump">跳转</van-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import request from '@/api/request'

const router = useRouter()
const allTransactions = ref([])
const loading = ref(true)
const activeTab = ref('all')
const searchCategory = ref('all')
const searchKeyword = ref('')
const page = ref(1)
const pageSize = 10
const jumpPageInput = ref('')

const searchOptions = [
  { text: '全部', value: 'all' },
  { text: '基地名', value: 'base' },
  { text: '充值', value: 'recharge' },
  { text: '退款', value: 'refund' }
]

const incomeTypes = ['RECHARGE', 'REFUND', 'GIFT_CARD']
const expenseTypes = ['PAYMENT']

const filteredTransactions = computed(() => {
  const keyword = searchKeyword.value.trim()
  return allTransactions.value.filter(tx => {
    // tab filter
    if (activeTab.value === 'income' && !(incomeTypes.includes(tx.type) || tx.amount > 0)) {
      return false
    }
    if (activeTab.value === 'expense' && !(expenseTypes.includes(tx.type) || tx.amount < 0)) {
      return false
    }

    if (!keyword && searchCategory.value !== 'recharge' && searchCategory.value !== 'refund') {
      return true
    }

    // category filter + fuzzy search
    const desc = (tx.description || '').toLowerCase()
    const amountText = Math.abs(tx.amount).toFixed(2)
    const lowerKeyword = keyword.toLowerCase()

    switch (searchCategory.value) {
      case 'base':
        return desc.includes(lowerKeyword)
      case 'recharge':
        return (incomeTypes.includes(tx.type) && (tx.type === 'RECHARGE' || tx.type === 'GIFT_CARD')) &&
          (!keyword || desc.includes(lowerKeyword) || amountText.includes(lowerKeyword))
      case 'refund':
        return tx.type === 'REFUND' && (!keyword || desc.includes(lowerKeyword) || amountText.includes(lowerKeyword))
      case 'all':
      default:
        return !keyword || desc.includes(lowerKeyword) || amountText.includes(lowerKeyword)
    }
  })
})

const totalPages = computed(() => {
  if (filteredTransactions.value.length === 0) return 0
  return Math.ceil(filteredTransactions.value.length / pageSize)
})

const paginatedTransactions = computed(() => {
  const start = (page.value - 1) * pageSize
  return filteredTransactions.value.slice(start, start + pageSize)
})

const fetchTransactions = async () => {
  loading.value = true
  try {
    const response = await request.get('/balance/transactions', { params: { page: 1, limit: 1000 } })
    allTransactions.value = response.data || []
  } catch (error) {
    console.error('获取交易记录失败:', error)
    showToast('获取交易记录失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  page.value = 1
}

const handleClear = () => {
  searchKeyword.value = ''
  page.value = 1
}

const handleTabChange = () => {
  page.value = 1
}

const goToFirst = () => {
  if (page.value > 1) page.value = 1
}

const goToLast = () => {
  if (totalPages.value) page.value = totalPages.value
}

const prevPage = () => {
  if (page.value > 1) page.value -= 1
}

const nextPage = () => {
  if (page.value < totalPages.value) page.value += 1
}

const handleJump = () => {
  const target = parseInt(jumpPageInput.value, 10)
  if (!target || target < 1 || target > totalPages.value) {
    showToast('请输入有效页码')
    return
  }
  page.value = target
}

const goBack = () => {
  router.back()
}

const formatAmount = (amount, type) => {
  let prefix = ''
  if (type === 'PAYMENT') {
    prefix = '-'
  } else if (type === 'RECHARGE' || type === 'REFUND' || type === 'GIFT_CARD') {
    prefix = '+'
  } else {
    prefix = amount >= 0 ? '+' : '-'
  }
  return `${prefix}${Math.abs(amount).toFixed(2)}`
}

const getAmountClass = (type, amount = 0) => {
  if (type === 'RECHARGE' || type === 'GIFT_CARD') return 'amount-recharge amount-positive'
  if (type === 'REFUND') return 'amount-positive'
  if (type === 'PAYMENT') return 'amount-negative'
  return amount >= 0 ? 'amount-positive' : 'amount-negative'
}

const formatTime = (timeString) => {
  const date = new Date(timeString)
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

onMounted(() => {
  fetchTransactions()
})
</script>

<style scoped>
.balance-transactions-page {
  min-height: 100vh;
  background: #f7f8fa;
}

.transactions-filters {
  padding: 12px 16px;
  background: #fff;
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-select {
  width: 25%;
}

.transactions-filters .van-dropdown-menu {
  margin: 0;
  flex: 1;
  --van-dropdown-menu-z-index: 4000;
}

:deep(.van-dropdown-menu__bar) {
  z-index: 1 !important;
}

:deep(.van-dropdown-item--down) {
  z-index: 5000 !important;
}

.search-input {
  width: 75%;
  background: #f7f8fa;
  border-radius: 8px;
}

.manual-clear-icon {
  color: #c8c9cc;
  font-size: 16px;
  cursor: pointer;
}

.transactions-section {
  margin: 12px 16px;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

.empty {
  padding: 40px 20px;
}

.transaction-list {
  background: white;
  border-radius: 8px;
  overflow: hidden;
}

.transaction-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.transaction-item:last-child {
  border-bottom: none;
}

.transaction-info {
  flex: 1;
}

.transaction-desc {
  font-size: 16px;
  color: #323233;
  margin-bottom: 4px;
}

.transaction-time {
  font-size: 12px;
  color: #969799;
}

.transaction-amount {
  font-size: 16px;
  font-weight: 600;
}

.amount-recharge {
  color: #07c160;
}

.amount-positive {
  color: #07c160;
}

.amount-negative {
  color: #ee0a24;
}

.transactions-pagination {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #fff;
  border-radius: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.transactions-pagination .page-info {
  font-size: 14px;
  color: #323233;
}

.jump-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.jump-input {
  width: 90px;
}
</style>
