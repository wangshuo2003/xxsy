<template>
  <div class="payment">
    <van-nav-bar
      title="确认支付"
      left-text="返回"
      left-arrow
      @click-left="$router.go(-1)"
    />

    <div v-if="loading" class="loading">
      <van-loading size="24px" vertical>加载中...</van-loading>
    </div>

    <div v-else class="payment-content">
      <!-- 商品信息 -->
      <div class="order-info">
        <div class="product-card">
          <img :src="productInfo.image" :alt="productInfo.name" class="product-image" />
          <div class="product-details">
            <h3>{{ productInfo.name }}</h3>
            <p class="product-type">{{ productTypeText }}</p>
            <p class="product-price">¥{{ productInfo.price }}</p>
          </div>
        </div>
      </div>

      <!-- 支付方式 -->
      <div class="payment-methods">
        <h4>选择支付方式</h4>
        <van-radio-group v-model="paymentMethod">
          <van-cell-group>
            <van-cell
              title="余额支付"
              clickable
              @click="paymentMethod = 'balance'"
              :disabled="userBalance < totalAmount"
            >
              <template #right-icon>
                <van-radio name="balance" />
              </template>
              <template #icon>
                <van-icon name="balance-o" size="24" color="#ff6034" />
              </template>
              <template #extra>
                <span v-if="userBalance < totalAmount" class="insufficient-balance">
                  余额不足 (¥{{ userBalance.toFixed(2) }})
                </span>
                <span v-else class="balance-available">
                  可用余额: ¥{{ userBalance.toFixed(2) }}
                </span>
              </template>
            </van-cell>
            <van-cell title="支付宝" clickable @click="paymentMethod = 'alipay'">
              <template #right-icon>
                <van-radio name="alipay" />
              </template>
              <template #icon>
                <van-icon name="alipay" size="24" color="#1677ff" />
              </template>
            </van-cell>
            <van-cell title="微信支付" clickable @click="paymentMethod = 'wechat'">
              <template #right-icon>
                <van-radio name="wechat" />
              </template>
              <template #icon>
                <van-icon name="wechat" size="24" color="#07c160" />
              </template>
            </van-cell>
          </van-cell-group>
        </van-radio-group>
      </div>

      <!-- 优惠码：仅活动可用 -->
      <div v-if="isActivityProduct" class="coupon-section">
        <van-field
          v-model="couponCode"
          label="优惠码"
          placeholder="请输入优惠码"
          right-icon="gift-o"
          @click-right-icon="handleApplyCoupon"
          :readonly="couponApplied"
        >
          <template #button>
            <van-button
              v-if="!couponApplied"
              size="small"
              type="primary"
              plain
              @click="handleApplyCoupon"
              :loading="applyingCoupon"
            >
              使用
            </van-button>
            <van-button
              v-else
              size="small"
              type="danger"
              plain
              @click="handleRemoveCoupon"
            >
              取消
            </van-button>
          </template>
        </van-field>

        <!-- 优惠码信息 -->
        <div v-if="couponInfo" class="coupon-info">
          <van-tag type="success" size="small">
            {{ couponInfo.description }}
          </van-tag>
          <span class="discount-amount">-¥{{ couponDiscount }}</span>
        </div>
        <div v-else-if="couponError" class="coupon-error">
          <van-icon name="warning-o" />
          <span>{{ couponError }}</span>
        </div>
      </div>

      <!-- 订单备注 -->
      <div class="order-note">
        <van-field
          v-model="orderNote"
          label="备注"
          type="textarea"
          placeholder="选填，请输入您的备注信息"
          rows="3"
          maxlength="100"
          show-word-limit
        />
      </div>

      <!-- 价格明细 -->
      <div class="price-details">
        <div class="price-row">
          <span>商品金额</span>
          <span>¥{{ productInfo.price }}</span>
        </div>
        <div v-if="couponInfo" class="price-row discount-row">
          <span>优惠金额</span>
          <span class="discount-text">-¥{{ couponDiscount }}</span>
        </div>
        <div class="price-divider"></div>
        <div class="price-row total">
          <span>合计</span>
          <span class="total-amount">¥{{ finalAmount }}</span>
        </div>
        <div v-if="finalAmount <= 0" class="free-payment-notice">
          <van-icon name="fire-o" />
          <span>本次订单免费，无需支付！</span>
        </div>
      </div>
    </div>

    <!-- 底部支付栏 -->
    <div class="bottom-bar">
      <div class="price-info">
        <span class="total-label">{{ finalAmount > 0 ? '实付金额：' : '应付金额：' }}</span>
        <span class="total-price">¥{{ finalAmount }}</span>
      </div>
      <van-button
        :type="finalAmount > 0 ? 'primary' : 'success'"
        size="large"
        @click="handlePayment"
        :loading="paying"
        class="pay-button"
      >
        {{ finalAmount > 0 ? '立即支付' : '确认订单' }}
      </van-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { showToast, showSuccessToast, showConfirmDialog } from 'vant'
