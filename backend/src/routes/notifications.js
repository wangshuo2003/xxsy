const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');

const prisma = new PrismaClient();

// 获取通知列表（管理员）
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, type, targetRole, isActive } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // 构建查询条件
    const where = {};

    if (type) {
      where.type = type;
    }

    if (targetRole) {
      where.targetRole = targetRole;
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              username: true,
              name: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.notification.count({ where })
    ]);

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      data: notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: totalPages
      }
    });
  } catch (error) {
    console.error('获取通知列表失败:', error);
    res.status(500).json({ error: '获取通知列表失败' });
  }
});

// 创建通知（管理员）
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, content, type, targetRole, isActive = true } = req.body;
    const userId = req.user.id;

    // 验证必填字段
    if (!title || !content) {
      return res.status(400).json({ error: '标题和内容不能为空' });
    }

    const notification = await prisma.notification.create({
      data: {
        title,
        content,
        type,
        targetRole,
        isActive,
        createdBy: userId
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            name: true
          }
        }
      }
    });

    res.status(201).json({
      message: '通知创建成功',
      data: notification
    });
  } catch (error) {
    console.error('创建通知失败:', error);
    res.status(500).json({ error: '创建通知失败' });
  }
});

// 更新通知
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { title, content, type, targetRole, isActive } = req.body;
    const { id } = req.params;

    // 验证通知是否存在
    const existingNotification = await prisma.notification.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingNotification) {
      return res.status(404).json({ error: '通知不存在' });
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (type !== undefined) updateData.type = type;
    if (targetRole !== undefined) updateData.targetRole = targetRole;
    if (isActive !== undefined) updateData.isActive = isActive;

    const notification = await prisma.notification.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            name: true
          }
        }
      }
    });

    res.json({
      message: '通知更新成功',
      data: notification
    });
  } catch (error) {
    console.error('更新通知失败:', error);
    res.status(500).json({ error: '更新通知失败' });
  }
});

// 删除通知
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // 验证通知是否存在
    const existingNotification = await prisma.notification.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingNotification) {
      return res.status(404).json({ error: '通知不存在' });
    }

    await prisma.notification.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: '通知删除成功' });
  } catch (error) {
    console.error('删除通知失败:', error);
    res.status(500).json({ error: '删除通知失败' });
  }
});

// 批量操作通知
router.post('/batch', authMiddleware, async (req, res) => {
  try {
    const { action, notificationIds } = req.body;

    if (!action || !notificationIds || !Array.isArray(notificationIds)) {
      return res.status(400).json({ error: '参数错误' });
    }

    const ids = notificationIds.map(id => parseInt(id));

    switch (action) {
      case 'delete':
        await prisma.notification.deleteMany({
          where: { id: { in: ids } }
        });
        res.json({ message: `成功删除 ${ids.length} 条通知` });
        break;

      case 'activate':
        await prisma.notification.updateMany({
          where: { id: { in: ids } },
          data: { isActive: true }
        });
        res.json({ message: `成功激活 ${ids.length} 条通知` });
        break;

      case 'deactivate':
        await prisma.notification.updateMany({
          where: { id: { in: ids } },
          data: { isActive: false }
        });
        res.json({ message: `成功停用 ${ids.length} 条通知` });
        break;

      default:
        res.status(400).json({ error: '不支持的操作类型' });
    }
  } catch (error) {
    console.error('批量操作失败:', error);
    res.status(500).json({ error: '批量操作失败' });
  }
});

// 获取用户可见的通知（前端用户API）
router.get('/user', async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // 如果用户已登录，获取用户信息
    let userRole = null;
    const authHeader = req.headers.authorization;

    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { role: true }
        });

        if (user) {
          userRole = user.role;
        }
      } catch (error) {
        // Token无效，忽略
      }
    }

    // 构建查询条件
    const where = {
      isActive: true
    };

    if (type) {
      where.type = type;
    }

    // 根据用户角色筛选通知
    if (userRole) {
      where.OR = [
        { targetRole: userRole },
        { targetRole: null } // 所有用户可见的通知
      ];
    } else {
      where.targetRole = null; // 只显示给所有用户的通知
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              username: true,
              name: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.notification.count({ where })
    ]);

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      data: notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: totalPages
      }
    });
  } catch (error) {
    console.error('获取用户通知失败:', error);
    res.status(500).json({ error: '获取用户通知失败' });
  }
});

// 获取统计信息（管理员）
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const [
      total,
      active,
      inactive,
      byType
    ] = await Promise.all([
      prisma.notification.count(),
      prisma.notification.count({ where: { isActive: true } }),
      prisma.notification.count({ where: { isActive: false } }),
      prisma.notification.groupBy({
        by: 'type',
        _count: {
          type: true
        }
      })
    ]);

    res.json({
      total,
      active,
      inactive,
      byType: byType.reduce((acc, item) => {
        acc[item.type] = item._count;
        return acc;
      }, {})
    });
  } catch (error) {
    console.error('获取通知统计失败:', error);
    res.status(500).json({ error: '获取通知统计失败' });
  }
});

module.exports = router;