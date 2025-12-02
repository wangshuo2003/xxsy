import request from './request'

// API调用缓存
const apiCache = new Map()
const CACHE_DURATION = 5 * 60 * 1000 // 5分钟缓存

// 请求队列管理
const requestQueue = new Map()
const PENDING_REQUEST_TIMEOUT = 10000 // 10秒

/**
 * 智能API请求优化器
 * @param {string} url - 请求URL
 * @param {object} config - 请求配置
 * @param {object} options - 优化选项
 * @returns {Promise} - 请求结果
 */
export const optimizedRequest = async (url, config = {}, options = {}) => {
  const {
    cache = true,
    cacheKey = null,
    cacheDuration = CACHE_DURATION,
    deduplication = true,
    retry = true
  } = options

  // 生成缓存键
  const finalCacheKey = cacheKey || `${url}-${JSON.stringify(config.params || {})}-${JSON.stringify(config.data || {})}`

  // 检查缓存
  if (cache) {
    const cached = apiCache.get(finalCacheKey)
    if (cached && Date.now() - cached.timestamp < cacheDuration) {
      console.log(`使用缓存数据: ${finalCacheKey}`)
      return cached.data
    }
  }

  // 请求去重
  if (deduplication) {
    const existingRequest = requestQueue.get(finalCacheKey)
    if (existingRequest) {
      console.log(`等待进行中的请求: ${finalCacheKey}`)
      return existingRequest
    }
  }

  // 创建新的请求
  const requestPromise = request(url, config)
    .then(response => {
      // 缓存结果
      if (cache) {
        apiCache.set(finalCacheKey, {
          data: response,
          timestamp: Date.now()
        })
      }

      // 清理请求队列
      requestQueue.delete(finalCacheKey)
      return response
    })
    .catch(error => {
      // 清理请求队列
      requestQueue.delete(finalCacheKey)
      throw error
    })

  // 添加到请求队列
  if (deduplication) {
    requestQueue.set(finalCacheKey, requestPromise)

    // 设置超时清理
    setTimeout(() => {
      requestQueue.delete(finalCacheKey)
    }, PENDING_REQUEST_TIMEOUT)
  }

  return requestPromise
}

/**
 * 清理指定缓存
 * @param {string} cacheKey - 缓存键
 */
export const clearCache = (cacheKey) => {
  if (cacheKey) {
    apiCache.delete(cacheKey)
  } else {
    apiCache.clear()
  }
}

/**
 * 清理所有缓存
 */
export const clearAllCache = () => {
  apiCache.clear()
  requestQueue.clear()
}

/**
 * 获取缓存统计
 */
export const getCacheStats = () => {
  return {
    cacheSize: apiCache.size,
    queueSize: requestQueue.size,
    cacheKeys: Array.from(apiCache.keys())
  }
}

// 定期清理过期缓存
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of apiCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      apiCache.delete(key)
    }
  }
}, 60000) // 每分钟清理一次