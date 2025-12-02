import axios from 'axios'
import { showToast } from 'vant'

// 创建axios实例
const request = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求重试配置
const MAX_RETRIES = 3
const RETRY_DELAY = 1000 // 1秒

// 请求队列（用于节流）
const pendingRequests = new Map()
const REQUEST_THROTTLE_DELAY = 500 // 500ms节流

// 生成请求唯一标识
const generateRequestKey = (config) => {
  const { method, url, params, data } = config
  return `${method}-${url}-${JSON.stringify(params || {})}-${JSON.stringify(data || {})}`
}

// 等待重试
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    // 添加认证token
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // 请求节流检查
    const requestKey = generateRequestKey(config)
    const now = Date.now()

    if (pendingRequests.has(requestKey)) {
      const lastRequestTime = pendingRequests.get(requestKey)
      const timeSinceLastRequest = now - lastRequestTime

      if (timeSinceLastRequest < REQUEST_THROTTLE_DELAY) {
        // 如果是节流时间内重复请求，直接取消
        throw new axios.Cancel('请求过于频繁，请稍后再试')
      }
    }

    // 记录请求时间
    pendingRequests.set(requestKey, now)

    // 清理过期记录
    setTimeout(() => {
      pendingRequests.delete(requestKey)
    }, REQUEST_THROTTLE_DELAY * 2)

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
request.interceptors.response.use(
  (response) => {
    return response
  },
  async (error) => {
    const { config, response } = error

    // 如果是取消的请求，直接返回
    if (axios.isCancel(error)) {
      return Promise.reject(error)
    }

    // 429 错误处理（速率限制）
    if (response?.status === 429) {
      const retryCount = config.retryCount || 0

      if (retryCount < MAX_RETRIES) {
        config.retryCount = retryCount + 1

        // 计算退避延迟（指数退避）
        const delay = RETRY_DELAY * Math.pow(2, retryCount)
        console.log(`请求被速率限制，${delay}ms后重试（第${retryCount + 1}次）`)

        await sleep(delay)
        return request(config)
      } else {
        showToast('请求过于频繁，请稍后再试')
        return Promise.reject(error)
      }
    }

    // 其他错误处理
    if (response?.status === 401) {
      // 认证失败，跳转到登录页
      localStorage.removeItem('token')
      window.location.href = '/login'
      return Promise.reject(error)
    }

    if (response?.status === 500) {
      showToast('服务器错误，请稍后再试')
      return Promise.reject(error)
    }

    if (response?.status === 404) {
      showToast('请求的资源不存在')
      return Promise.reject(error)
    }

    // 网络错误
    if (!response) {
      showToast('网络连接失败，请检查网络设置')
      return Promise.reject(error)
    }

    return Promise.reject(error)
  }
)

export default request