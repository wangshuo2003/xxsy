<template>
  <div class="balance-page">
    <van-nav-bar title="我的余额" left-arrow @click-left="$router.go(-1)" />

    <!-- 余额卡片 -->
    <div class="balance-card">
      <div class="balance-header">
        <span class="balance-title">账户余额</span>
      </div>
      <div class="balance-amount">
        ¥{{ (userBalance || 0).toFixed(2) }}
      </div>
      <div class="balance-tip">
        可用于购买活动和特色服务
      </div>
    </div>

    <!-- 快速充值 -->
    <div class="recharge-info quick-recharge">
      <h4>快速充值</h4>

      <!-- 充值金额输入 -->
      <div class="recharge-amount-section">
        <van-field
          v-model="quickRechargeAmount"
          placeholder="请输入充值金额"
          type="digit"
          class="amount-input"
          :rules="[{ required: true, message: '请输入充值金额' }]"
        >
          <template #extra>
            <span class="currency-unit">元</span>
          </template>
        </van-field>

        <!-- 快捷金额选择 -->
        <div class="quick-amounts-small">
          <van-button
            v-for="amount in [10, 20, 50, 100, 200, 500]"
            :key="amount"
            size="small"
            @click="quickRechargeAmount = amount.toString()"
            class="quick-amount-small"
          >
            {{ amount }}元
          </van-button>
        </div>
      </div>

      <!-- 支付方式选择 -->
      <div class="payment-section">
        <div class="payment-title">选择支付方式</div>
        <div class="payment-grid">
          <van-button
            class="payment-option wechat-option"
            @click="handleQuickPayment('wechat')"
            :loading="quickPaying === 'wechat'"
            :disabled="!quickRechargeAmount || parseFloat(quickRechargeAmount) <= 0"
          >
            <van-icon name="wechat" />
            <span>微信支付</span>
          </van-button>
          <van-button
            class="payment-option alipay-option"
            @click="handleQuickPayment('alipay')"
            :loading="quickPaying === 'alipay'"
            :disabled="!quickRechargeAmount || parseFloat(quickRechargeAmount) <= 0"
          >
            <van-icon name="alipay" />
            <span>支付宝</span>
          </van-button>
        </div>
      </div>

      <!-- 礼品卡充值 -->
      <div class="gift-card-section">
        <div class="gift-card-title">或使用礼品卡</div>
        <div class="gift-card-input-group">
          <van-field
            v-model="quickGiftCardCode"
            placeholder="请输入礼品卡码"
            class="gift-card-input"
            :rules="[{ required: true, message: '请输入礼品卡码' }]"
          >
            <template #button>
              <van-button
                size="small"
                type="primary"
                @click="handleQuickGiftCardRecharge"
                :loading="quickRecharging"
                :disabled="!quickGiftCardCode"
              >
                充值
              </van-button>
            </template>
          </van-field>
        </div>
        <div class="gift-card-tip">
          支持礼品卡码充值，余额实时到账
        </div>
      </div>
    </div>

    <!-- 充值说明 -->
    <div class="recharge-info">
      <h4>充值说明</h4>
      <div class="info-content">
        <p>• 支持支付宝、微信支付、银行卡等多种支付方式</p>
        <p>• 充值后余额实时到账，可用于购买活动和特色服务</p>
        <p>• 如有充值问题，请联系客服处理</p>
      </div>
    </div>

    <!-- 交易记录 -->
    <div class="transactions">
      <h4>交易记录</h4>
      <div v-if="loading" class="loading">
        <van-loading size="24px" vertical>加载中...</van-loading>
      </div>
      <div v-else-if="transactions.length === 0" class="empty">
        <van-empty description="暂无交易记录" />
      </div>
      <div v-else class="transaction-list">
        <div
          v-for="transaction in transactions"
          :key="transaction.id"
          class="transaction-item"
        >
          <div class="transaction-info">
            <div class="transaction-desc">{{ transaction.description }}</div>
            <div class="transaction-time">{{ formatTime(transaction.createdAt) }}</div>
          </div>
          <div :class="['transaction-amount', getAmountClass(transaction.type)]">
            {{ formatAmount(transaction.amount) }}
          </div>
        </div>
      </div>
    </div>

    <!-- 充值弹窗 -->
    <van-popup v-model:show="showRechargeModal" position="bottom" :style="{ height: '60%' }">
      <div class="recharge-modal">
        <h3>余额充值</h3>
        <div class="recharge-form">
          <van-field
            v-model="rechargeAmount"
            label="充值金额"
            placeholder="请输入充值金额"
            type="digit"
            :rules="[{ required: true, message: '请输入充值金额' }]"
          >
            <template #button>
              <span class="currency-unit">元</span>
            </template>
          </van-field>

          <!-- 快捷金额选择 -->
          <div class="quick-amounts">
            <span class="quick-label">快捷金额：</span>
            <van-button
              v-for="amount in [10, 20, 50, 100, 200, 500]"
              :key="amount"
              size="small"
              @click="rechargeAmount = amount.toString()"
              class="quick-amount-btn"
            >
              {{ amount }}元
            </van-button>
          </div>

          <van-field
            v-model="paymentMethod"
            label="支付方式"
            placeholder="请选择支付方式"
            readonly
            @click="showPaymentMethods = true"
          />

          <!-- 礼品卡输入框 -->
          <van-field
            v-if="paymentMethod === 'gift_card'"
            v-model="giftCardCode"
            label="礼品卡码"
            placeholder="请输入礼品卡码"
            :rules="[{ required: true, message: '请输入礼品卡码' }]"
          />
        </div>
        <div class="recharge-actions">
          <van-button @click="showRechargeModal = false">取消</van-button>
          <van-button
            type="primary"
            @click="handleRecharge"
            :loading="recharging"
            :disabled="!rechargeAmount || !paymentMethod || (paymentMethod === 'gift_card' && !giftCardCode)"
          >
            确认充值
          </van-button>
        </div>
      </div>
    </van-popup>

    <!-- 支付方式选择 -->
    <van-action-sheet
      v-model:show="showPaymentMethods"
      :actions="paymentActions"
      @select="onPaymentMethodSelect"
      cancel-text="取消"
    />

    <!-- 礼品卡提示对话框 -->
    <van-dialog v-model:show="showGiftCardDialog" title="礼品卡提示" :show-confirm-button="false">
      <div class="gift-card-dialog-content">
        <p>{{ giftCardMessage }}</p>
      </div>
      <template #footer>
        <van-button type="primary" block @click="showGiftCardDialog = false">确定</van-button>
      </template>
    </van-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { showToast, showSuccessToast, showConfirmDialog } from 'vant'
