const express = require('express')
const fs = require('fs')
const path = require('path')
const router = express.Router()

// 内存缓存配置
const memoryCache = new Map()
const CACHE_DURATION = 30 * 60 * 1000 // 30分钟缓存
const BING_CACHE_KEY = 'bing_wallpapers'

// 简单的缓存函数
const getCache = (key) => {
  const cached = memoryCache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data
  }
  return null
}

const setCache = (key, data) => {
  memoryCache.set(key, {
    data,
    timestamp: Date.now()
  })
}

// 定期清理过期缓存
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of memoryCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      memoryCache.delete(key)
    }
  }
}, 5 * 60 * 1000) // 每5分钟清理一次

// 与 index.js 的静态资源目录保持一致：/app/uploads
const bingDir = path.join(__dirname, '../../uploads/bing')
const carouselDir = path.join(__dirname, '../../uploads/carousels')

const ensureDir = async (dir) => {
  await fs.promises.mkdir(dir, { recursive: true })
}

// 读取本地已存在的轮播图文件（png/jpg/jpeg/bmp），按文件名倒序，返回最多 limit 张
const readLocalCarousel = async (limit = 4) => {
  try {
    const files = await fs.promises.readdir(carouselDir)
    const images = files.filter((f) => /\.(png|jpe?g|bmp)$/i.test(f))
    images.sort((a, b) => b.localeCompare(a)) // 文件名字母降序
    const picked = images.slice(0, limit)
    return picked.map((filename) => {
      const url = `/api/uploads/carousels/${filename}`
      return {
        id: filename,
        title: filename,
        imageUrl: url,
        localUrl: url,
        remoteUrl: url,
        linkUrl: '#'
      }
    })
  } catch (e) {
    return []
  }
}

// 读取本地已缓存的 Bing 壁纸（按日期倒序）
const readLocalBing = async (limit = 4) => {
  try {
    const files = await fs.promises.readdir(bingDir)
    const jpgs = files.filter((f) => /^\d{8}\.jpg$/.test(f))
    jpgs.sort((a, b) => b.localeCompare(a)) // 日期倒序
    const picked = jpgs.slice(0, limit)
    return picked.map((filename) => {
      const url = `/api/uploads/bing/${filename}`
      return {
        id: filename,
        title: 'Bing 壁纸',
        imageUrl: url,
        localUrl: url,
        remoteUrl: url,
        linkUrl: '#'
      }
    })
  } catch (e) {
    return []
  }
}

const mergeUniqueById = (items) => {
  const map = new Map()
  for (const item of items) {
    if (item && item.id) map.set(item.id, item)
  }
  return Array.from(map.values()).sort((a, b) => b.id.localeCompare(a.id))
}

const fetchBingMeta = async (idx = 0, n = 4) => {
  // 检查内存缓存
  const cacheKey = `bing_meta_${idx}_${n}`
  const cached = getCache(cacheKey)
  if (cached) {
    console.log('使用Bing元数据缓存:', cacheKey)
    return cached
  }

  const response = await fetch(`https://www.bing.com/HPImageArchive.aspx?format=js&idx=${idx}&n=${n}&mkt=zh-CN`)
  if (!response.ok) throw new Error(`Bing status ${response.status}`)
  const data = await response.json()
  const images = data?.images || []

  // 缓存结果（15分钟）
  setCache(cacheKey, images)
  return images
}

const downloadImage = async (url, filepath) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download status ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  await fs.promises.writeFile(filepath, buffer)
}

