const express = require('express')
const { body, validationResult } = require('express-validator')
const bcrypt = require('bcryptjs')
const prisma = require('../config/database')
const { authMiddleware, roleMiddleware } = require('../middleware/auth')

const router = express.Router()

const recordUserHistory = async (userSnapshot, changedBy) => {
  if (!userSnapshot) return
  try {
    await prisma.userHistory.create({
      data: {
        userId: userSnapshot.id,
        changedBy,
        username: userSnapshot.username,
        name: userSnapshot.name,
        phone: userSnapshot.phone,
        school: userSnapshot.school,
        grade: userSnapshot.grade,
        className: userSnapshot.className,
        role: userSnapshot.role,
        isDisabled: Boolean(userSnapshot.isDisabled)
      }
    })
  } catch (error) {
    console.error('记录用户历史失败:', error)
  }
}

router.get('/', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), async (req, res) => {
  try {
    const { page = 1, limit = 10, role, search, sortBy = 'name', sortOrder = 'asc' } = req.query
    const { user } = req
    const where = {}

    if (user.role === 'ACTIVITY_ADMIN') {
      // 活动管理员可以查看学生用户
      // 并且可以查看与自己管理基地相关的活动管理员
      const managedBases = await prisma.base.findMany({
        where: {
          admins: {
            some: {
              id: user.id
            }
          }
        },
        select: {
          id: true
        }
      })
      const managedBaseIds = managedBases.map(base => base.id)

      where.OR = [
        { role: 'STUDENT' },
        {
          AND: [
            { role: 'ACTIVITY_ADMIN' },
            {
              adminOfBases: {
                some: {
                  id: {
                    in: managedBaseIds
                  }
                }
              }
            }
          ]
        }
      ]
    } else if (role && user.role === 'SUPER_ADMIN') {
      where.role = role
    }

    if (search) {
      where.OR = [
        { username: { contains: search } },
        { name: { contains: search } },
        { school: { contains: search } },
        { phone: { contains: search } },
        { grade: { contains: search } },
        { className: { contains: search } }
      ]
    }

    // 构建排序参数
    let orderBy = {}
    if (sortBy === 'name') {
      orderBy = { name: sortOrder }
    } else if (sortBy === 'createdAt') {
      orderBy = { createdAt: sortOrder }
    } else {
      orderBy = { name: 'asc' } // 默认按名字字母顺序
    }

    const total = await prisma.user.count({ where })

    let users
    if (where.role === 'ACTIVITY_ADMIN') {
      users = await prisma.user.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: parseInt(limit),
        include: {
          adminOfBases: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })
      // Merge Base_managerId and adminOfBases
      users = users.map(user => {
        const allBases = [...(user.Base_managerId || []), ...(user.adminOfBases || [])]
        // Deduplicate by ID
        const uniqueBases = Array.from(new Map(allBases.map(item => [item.id, item])).values())
        return {
          ...user,
          adminOfBases: uniqueBases
        }
      })
    } else {
      users = await prisma.user.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: parseInt(limit),
        select: {
          id: true,
          username: true,
          name: true,
          phone: true,
          school: true,
          grade: true,
          role: true,
          avatar: true,
          createdAt: true,
          isDisabled: true,
          className: true
        }
      })
    }
    console.log('Users API - 返回用户数据:', users)

    res.json({
      data: users,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.get('/:id', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), async (req, res) => {
  try {
    const { user } = req
    const targetUser = await prisma.user.findUnique({
      where: { id: parseInt(req.params.id) },
      select: {
        id: true,
        username: true,
        name: true,
        phone: true,
        school: true,
        grade: true,
        role: true,
        createdAt: true,
        certificates: true,
        activities: {
          include: { activity: { select: { name: true } } }
        },
        orders: {
          include: { service: { select: { title: true } } }
        }
      }
    })

    if (!targetUser) return res.status(404).json({ error: '用户不存在' })

    // 权限控制：活动管理员只能查看学生用户或与自己管理基地相关的活动管理员
    if (user.role === 'ACTIVITY_ADMIN') {
      if (targetUser.role === 'STUDENT') {
        // OK to view students
      } else if (targetUser.role === 'ACTIVITY_ADMIN') {
        // Check if the target ACTIVITY_ADMIN manages any of the same bases as the current user
        const currentUserManagedBases = await prisma.base.findMany({
          where: {
            admins: {
              some: {
                id: user.id
              }
            }
          },
          select: { id: true }
        })
        const currentUserManagedBaseIds = currentUserManagedBases.map(base => base.id)

        const targetUserManagedBases = await prisma.base.findMany({
          where: {
            admins: {
              some: {
                id: targetUser.id
              }
            }
          },
          select: { id: true }
        })
        const targetUserManagedBaseIds = targetUserManagedBases.map(base => base.id)

        const hasSharedBases = currentUserManagedBaseIds.some(id => targetUserManagedBaseIds.includes(id))

        if (!hasSharedBases) {
          return res.status(403).json({ error: '权限不足，无法查看该活动管理员' })
        }
      } else {
        // Activity admin cannot view SUPER_ADMIN
        return res.status(403).json({ error: '权限不足' })
      }
    }

    res.json({ data: targetUser })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.get('/:id/history', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), async (req, res) => {
  try {
    const targetUser = await prisma.user.findUnique({
      where: { id: parseInt(req.params.id) },
      select: { id: true, role: true }
    })

    if (!targetUser) return res.status(404).json({ error: '用户不存在' })

    if (req.user.role === 'ACTIVITY_ADMIN' && targetUser.role !== 'STUDENT') {
      return res.status(403).json({ error: '权限不足' })
    }

    const histories = await prisma.userHistory.findMany({
      where: { userId: targetUser.id },
      orderBy: { createdAt: 'desc' },
      include: {
        changedByUser: {
          select: { id: true, name: true, username: true }
        }
      }
    })

    const data = histories.map((item) => ({
      id: item.id,
      username: item.username,
      name: item.name,
      phone: item.phone,
      school: item.school,
      grade: item.grade,
      className: item.className,
      role: item.role,
      isDisabled: item.isDisabled,
      changedBy: item.changedByUser?.username || '系统',
      createdAt: item.createdAt
    }))

    res.json({ data })
  } catch (error) {
    console.error('获取用户历史失败:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.post('/', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), [
  body('username').notEmpty().withMessage('用户名不能为空'),
  body('password').notEmpty().withMessage('密码不能为空'),
  body('name').notEmpty().withMessage('姓名不能为空'),
  body('phone').optional({ nullable: true }),
  body('role').isIn(['SUPER_ADMIN', 'ACTIVITY_ADMIN', 'STUDENT']).withMessage('角色不正确')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      console.error('用户创建验证失败:', errors.array())
      console.error('请求体:', req.body)
      return res.status(400).json({ errors: errors.array() })
    }

    const { user } = req
    const { username, password, name, phone, school, grade, className, role } = req.body

    // Permission control for user creation
    if (user.role === 'ACTIVITY_ADMIN') {
      // Activity admins can only create student users
      if (role !== 'STUDENT') {
        return res.status(403).json({ error: '活动管理员只能创建学生用户' })
      }
    } else if (user.role === 'SUPER_ADMIN') {
      // Super admins can create any allowed role (SUPER_ADMIN, ACTIVITY_ADMIN, STUDENT)
      // No explicit restriction needed here as long as the role is valid by express-validator
      // and not trying to create a role that doesn't exist.
      // The body('role').isIn(...) validator already handles invalid roles.
    } else {
      // This case should ideally not be reached due to roleMiddleware, but as a safeguard.
      return res.status(403).json({ error: '当前用户角色无权创建用户' })
    }

    const existingUser = await prisma.user.findUnique({
      where: { username }
    })

    if (existingUser) return res.status(400).json({ error: '用户名已存在' })

    const hashedPassword = await bcrypt.hash(password, 10)

    const createdUser = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        name,
        phone,
        school,
        grade,
        className,
        role
      },
      select: {
        id: true,
        username: true,
        name: true,
        phone: true,
        school: true,
        grade: true,
        role: true,
        createdAt: true,
        isDisabled: true,
        className: true
      }
    })

    res.status(201).json({ message: '用户创建成功', data: createdUser })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.put('/:id', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), [
  body('name').optional(),
  body('phone').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

    const { user: currentUser } = req
    const targetUser = await prisma.user.findUnique({ where: { id: parseInt(req.params.id) } })

    if (!targetUser) return res.status(404).json({ error: '用户不存在' })

    // 权限控制：活动管理员只能编辑学生用户或与自己管理基地相关的活动管理员
    if (currentUser.role === 'ACTIVITY_ADMIN') {
      if (targetUser.role === 'STUDENT') {
        // OK to edit students
      } else if (targetUser.role === 'ACTIVITY_ADMIN') {
        // Check if the target ACTIVITY_ADMIN manages any of the same bases as the current user
        const currentUserManagedBases = await prisma.base.findMany({
          where: {
            admins: {
              some: {
                id: currentUser.id
              }
            }
          },
          select: { id: true }
        })
        const currentUserManagedBaseIds = currentUserManagedBases.map(base => base.id)

        const targetUserManagedBases = await prisma.base.findMany({
          where: {
            admins: {
              some: {
                id: targetUser.id
              }
            }
          },
          select: { id: true }
        })
        const targetUserManagedBaseIds = targetUserManagedBases.map(base => base.id)

        const hasSharedBases = currentUserManagedBaseIds.some(id => targetUserManagedBaseIds.includes(id))

        if (!hasSharedBases) {
          return res.status(403).json({ error: '权限不足，无法编辑该活动管理员' })
        }
      } else {
        // Activity admin cannot edit SUPER_ADMIN
        return res.status(403).json({ error: '权限不足' })
      }
    }

    const { name, phone, school, grade, className, role } = req.body
    const updateData = {}

    if (name !== undefined) updateData.name = name
    if (phone !== undefined) updateData.phone = phone
    if (school !== undefined) updateData.school = school
    if (grade !== undefined) updateData.grade = grade
    if (className !== undefined) updateData.className = className

    // 角色修改权限：只有超级管理员可以修改角色
    if (role !== undefined) {
      if (currentUser.role === 'SUPER_ADMIN') {
        updateData.role = role
      } else {
        return res.status(403).json({ error: '只有超级管理员可以修改用户角色' })
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(req.params.id) },
      data: updateData,
      select: {
        id: true,
        username: true,
        name: true,
        phone: true,
        school: true,
        grade: true,
        role: true,
        createdAt: true,
        isDisabled: true,
        className: true
      }
    })

    await recordUserHistory(updatedUser, req.user.id)

    res.json({ message: '用户更新成功', data: updatedUser })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.put('/:id/password', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), [
  body('newPassword').notEmpty().withMessage('新密码不能为空')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

    const { user: currentUser } = req
    const targetUser = await prisma.user.findUnique({ where: { id: parseInt(req.params.id) } })

    if (!targetUser) return res.status(404).json({ error: '用户不存在' })

    // 权限控制：活动管理员只能重置学生用户或与自己管理基地相关的活动管理员的密码
    if (currentUser.role === 'ACTIVITY_ADMIN') {
      if (targetUser.role === 'STUDENT') {
        // OK to reset student password
      } else if (targetUser.role === 'ACTIVITY_ADMIN') {
        // Check if the target ACTIVITY_ADMIN manages any of the same bases as the current user
        const currentUserManagedBases = await prisma.base.findMany({
          where: {
            admins: {
              some: {
                id: currentUser.id
              }
            }
          },
          select: { id: true }
        })
        const currentUserManagedBaseIds = currentUserManagedBases.map(base => base.id)

        const targetUserManagedBases = await prisma.base.findMany({
          where: {
            admins: {
              some: {
                id: targetUser.id
              }
            }
          },
          select: { id: true }
        })
        const targetUserManagedBaseIds = targetUserManagedBases.map(base => base.id)

        const hasSharedBases = currentUserManagedBaseIds.some(id => targetUserManagedBaseIds.includes(id))

        if (!hasSharedBases) {
          return res.status(403).json({ error: '权限不足，无法重置该活动管理员的密码' })
        }
      } else {
        // Activity admin cannot reset SUPER_ADMIN password
        return res.status(403).json({ error: '权限不足' })
      }
    }

    const { newPassword } = req.body
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    await prisma.user.update({
      where: { id: parseInt(req.params.id) },
      data: { password: hashedPassword }
    })

    res.json({ message: '密码重置成功' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.put('/:id/status', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), [
  body('isDisabled').isBoolean().withMessage('状态不能为空')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

    const { user: currentUser } = req
    const userId = parseInt(req.params.id)
    const targetUser = await prisma.user.findUnique({ where: { id: userId } })

    if (!targetUser) return res.status(404).json({ error: '用户不存在' })

    if (currentUser.role === 'ACTIVITY_ADMIN') {
      if (targetUser.role === 'STUDENT') {
        // OK to change status of students
      } else if (targetUser.role === 'ACTIVITY_ADMIN') {
        // Check if the target ACTIVITY_ADMIN manages any of the same bases as the current user
        const currentUserManagedBases = await prisma.base.findMany({
          where: {
            admins: {
              some: {
                id: currentUser.id
              }
            }
          },
          select: { id: true }
        })
        const currentUserManagedBaseIds = currentUserManagedBases.map(base => base.id)

        const targetUserManagedBases = await prisma.base.findMany({
          where: {
            admins: {
              some: {
                id: targetUser.id
              }
            }
          },
          select: { id: true }
        })
        const targetUserManagedBaseIds = targetUserManagedBases.map(base => base.id)

        const hasSharedBases = currentUserManagedBaseIds.some(id => targetUserManagedBaseIds.includes(id))

        if (!hasSharedBases) {
          return res.status(403).json({ error: '权限不足，无法修改该活动管理员的状态' })
        }
      } else {
        // Activity admin cannot change status of SUPER_ADMIN
        return res.status(403).json({ error: '权限不足' })
      }
    }

    const { isDisabled } = req.body

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isDisabled },
      select: {
        id: true,
        username: true,
        name: true,
        phone: true,
        school: true,
        grade: true,
        className: true,
        role: true,
        isDisabled: true
      }
    })

    await recordUserHistory(updatedUser, req.user.id)

    res.json({ message: isDisabled ? '用户已禁用' : '用户已启用', data: updatedUser })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.delete('/:id', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), async (req, res) => {
  try {
    const { user: currentUser } = req
    const targetUser = await prisma.user.findUnique({ where: { id: parseInt(req.params.id) } })

    if (!targetUser) return res.status(404).json({ error: '用户不存在' })

    if (currentUser.role === 'ACTIVITY_ADMIN') {
      if (targetUser.role === 'STUDENT') {
        // OK to delete students
      } else if (targetUser.role === 'ACTIVITY_ADMIN') {
        // Check if the target ACTIVITY_ADMIN manages any of the same bases as the current user
        const currentUserManagedBases = await prisma.base.findMany({
          where: {
            admins: {
              some: {
                id: currentUser.id
              }
            }
          },
          select: { id: true }
        })
        const currentUserManagedBaseIds = currentUserManagedBases.map(base => base.id)

        const targetUserManagedBases = await prisma.base.findMany({
          where: {
            admins: {
              some: {
                id: targetUser.id
              }
            }
          },
          select: { id: true }
        })
        const targetUserManagedBaseIds = targetUserManagedBases.map(base => base.id)

        const hasSharedBases = currentUserManagedBaseIds.some(id => targetUserManagedBaseIds.includes(id))

        if (!hasSharedBases) {
          return res.status(403).json({ error: '权限不足，无法删除该活动管理员' })
        }
      } else {
        // Activity admin cannot delete SUPER_ADMIN
        return res.status(403).json({ error: '权限不足' })
      }
    }

    // 防止用户删除自己
    if (currentUser.id === targetUser.id) {
      return res.status(400).json({ error: '不能删除自己的账号' })
    }

    await prisma.user.delete({ where: { id: parseInt(req.params.id) } })
    res.json({ message: '用户删除成功' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

module.exports = router
