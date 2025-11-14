const express = require('express')
const { PrismaClient } = require('@prisma/client')
const router = express.Router()

const prisma = new PrismaClient()

// 获取用户收藏列表
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id
    const { type } = req.query // type: 'policy' 或 'activity'

    let where = { userId: userId }
    if (type) {
      where.targetType = type
    }

    const favorites = await prisma.favorite.findMany({
      where: where,
      orderBy: { createdAt: 'desc' }
    })

    // 获取详细信息
    const result = await Promise.all(
      favorites.map(async (favorite) => {
        let detail = null

        if (favorite.targetType === 'policy') {
          const policyResult = await prisma.policy.findUnique({
            where: { id: favorite.targetId },
            select: { id: true, title: true, content: true, createdAt: true }
          })
          detail = policyResult
        } else if (favorite.targetType === 'activity') {
          const activityResult = await prisma.activity.findUnique({
            where: { id: favorite.targetId },
            select: {
              id: true,
              name: true,
              description: true,
              time: true,
              location: true,
              maxPeople: true,
              baseId: true,
              createdAt: true,
              base: { select: { name: true } }
            }
          })

          if (activityResult) {
            activityResult.baseName = activityResult.base?.name || ''
            delete activityResult.base
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

    // 过滤掉详情不存在的收藏（对应的内容被删除了）
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
      const policy = await prisma.policy.findUnique({
        where: { id: targetId }
      })
      targetExists = !!policy
    } else if (targetType === 'activity') {
      const activity = await prisma.activity.findUnique({
        where: { id: targetId }
      })
      targetExists = !!activity
    }

    if (!targetExists) {
      return res.status(404).json({ error: '收藏的目标不存在' })
    }

    // 检查是否已经收藏
    const existingFavorite = await prisma.favorite.findUnique({
      where: {
        userId_targetType_targetId: {
          userId: userId,
          targetType: targetType,
          targetId: targetId
        }
      }
    })

    if (existingFavorite) {
      return res.status(400).json({ error: '已经收藏过了' })
    }

    // 创建收藏
    const newFavorite = await prisma.favorite.create({
      data: {
        userId: userId,
        targetType: targetType,
        targetId: targetId
      }
    })

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
    const favorite = await prisma.favorite.findUnique({
      where: { id: favoriteId }
    })

    if (!favorite || favorite.userId !== userId) {
      return res.status(404).json({ error: '收藏不存在' })
    }

    // 删除收藏
    await prisma.favorite.delete({
      where: { id: favoriteId }
    })

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

    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_targetType_targetId: {
          userId: userId,
          targetType: targetType,
          targetId: parseInt(targetId)
        }
      }
    })

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