const formatDateCode = (startdate) => {
  if (startdate && startdate.length >= 8) return startdate.slice(0, 8)
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

const cacheBingImage = async (imgMeta) => {
  const { url, startdate, copyright, copyrightlink } = imgMeta
  const fullUrl = url?.startsWith('http') ? url : `https://www.bing.com${url}`
  const dateCode = formatDateCode(startdate)
  const filename = `${dateCode}.jpg` // 形如 20251126
  const localPath = path.join(bingDir, filename)
  const localPublicUrl = `/api/uploads/bing/${filename}`

  await ensureDir(bingDir)
  try {
    await fs.promises.access(localPath, fs.constants.F_OK)
  } catch {
    await downloadImage(fullUrl, localPath)
  }

  // 不再强制复制 bing-latest.jpg，避免部分宿主文件系统报错；兜底直接用 today 图

  return {
    id: filename,
    title: copyright || 'Bing 壁纸',
    imageUrl: localPublicUrl, // 默认使用本地缓存
    localUrl: localPublicUrl,
    remoteUrl: fullUrl,
    linkUrl: copyrightlink ? (copyrightlink.startsWith('http') ? copyrightlink : `https://www.bing.com${copyrightlink}`) : '#'
  }
}

// Bing 最近壁纸，支持 idx/n 参数（默认 idx=0, n=4，最大 n=8），并缓存到本地 uploads/bing
router.get('/bing-wallpapers', async (req, res) => {
  try {
    const idx = Math.max(0, parseInt(req.query.idx, 10) || 0)
    const n = Math.min(8, Math.max(1, parseInt(req.query.n, 10) || 4))
    const metas = await fetchBingMeta(idx, n)
    const cached = []
    for (const meta of metas) {
      cached.push(await cacheBingImage(meta))
    }
    res.json({ data: cached })
  } catch (error) {
    console.error('获取 Bing 壁纸失败:', error)
    res.status(500).json({ error: '获取 Bing 壁纸失败' })
  }
})

// 获取并返回已缓存的今日 + 最近三天（共4张），若未缓存则下载。先确保今日存在。
router.get('/bing-cache', async (req, res) => {
  try {
    const fast = req.query.fast === '1' || req.query.fast === 'true'
    const cacheKey = fast ? 'bing_cache_fast' : 'bing_cache_full'

    // 检查内存缓存（快速模式缓存5分钟，完整模式缓存30分钟）
    const cached = getCache(cacheKey)
    if (cached) {
      console.log(`使用Bing缓存: ${cacheKey}`)
      return res.json(cached)
    }

    await ensureDir(bingDir)

    // 优先使用后端静态目录下的本地轮播图（carousels）
    const localCarousel = await readLocalCarousel(4)
    if (localCarousel.length > 0) {
      const result = {
        today: localCarousel[0]?.imageUrl || null,
        data: localCarousel
      }
      // 缓存结果
      setCache(cacheKey, result)
      return res.json(result)
    }

    // 先读取本地已有的最近 4 张
    let localList = await readLocalBing(4)

    // 先尝试直接使用本地已有的今日壁纸（形如 20251126.jpg），有则不重复下载
    const todayCode = formatDateCode()
    const todayFilename = `${todayCode}.jpg`
    const todayLocalPath = path.join(bingDir, todayFilename)
    let todayItem = localList.find((i) => i.id === todayFilename) || null
    try {
      if (!todayItem) {
        await fs.promises.access(todayLocalPath, fs.constants.F_OK)
        const todayLocalUrl = `/api/uploads/bing/${todayFilename}`
        todayItem = {
          id: todayFilename,
          title: 'Bing 壁纸',
          imageUrl: todayLocalUrl,
          localUrl: todayLocalUrl,
          remoteUrl: todayLocalUrl,
          linkUrl: '#'
        }
        localList = mergeUniqueById([todayItem, ...localList])
      }
      // 确保 bing-latest.jpg 同步为今日
      const latestPath = path.join(bingDir, 'bing-latest.jpg')
      try {
        await fs.promises.copyFile(todayLocalPath, latestPath)
      } catch (e) {
        console.error('同步 bing-latest 失败:', e)
      }
    } catch {
      // 本地无缓存时再拉 Bing 元数据下载
      const todayMeta = await fetchBingMeta(0, 1)
      todayItem = todayMeta[0] ? await cacheBingImage(todayMeta[0]) : null
      localList = mergeUniqueById([todayItem, ...localList])
    }

    let more = []

    // 再拉前三天（idx 1, n 3）
    const fetchMore = async () => {
      const moreMetas = await fetchBingMeta(1, 3)
      const results = []
      for (const meta of moreMetas) {
        results.push(await cacheBingImage(meta))
      }
      return results
    }

    if (fast) {
      // 快速模式：返回已有（含今日），缺少的后台再补
      if (localList.length < 4) {
        fetchMore().then((items) => {
          localList = mergeUniqueById([...localList, ...items]).slice(0, 4)
        }).catch((e) => console.error('后台拉取前三天 Bing 壁纸失败:', e))
      }
    } else {
      more = await fetchMore()
      localList = mergeUniqueById([...localList, ...more]).slice(0, 4)
    }

    const result = localList.slice(0, 4)

    res.json({
      today: todayItem?.imageUrl || todayItem?.localUrl || todayItem?.remoteUrl || (result[0]?.imageUrl || null),
      data: result
    })
  } catch (error) {
    console.error('缓存 Bing 壁纸失败:', error)
    res.status(500).json({ error: '缓存 Bing 壁纸失败' })
  }
})

module.exports = router