import request from '@/api/request'

const userBalance = ref(0)
const transactions = ref([])
const loading = ref(true)
const showRechargeModal = ref(false)
const showPaymentMethods = ref(false)
const rechargeAmount = ref('')
const paymentMethod = ref('')
const giftCardCode = ref('')
const recharging = ref(false)

// 快速充值
const quickRechargeAmount = ref('')
const quickGiftCardCode = ref('')
const quickRecharging = ref(false)
const quickPaying = ref('')

// 礼品卡提示对话框
const showGiftCardDialog = ref(false)
const giftCardMessage = ref('')


const paymentActions = [
  { name: '微信支付', value: 'wechat' },
  { name: '支付宝', value: 'alipay' },
  { name: '礼品卡', value: 'gift_card' }
]

// 获取用户余额
const fetchBalance = async () => {
  try {
    const response = await request.get('/balance')
    userBalance.value = response.balance
  } catch (error) {
    console.error('获取余额失败:', error)
    showToast('获取余额失败')
  }
}

// 获取交易记录
const fetchTransactions = async () => {
  try {
    const response = await request.get('/balance/transactions')
    transactions.value = response.data
  } catch (error) {
    console.error('获取交易记录失败:', error)
    showToast('获取交易记录失败')
  } finally {
    loading.value = false
  }
}


