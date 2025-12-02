import request from './request'

const STORAGE_KEY = 'bingWallpaperToday'
const STORAGE_CAROUSEL_KEY = 'bingWallpaperCarousel'
// 默认使用本地缓存路径，失败再退到远程
const LOCAL_FALLBACK = '/api/uploads/bing/bing-latest.jpg'
const REMOTE_FALLBACK = 'https://www.bing.com/th?id=OHR.GuarAlMadagascar_ZH-CN5676201563_1920x1080.jpg'
// 初始兜底用远程，等本地拉取成功后会被覆盖为当天缓存
const DEFAULT_FALLBACK = REMOTE_FALLBACK
let cached = null
let fetchingFull = null
let fetchingFast = null

const setCache = (url) => {
  cached = url
  if (url) localStorage.setItem(STORAGE_KEY, url)
}

export const getBingFallback = () => {
  if (cached) return cached
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    // 兼容老的 bingXXXXXX.jpg 缓存，直接换成最新
    if (/\/bing\/bing\d{6}\.jpg$/.test(stored)) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      cached = stored
      return cached
    }
  }
  const carousel = getBingCarouselCache()
  if (carousel.length > 0) {
    const first = carousel[0]
    cached = first?.imageUrl || first?.localUrl || first?.remoteUrl
    localStorage.setItem(STORAGE_KEY, cached)
    return cached
  }
  return DEFAULT_FALLBACK || REMOTE_FALLBACK
}

export const getBingCarouselCache = () => {
  try {
    const raw = localStorage.getItem(STORAGE_CAROUSEL_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) || []
    // 过滤掉旧格式 bingXXXXXX.jpg，避免引用不存在的图片
    const filtered = Array.isArray(arr)
      ? arr.filter(item => {
          const url = item?.imageUrl || item?.localUrl || ''
          return !/\/bing\/bing\d{6}\.jpg$/.test(url)
        })
      : []
    if (filtered.length !== arr.length) {
      localStorage.setItem(STORAGE_CAROUSEL_KEY, JSON.stringify(filtered))
    }
    return filtered
  } catch (e) {
    return []
  }
}

// 预取今日壁纸（保存到本地缓存），并顺便返回最近 4 张缓存（今日+前三天）
// 快速模式：仅拉取今日，响应后后台再拉前三天；完整版则同时获取今日+前三天
export const prefetchBingToday = async (options = {}) => {
  const { fast = false, forceFull = false } = options
  const cachedCarousel = getBingCarouselCache()

  if (!fast && !forceFull && cached && cachedCarousel.length > 0) {
    // 如果只有 1 张，继续走完整版以拉取前三天
    if (cachedCarousel.length >= 4) {
      return { today: cached, images: cachedCarousel }
    }
  }

  if (fast) {
    if (fetchingFast) return fetchingFast
    fetchingFast = (async () => {
      try {
        const res = await request.get('/external/bing-cache', { params: { fast: 1 } })
        const todayUrl = res.data?.today || DEFAULT_FALLBACK || REMOTE_FALLBACK
        const images = res.data?.data || (todayUrl ? [{
          id: 'bing-today',
          title: 'Bing 今日壁纸',
          imageUrl: todayUrl,
          localUrl: todayUrl,
          remoteUrl: todayUrl,
          linkUrl: '#'
        }] : [])
        if (todayUrl) setCache(todayUrl)
        if (images.length > 0) {
          localStorage.setItem(STORAGE_CAROUSEL_KEY, JSON.stringify(images))
        }
        return { today: todayUrl, images }
      } catch (error) {
        console.error('快速预取 Bing 壁纸失败:', error)
        const fallback = getBingFallback()
        return { today: fallback, images: getBingCarouselCache() }
      } finally {
        fetchingFast = null
      }
    })()
    return fetchingFast
  }

  if (fetchingFull) return fetchingFull
  fetchingFull = (async () => {
    try {
      // 一次请求获取今日+前三天并缓存本地路径（后端已缓存文件）
      const res = await request.get('/external/bing-cache')
      const todayUrl = res.data?.today || DEFAULT_FALLBACK || REMOTE_FALLBACK
      let images = res.data?.data || []
      if ((!images || images.length === 0) && todayUrl) {
        images = [{
          id: 'bing-today',
          title: 'Bing 今日壁纸',
          imageUrl: todayUrl,
          localUrl: todayUrl,
          remoteUrl: todayUrl,
          linkUrl: '#'
        }]
      }
      if (todayUrl) setCache(todayUrl)
      if (images.length > 0) {
        localStorage.setItem(STORAGE_CAROUSEL_KEY, JSON.stringify(images))
      }
      return { today: todayUrl, images }
    } catch (error) {
      console.error('预取 Bing 壁纸失败:', error)
      const fallback = getBingFallback()
      return { today: fallback || REMOTE_FALLBACK, images: getBingCarouselCache() }
    } finally {
      fetchingFull = null
    }
  })()
  return fetchingFull
}