import request from '@/api/request'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const loading = ref(true)
const paying = ref(false)
const paymentMethod = ref('balance') // 默认选择余额支付
const orderNote = ref('')
const userBalance = ref(0)

// 优惠码相关
const couponCode = ref('')
const couponInfo = ref(null)
const couponApplied = ref(false)
const applyingCoupon = ref(false)
const couponError = ref('')

// 商品信息
const productInfo = ref({
  id: '',
  name: '',
  price: '0.00',
  image: '',
  type: '' // 'activity' 或 'service'
})

// 计算属性
const productTypeText = computed(() => {
  return productInfo.value.type === 'activity' ? '研学活动' : '服务'
})

const isActivityProduct = computed(() => productInfo.value.type === 'activity')

const couponDiscount = computed(() => {
  if (!couponInfo.value) return '0.00'
  return parseFloat(couponInfo.value.amount || 0).toFixed(2)
})

const totalAmount = computed(() => {
  const price = parseFloat(productInfo.value.price) || 0
  const discount = parseFloat(couponDiscount.value) || 0
  const final = Math.max(0, price - discount).toFixed(2)
  return final
})

// 免费支付检查
const isFreePayment = computed(() => {
  return parseFloat(totalAmount.value) <= 0
})

// 为了在模板中保持一致的变量名
const finalAmount = computed(() => {
  return totalAmount.value
})

// 初始化商品信息
const initProductInfo = () => {
  const { type, id, name, price, image } = route.query

  productInfo.value = {
    id: id || '',
    name: name || '未知商品',
    price: price || '0.00',
    image: image || '/default-product.jpg',
    type: type || ''
  }

  loading.value = false
}

// 应用优惠码
const handleApplyCoupon = async () => {
  if (!isActivityProduct.value) {
    showToast('只有活动订单可以使用基地优惠码')
    return
  }

  if (!couponCode.value.trim()) {
    showToast('请输入优惠码')
    return
  }

  if (!productInfo.value.id) {
    showToast('缺少活动信息')
    return
  }

  applyingCoupon.value = true
  couponError.value = ''

  try {
    const response = await request.post('/base-coupons/validate', {
      couponCode: couponCode.value.trim(),
      activityId: productInfo.value.id
    })

    const coupon = response.coupon
    couponInfo.value = {
      ...coupon,
      amount: parseFloat(coupon.amount).toFixed(2),
      description: `基地专属优惠 - ¥${parseFloat(coupon.amount).toFixed(2)}`
    }
    couponCode.value = coupon.couponCode
    couponApplied.value = true
    showToast('优惠码应用成功')
  } catch (error) {
    console.error('应用优惠码失败:', error)
    couponInfo.value = null
    couponApplied.value = false
    const message = error.response?.data?.error || '优惠码无效或已过期'
    couponError.value = message
    showToast(message)
  } finally {
    applyingCoupon.value = false
  }
}

// 移除优惠码
const handleRemoveCoupon = () => {
  couponInfo.value = null
  couponApplied.value = false
  couponCode.value = ''
  couponError.value = ''
  showToast('已取消优惠码')
}