// 充值
const handleRecharge = async () => {
  if (!rechargeAmount.value || !paymentMethod.value) {
    showToast('请完善充值信息')
    return
  }

  // 验证充值金额
  const amount = parseFloat(rechargeAmount.value)
  if (isNaN(amount) || amount <= 0) {
    showToast('请输入有效的充值金额')
    return
  }

  if (amount < 0.01) {
    showToast('充值金额不能小于0.01元')
    return
  }

  if (amount > 10000) {
    showToast('单次充值金额不能超过10000元')
    return
  }

  // 微信和支付宝支付开发中提示
  if (paymentMethod.value === 'wechat' || paymentMethod.value === 'alipay') {
    showToast('该支付方式功能开发中，请使用礼品卡充值')
    return
  }

  // 礼品卡充值
  if (paymentMethod.value === 'gift_card') {
    await handleGiftCardRecharge()
    return
  }

  try {
    recharging.value = true
    const response = await request.post('/balance/recharge', {
      amount: amount,
      paymentMethod: paymentMethod.value
    })

    showSuccessToast('充值成功')
    userBalance.value = response.balance
    showRechargeModal.value = false
    rechargeAmount.value = ''
    paymentMethod.value = ''

    // 刷新交易记录
    await fetchTransactions()
  } catch (error) {
    console.error('充值失败:', error)
    showToast(error.response?.data?.error || '充值失败')
  } finally {
    recharging.value = false
  }
}

// 礼品卡充值
const handleGiftCardRecharge = async () => {
  if (!giftCardCode.value || !giftCardCode.value.trim()) {
    showToast('请输入礼品卡码')
    return
  }

  try {
    recharging.value = true
    const response = await request.post('/balance/recharge/gift-card', {
      cardCode: giftCardCode.value.trim().toUpperCase()
    })

    showSuccessToast(`礼品卡充值成功！充值金额：¥${response.amount}`)
    userBalance.value = response.balance
    showRechargeModal.value = false
    rechargeAmount.value = ''
    paymentMethod.value = ''
    giftCardCode.value = ''

    // 刷新交易记录
    await fetchTransactions()
  } catch (error) {
    console.error('礼品卡充值失败:', error)
    const errorData = error.response?.data

    if (errorData?.error === '礼品卡已被使用') {
      // 显示详细的已使用信息，保护用户隐私
      const usedTime = errorData?.usedTime || '未知时间'
      giftCardMessage.value = `该礼品卡已于 ${usedTime} 被使用\n每个礼品卡只能使用一次，请检查您的礼品卡码`
      showGiftCardDialog.value = true
    } else if (errorData?.error === '礼品卡不存在') {
      giftCardMessage.value = '礼品卡码不存在\n请检查礼品卡码是否输入正确'
      showGiftCardDialog.value = true
    } else {
      giftCardMessage.value = errorData?.error || '礼品卡充值失败，请稍后重试'
      showGiftCardDialog.value = true
    }
  } finally {
    recharging.value = false
  }
}

