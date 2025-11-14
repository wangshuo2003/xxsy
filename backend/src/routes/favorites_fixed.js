const express = require('express')
const { PrismaClient } = require('@prisma/client')
const router = express.Router()

const prisma = new PrismaClient()

// 获取用户收藏列表
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id
    const { type } = req.query // type: 'policy' 或 'activity'

    let query = `
      SELECT
        f.id,
        f.targetType,
        f.targetId,
        f.createdAt
      FROM favorites f
      WHERE f.userId = ?
    `
    const params = [userId]

    if (type) {
      query += ' AND f.targetType = ?'
      params.push(type)
    }

    query += ' ORDER BY f.createdAt DESC'

    const [favorites] = await prisma.$queryRawUnsafe(query, ...params)

    // 获取详细信息
    const result = await Promise.all(
      favorites.map(async (favorite) => {
        let detail = null

        if (favorite.targetType === 'policy') {
          const [policyResult] = await prisma.$queryRawUnsafe(
            'SELECT id, title, description, createdAt FROM policies WHERE id = ?',
            favorite.targetId
          )
          detail = policyResult
        } else if (favorite.targetType === 'activity') {
          const [activityResult] = await prisma.$queryRawUnsafe(
            'SELECT id, name, description, time, location, maxPeople, baseId, createdAt FROM activities WHERE id = ?',
            favorite.targetId
          )

          if (activityResult) {
            const [baseResult] = await prisma.$queryRawUnsafe(
              'SELECT name FROM bases WHERE id = ?',
              activityResult.baseId
            )
            activityResult.baseName = baseResult?.name || ''
          }
          detail = activityResult
        }

        return {
          id: favorite.id,
          targetType: favorite.targetType,
          targetId: favorite.targetId,
          createdAt: favorite.createdAt,
          detail
        }
      })
    )

    // 过滤掉详情不存在的收藏
    const validFavorites = result.filter(item => item.detail !== null)

    res.json({
      message: '获取收藏列表成功',
      data: validFavorites
    })
  } catch (error) {
    console.error('获取收藏列表失败:', error)
    res.status(500).json({ error: '获取收藏列表失败' })
  }
})

// 添加收藏
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id
    const { targetType, targetId } = req.body

    if (!targetType || !targetId) {
      return res.status(400).json({ error: '缺少必要参数' })
    }

    if (!['policy', 'activity'].includes(targetType)) {
      return res.status(400).json({ error: '无效的收藏类型' })
    }

    // 检查目标是否存在
    let targetExists = false
    if (targetType === 'policy') {
      const [policy] = await prisma.$queryRawUnsafe(
        'SELECT id FROM policies WHERE id = ?',
        targetId
      )
      targetExists = !!policy
    } else if (targetType === 'activity') {
      const [activity] = await prisma.$queryRawUnsafe(
        'SELECT id FROM activities WHERE id = ?',
        targetId
      )
      targetExists = !!activity
    }

    if (!targetExists) {
      return res.status(404).json({ error: '收藏的目标不存在' })
    }

    // 检查是否已经收藏
    const [existingFavorite] = await prisma.$queryRawUnsafe(
      'SELECT id FROM favorites WHERE userId = ? AND targetType = ? AND targetId = ?',
      userId, targetType, targetId
    )

    if (existingFavorite) {
      return res.status(400).json({ error: '已经收藏过了' })
    }

    // 创建收藏
    const [result] = await prisma.$queryRawUnsafe(
      'INSERT INTO favorites (userId, targetType, targetId, createdAt) VALUES (?, ?, ?, NOW())',
      userId, targetType, targetId
    )

    const [newFavorite] = await prisma.$queryRawUnsafe(
      'SELECT * FROM favorites WHERE id = ?',
      result.insertId
    )

    res.status(201).json({
      message: '收藏成功',
      data: newFavorite
    })
  } catch (error) {
    console.error('添加收藏失败:', error)
    res.status(500).json({ error: '添加收藏失败' })
  }
})

// 取消收藏
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.id
    const favoriteId = parseInt(req.params.id)

    if (isNaN(favoriteId)) {
      return res.status(400).json({ error: '无效的收藏ID' })
    }

    // 检查收藏是否存在且属于当前用户
    const [favorite] = await prisma.$queryRawUnsafe(
      'SELECT id FROM favorites WHERE id = ? AND userId = ?',
      favoriteId, userId
    )

    if (!favorite) {
      return res.status(404).json({ error: '收藏不存在' })
    }

    // 删除收藏
    await prisma.$queryRawUnsafe(
      'DELETE FROM favorites WHERE id = ?',
      favoriteId
    )

    res.json({
      message: '取消收藏成功'
    })
  } catch (error) {
    console.error('取消收藏失败:', error)
    res.status(500).json({ error: '取消收藏失败' })
  }
})

// 检查是否已收藏
router.get('/check', async (req, res) => {
  try {
    const userId = req.user.id
    const { targetType, targetId } = req.query

    if (!targetType || !targetId) {
      return res.status(400).json({ error: '缺少必要参数' })
    }

    const [favorite] = await prisma.$queryRawUnsafe(
      'SELECT id FROM favorites WHERE userId = ? AND targetType = ? AND targetId = ?',
      userId, targetType, parseInt(targetId)
    )

    res.json({
      isFavorited: !!favorite,
      favoriteId: favorite?.id || null
    })
  } catch (error) {
    console.error('检查收藏状态失败:', error)
    res.status(500).json({ error: '检查收藏状态失败' })
  }
})

module.exports = router