// 处理支付
const handlePayment = async () => {
  // 检查用户是否登录
  if (!userStore.isLoggedIn) {
    showToast('请先登录')
    router.push('/login')
    return
  }

  const payAmount = parseFloat(totalAmount.value)
  const confirmText = payAmount > 0
    ? `确认支付 ¥${payAmount.toFixed(2)} 吗？`
    : `确认创建订单？${isFreePayment.value ? '（无需支付）' : ''}`

  // 确认支付/订单
  try {
    await showConfirmDialog({
      title: payAmount > 0 ? '确认支付' : '确认订单',
      message: confirmText,
    })
  } catch {
    return // 用户取消
  }

  paying.value = true

  try {
    const appliedCouponCode = couponApplied.value && couponInfo.value
      ? couponInfo.value.couponCode
      : null

    let orderData = {
      amount: payAmount,
      note: orderNote.value,
      paymentMethod: paymentMethod.value,
      couponCode: isActivityProduct.value ? appliedCouponCode : null,
      couponDiscount: couponApplied.value ? couponDiscount.value : null
    }

    let response

    if (productInfo.value.type === 'activity') {
      // 创建活动订单
      response = await request.post('/orders/activity', {
        activityId: parseInt(productInfo.value.id),
        ...orderData
      })
    } else {
      // 创建服务订单
      response = await request.post('/orders', {
        serviceId: parseInt(productInfo.value.id),
        ...orderData
      })
    }

    // 检查是否是已有订单
    let successMessage
    if (response.existingOrder) {
      if (response.message.includes('支付成功')) {
        successMessage = '支付成功！'
        showSuccessToast(successMessage)
      } else if (response.message.includes('已支付')) {
        successMessage = '订单已支付'
        showSuccessToast(successMessage)
      } else if (response.message.includes('订单确认成功')) {
        successMessage = '订单确认成功！'
        showSuccessToast(successMessage)
      } else {
        successMessage = '找到已有订单，请查看订单详情'
        showSuccessToast(successMessage)
      }
    } else {
      successMessage = payAmount > 0 ? '支付成功！订单已创建' : '订单创建成功！'
      showSuccessToast(successMessage)
    }

    // 跳转到订单详情或订单列表
    router.push('/orders')
  } catch (error) {
    console.error('支付失败:', error)
    showToast(error.response?.data?.error || '订单创建失败，请稍后重试')
  } finally {
    paying.value = false
  }
}

// 获取用户余额
const fetchUserBalance = async () => {
  try {
    const response = await request.get('/balance')
    userBalance.value = response.balance
  } catch (error) {
    console.error('获取用户余额失败:', error)
  }
}

onMounted(() => {
  initProductInfo()
  fetchUserBalance()
})
</script>

<style scoped>
.payment {
  min-height: 100vh;
  background-color: #f7f8fa;
  padding-bottom: 80px;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 300px;
}

.payment-content {
  padding: 16px;
}

.order-info {
  margin-bottom: 16px;
}

.product-card {
  background: white;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  gap: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.product-image {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
}

.product-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.product-details h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
  line-height: 1.4;
}

.product-type {
  margin: 4px 0;
  font-size: 14px;
  color: #666;
}

.product-price {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #ff6034;
}

.payment-methods {
  background: white;
  border-radius: 8px;
  margin-bottom: 16px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.insufficient-balance {
  color: #ee0a24;
  font-size: 12px;
}

.balance-available {
  color: #07c160;
  font-size: 12px;
}

.payment-methods h4 {
  margin: 0;
  padding: 16px;
  font-size: 16px;
  font-weight: 600;
  color: #333;
  border-bottom: 1px solid #f0f0f0;
}

.order-note {
  background: white;
  border-radius: 8px;
  margin-bottom: 16px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.coupon-section {
  background: white;
  border-radius: 8px;
  margin-bottom: 16px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.coupon-info {
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background-color: #f0f9ff;
  border-radius: 4px;
}

.coupon-error {
  margin-top: 8px;
  padding: 0 16px 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #ee0a24;
}

.discount-amount {
  font-size: 14px;
  font-weight: 600;
  color: #07c160;
}

.discount-row {
  color: #07c160 !important;
}

.discount-text {
  font-weight: 600;
}

.free-payment-notice {
  margin-top: 12px;
  padding: 8px 16px;
  background: linear-gradient(135deg, #ff6b35, #f7931e);
  color: white;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-weight: 600;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.8; }
  100% { opacity: 1; }
}

.price-details {
  background: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.price-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 14px;
}

.price-row:last-child {
  margin-bottom: 0;
}

.price-row.total {
  font-weight: 600;
  font-size: 16px;
}

.total-amount {
  color: #ff6034;
  font-size: 18px;
  font-weight: 700;
}

.price-divider {
  height: 1px;
  background-color: #f0f0f0;
  margin: 12px 0;
}

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: white;
  padding: 12px 16px;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.price-info {
  display: flex;
  align-items: baseline;
}

.total-label {
  font-size: 14px;
  color: #666;
}

.total-price {
  font-size: 20px;
  font-weight: 700;
  color: #ff6034;
}

.pay-button {
  flex: 1;
  margin-left: 16px;
  max-width: 120px;
}
</style>