// 快速礼品卡充值
const handleQuickGiftCardRecharge = async () => {
  if (!quickGiftCardCode.value || !quickGiftCardCode.value.trim()) {
    showToast('请输入礼品卡码')
    return
  }

  try {
    quickRecharging.value = true
    const response = await request.post('/balance/recharge/gift-card', {
      cardCode: quickGiftCardCode.value.trim().toUpperCase()
    })

    showSuccessToast(`礼品卡充值成功！充值金额：¥${response.amount}`)
    userBalance.value = response.balance
    quickGiftCardCode.value = ''

    // 刷新交易记录
    await fetchTransactions()
  } catch (error) {
    console.error('礼品卡充值失败:', error)
    const errorData = error.response?.data

    if (errorData?.error === '礼品卡已被使用') {
      // 显示礼品卡已使用信息，保护用户隐私
      const usedTime = errorData?.usedTime || '未知时间'
      giftCardMessage.value = `该礼品卡已于 ${usedTime} 被使用\n每个礼品卡只能使用一次，请检查您的礼品卡码`
      showGiftCardDialog.value = true
    } else if (errorData?.error === '礼品卡不存在') {
      giftCardMessage.value = '礼品卡码不存在\n请检查礼品卡码是否输入正确'
      showGiftCardDialog.value = true
    } else {
      giftCardMessage.value = errorData?.error || '礼品卡充值失败，请稍后重试'
      showGiftCardDialog.value = true
    }
  } finally {
    quickRecharging.value = false
  }
}

// 快速支付处理
const handleQuickPayment = async (method) => {
  if (!quickRechargeAmount.value) {
    showToast('请输入充值金额')
    return
  }

  // 验证充值金额
  const amount = parseFloat(quickRechargeAmount.value)
  if (isNaN(amount) || amount <= 0) {
    showToast('请输入有效的充值金额')
    return
  }

  if (amount < 0.01) {
    showToast('充值金额不能小于0.01元')
    return
  }

  if (amount > 10000) {
    showToast('单次充值金额不能超过10000元')
    return
  }

  // 微信和支付宝支付开发中提示
  if (method === 'wechat' || method === 'alipay') {
    showToast('该支付方式功能开发中，请使用礼品卡充值')
    return
  }

  try {
    quickPaying.value = method
    const response = await request.post('/balance/recharge', {
      amount: amount,
      paymentMethod: method
    })

    showSuccessToast('充值成功')
    userBalance.value = response.balance
    quickRechargeAmount.value = ''

    // 刷新交易记录
    await fetchTransactions()
  } catch (error) {
    console.error('充值失败:', error)
    showToast(error.response?.data?.error || '充值失败')
  } finally {
    quickPaying.value = ''
  }
}


// 快速充值
const quickRecharge = (method) => {
  paymentMethod.value = method
  showPaymentMethods.value = false
  showRechargeModal.value = true
  // 设置默认金额
  if (!rechargeAmount.value) {
    rechargeAmount.value = '50'
  }
}

// 选择支付方式
const onPaymentMethodSelect = (action) => {
  paymentMethod.value = action.value
  giftCardCode.value = '' // 清空礼品卡码
  showPaymentMethods.value = false
}

// 格式化金额
const formatAmount = (amount) => {
  const prefix = amount >= 0 ? '+' : ''
  return `${prefix}¥${Math.abs(amount).toFixed(2)}`
}

// 获取金额样式类
const getAmountClass = (type) => {
  return type === 'RECHARGE' || type === 'REFUND' ? 'amount-positive' : 'amount-negative'
}

// 格式化时间
const formatTime = (timeString) => {
  const date = new Date(timeString)
  return `${date.getMonth() + 1}-${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

onMounted(() => {
  fetchBalance()
  fetchTransactions()
})
</script>

<style scoped>
.balance-page {
  min-height: 100vh;
  background-color: #f7f8fa;
  padding-bottom: 60px;
}

.balance-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 24px;
  margin: 16px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.balance-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.balance-title {
  font-size: 16px;
  opacity: 0.9;
}

.balance-amount {
  font-size: 32px;
  font-weight: bold;
  margin-bottom: 8px;
}

.balance-tip {
  font-size: 14px;
  opacity: 0.8;
}

.recharge-info {
  margin: 0 16px 24px;
  background: white;
  border-radius: 8px;
  padding: 16px;
}

.quick-recharge {
  margin-bottom: 16px;
}

.payment-methods {
  display: flex;
  gap: 12px;
  margin-top: 12px;
}

.payment-btn {
  flex: 1;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 500;
}

.wechat-btn {
  background: #07c160;
  color: white;
  border: none;
}

.wechat-btn:hover {
  background: #06ad56;
}

.alipay-btn {
  background: #1677ff;
  color: white;
  border: none;
}

.alipay-btn:hover {
  background: #1469d4;
}

.payment-btn .van-icon {
  font-size: 20px;
}

/* 充值金额区域 */
.recharge-amount-section {
  margin-bottom: 20px;
}

.amount-input {
  margin-bottom: 12px;
}

.amount-input .van-field__control {
  font-size: 16px;
  font-weight: 500;
}

.currency-unit {
  color: #646566;
  font-size: 14px;
  font-weight: normal;
}

.quick-amounts-small {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.quick-amount-small {
  min-width: 60px !important;
  height: 28px !important;
  font-size: 12px !important;
  border-radius: 14px !important;
  background: #f7f8fa;
  color: #646566;
  border: 1px solid #ebedf0;
}

.quick-amount-small:hover {
  background: #ebedf0;
}

/* 支付方式区域 */
.payment-section {
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid #f0f0f0;
}

.payment-title {
  font-size: 14px;
  color: #323233;
  margin-bottom: 12px;
  font-weight: 500;
}

.payment-grid {
  display: flex;
  gap: 12px;
}

.payment-option {
  flex: 1;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 500;
}

.wechat-option {
  background: #07c160;
  color: white;
  border: none;
}

.wechat-option:hover {
  background: #06ad56;
}

.alipay-option {
  background: #1677ff;
  color: white;
  border: none;
}

.alipay-option:hover {
  background: #1469d4;
}

.payment-option .van-icon {
  font-size: 20px;
}

/* 礼品卡区域 */
.gift-card-section {
  margin-bottom: 0;
}

.gift-card-title {
  font-size: 14px;
  color: #323233;
  margin-bottom: 12px;
  font-weight: 500;
}

.gift-card-input-group {
  margin-bottom: 8px;
}

.gift-card-input {
  border-radius: 8px;
}

.gift-card-input .van-field__control {
  font-size: 14px;
  letter-spacing: 1px;
}

.gift-card-tip {
  font-size: 12px;
  color: #969799;
  text-align: center;
  margin-top: 8px;
}

.recharge-info h4 {
  margin-bottom: 12px;
  color: #323233;
  font-size: 16px;
}

.info-content p {
  margin: 8px 0;
  color: #646566;
  font-size: 14px;
  line-height: 1.5;
}

.recharge-modal {
  padding: 20px;
}

.recharge-form {
  margin: 20px 0;
}

.currency-unit {
  color: #646566;
  font-size: 14px;
}

.quick-amounts {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 16px;
  padding: 12px;
  background: #f7f8fa;
  border-radius: 8px;
}

.quick-label {
  color: #323233;
  font-size: 14px;
  margin-right: 8px;
}

.quick-amount-btn {
  min-width: 60px !important;
  height: 32px !important;
  font-size: 12px !important;
  border-radius: 16px !important;
}

.recharge-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.recharge-actions .van-button {
  flex: 1;
}

.transactions {
  margin: 0 16px;
}

.transactions h4 {
  margin-bottom: 16px;
  color: #323233;
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

.amount-positive {
  color: #07c160;
}

.amount-negative {
  color: #ee0a24;
}

.recharge-modal {
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.recharge-modal h3 {
  text-align: center;
  margin-bottom: 24px;
}

.recharge-form {
  flex: 1;
  margin-bottom: 20px;
}

.recharge-actions {
  display: flex;
  gap: 12px;
}

.recharge-actions .van-button {
  flex: 1;
}

/* 礼品卡对话框样式 */
.gift-card-dialog-content {
  padding: 16px;
  text-align: center;
}

.gift-card-dialog-content p {
  margin: 0;
  line-height: 1.6;
  font-size: 16px;
  color: #323233;
  white-space: pre-line;
}
</style>