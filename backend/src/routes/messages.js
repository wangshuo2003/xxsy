const express = require('express')
const { PrismaClient } = require('@prisma/client')

const router = express.Router()
const prisma = new PrismaClient()

const ensureContact = async (userAId, userBId, opts = {}) => {
  const { forceActive = false } = opts
  const a = Math.min(userAId, userBId)
  const b = Math.max(userAId, userBId)
  let contact = await prisma.contact.findFirst({ where: { userA: a, userB: b } })
  if (!contact) {
    contact = await prisma.contact.create({ data: { userA: a, userB: b, status: forceActive ? 'ACTIVE' : 'ACTIVE' } })
  } else if (forceActive && contact.status !== 'ACTIVE') {
    contact = await prisma.contact.update({ where: { id: contact.id }, data: { status: 'ACTIVE', updatedAt: new Date() } })
  }
  return contact
}

const whoBlocked = (contact) => {
  if (!contact) return null
  if (contact.status === 'BLOCKED_BY_A') return contact.userA
  if (contact.status === 'BLOCKED_BY_B') return contact.userB
  return null
}

const computeBlockState = (contact, userId) => {
  const blocker = whoBlocked(contact)
  return {
    blockedByMe: blocker === userId,
    blockedMe: blocker && blocker !== userId
  }
}

// 发起好友申请
router.post('/requests', async (req, res) => {
  const { toUser, message } = req.body || {}
  if (!toUser) return res.status(400).json({ error: 'toUser 必填' })

  const target = await prisma.user.findUnique({ where: { username: toUser } })
  if (!target) return res.status(404).json({ error: '该用户不存在' })
  if (target.id === req.user.id) return res.status(400).json({ error: '不能给自己发送好友申请' })

  const existingContact = await prisma.contact.findFirst({
    where: {
      OR: [
        { userA: req.user.id, userB: target.id },
        { userA: target.id, userB: req.user.id }
      ]
    }
  })
  if (existingContact && existingContact.status === 'ACTIVE') {
    return res.status(400).json({ error: '已经是好友' })
  }

  // 若对方已拉黑当前用户，直接拒绝
  const contact = await prisma.contact.findFirst({
    where: {
      OR: [
        { userA: req.user.id, userB: target.id },
        { userA: target.id, userB: req.user.id }
      ]
    }
  })
  const { blockedMe } = computeBlockState(contact, req.user.id)
  if (blockedMe) return res.status(403).json({ error: '被拉黑' })

  const request = await prisma.friendRequest.create({
    data: {
      fromId: req.user.id,
      toId: target.id,
      message: message || ''
    }
  })
  res.json({ ok: true, request })
})

// 获取收到的好友申请
router.get('/requests', async (req, res) => {
  const requests = await prisma.friendRequest.findMany({
    where: { toId: req.user.id },
    orderBy: { createdAt: 'desc' },
    include: { fromUser: true }
  })
  res.json({ data: requests })
})

// 获取自己发出的好友申请
router.get('/requests/sent', async (req, res) => {
  const requests = await prisma.friendRequest.findMany({
    where: { fromId: req.user.id },
    orderBy: { createdAt: 'desc' },
    include: { toUser: true }
  })
  res.json({ data: requests })
})

// 处理好友申请
router.post('/requests/:id/action', async (req, res) => {
  const { action } = req.body || {}
  const id = parseInt(req.params.id, 10)
  const valid = ['accept', 'reject', 'ignore']
  if (!valid.includes(action)) return res.status(400).json({ error: '无效操作' })

  const fr = await prisma.friendRequest.findUnique({ where: { id } })
  if (!fr || fr.toId !== req.user.id) return res.status(404).json({ error: '申请不存在' })
  if (fr.status !== 'PENDING') return res.json({ ok: true, request: fr })

  let status = 'IGNORED'
  if (action === 'accept') status = 'ACCEPTED'
  if (action === 'reject') status = 'REJECTED'

  const updated = await prisma.friendRequest.update({ where: { id }, data: { status } })

  if (status === 'ACCEPTED') {
    const contact = await ensureContact(fr.fromId, fr.toId, { forceActive: true })
    // 更新时间，确保双方列表立即显示
    await prisma.contact.update({ where: { id: contact.id }, data: { updatedAt: new Date(), status: 'ACTIVE' } })

    // 写入一条系统消息，便于两端消息流展示“通过好友申请”提示
    const fromUser = await prisma.user.findUnique({ where: { id: fr.fromId } })
    const toUser = await prisma.user.findUnique({ where: { id: fr.toId } })
    const now = new Date()
    const fmt = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const sysContent = `${toUser?.name || toUser?.username || '我'}（${toUser?.username}）通过了好友申请 ${fmt}`
    await prisma.chatMessage.create({
      data: {
        contactId: contact.id,
        fromId: fr.toId, // 通过者
        toId: fr.fromId, // 申请人
        content: sysContent
      }
    })
  }

  res.json({ ok: true, request: updated })
})

// 添加联系人（直接建立）
router.post('/contacts', async (req, res) => {
  const { userId } = req.body || {}
  if (!userId) return res.status(400).json({ error: 'userId 必填' })
  const target = await prisma.user.findUnique({ where: { username: userId } })
  if (!target) return res.status(404).json({ error: '该用户不存在' })
  const contact = await ensureContact(req.user.id, target.id)
  res.json({ ok: true, contact })
})

// 联系人列表
router.get('/contacts', async (req, res) => {
  const sortBy = ['name', 'createdAt', 'updatedAt'].includes(req.query.sortBy)
    ? req.query.sortBy
    : 'updatedAt'
  const order = req.query.order === 'asc' ? 'asc' : 'desc'

  const orderByClause = sortBy === 'name' ? undefined : { [sortBy]: order }

  const list = await prisma.contact.findMany({
    where: {
      status: 'ACTIVE',
      OR: [{ userA: req.user.id }, { userB: req.user.id }]
    },
    orderBy: orderByClause
  })
  const contacts = await Promise.all(
    list.map(async (c) => {
      const otherId = c.userA === req.user.id ? c.userB : c.userA
      const other = await prisma.user.findUnique({ where: { id: otherId } })
      return {
        id: other.username,
        name: other.name || other.username,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      }
    })
  )
  // 若按姓名排序，在内存里处理（Prisma无法按关联字段排序）
  const sorted = sortBy === 'name'
    ? contacts.sort((a, b) => (a.name || '').localeCompare(b.name || '') * (order === 'asc' ? 1 : -1))
    : contacts

  res.json({ data: sorted })
})

// 删除联系人，可选择是否保留聊天记录
router.delete('/contacts/:username', async (req, res) => {
  const keepMessages = ['true', '1', 'yes', 'on'].includes(String(req.query.keepMessages).toLowerCase())

  const other = await prisma.user.findUnique({ where: { username: req.params.username } })
  if (!other) return res.json({ ok: true, keepMessages, note: '联系人已不存在' })

  const contact = await prisma.contact.findFirst({
    where: {
      OR: [
        { userA: req.user.id, userB: other.id },
        { userA: other.id, userB: req.user.id }
      ]
    }
  })

  if (!contact) return res.json({ ok: true, keepMessages, note: '联系记录已不存在' })

  if (keepMessages) {
    await prisma.contact.update({ where: { id: contact.id }, data: { status: 'DELETED', updatedAt: new Date() } })
  } else {
    await prisma.chatMessage.deleteMany({ where: { contactId: contact.id } })
    await prisma.contact.delete({ where: { id: contact.id } })
  }

  res.json({ ok: true, keepMessages })
})

// 拉取聊天记录：若联系人已被删除，仍可按双方用户 ID 拉取历史消息
router.get('/contacts/:username/messages', async (req, res) => {
  const other = await prisma.user.findUnique({ where: { username: req.params.username } })
  if (!other) return res.status(404).json({ error: '联系人不存在' })

  let contact = await prisma.contact.findFirst({
    where: {
      OR: [
        { userA: req.user.id, userB: other.id },
        { userA: other.id, userB: req.user.id }
      ]
    }
  })

  const isAdminSide = ['SUPER_ADMIN', 'ACTIVITY_ADMIN'].includes(req.user.role)
  const isOtherAdmin = ['SUPER_ADMIN', 'ACTIVITY_ADMIN'].includes(other.role)

  // 管理员与任何人聊天时，若无联系人则创建；若已被拉黑则保持现状
  if (!contact && (isAdminSide || isOtherAdmin)) {
    contact = await ensureContact(req.user.id, other.id)
  }

  let msgs
  if (contact) {
    msgs = await prisma.chatMessage.findMany({
      where: { contactId: contact.id },
      orderBy: { createdAt: 'asc' }
    })
  } else {
    // 无联系人记录时，按双方 id 查询历史
    msgs = await prisma.chatMessage.findMany({
      where: {
        OR: [
          { fromId: req.user.id, toId: other.id },
          { fromId: other.id, toId: req.user.id }
        ]
      },
      orderBy: { createdAt: 'asc' }
    })
  }
  res.json({ data: msgs })
})

// 发送消息
router.post('/contacts/:username/messages', async (req, res) => {
  const other = await prisma.user.findUnique({ where: { username: req.params.username } })
  if (!other) return res.status(404).json({ error: '联系人不存在' })
  const { content } = req.body || {}
  if (!content) return res.status(400).json({ error: 'content 必填' })
  let contact = await prisma.contact.findFirst({
    where: {
      OR: [
        { userA: req.user.id, userB: other.id },
        { userA: other.id, userB: req.user.id }
      ]
    }
  })
  const isAdminSide = ['SUPER_ADMIN', 'ACTIVITY_ADMIN'].includes(req.user.role)
  const isOtherAdmin = ['SUPER_ADMIN', 'ACTIVITY_ADMIN'].includes(other.role)

  if (!contact && (isAdminSide || isOtherAdmin)) {
    contact = await ensureContact(req.user.id, other.id, { forceActive: true })
  }

  const { blockedMe } = computeBlockState(contact, req.user.id)
  if (blockedMe) return res.status(403).json({ error: '被拉黑' })
  if (!contact || contact.status !== 'ACTIVE') return res.status(403).json({ error: '双方不是好友' })
  const msg = await prisma.chatMessage.create({
    data: {
      contactId: contact.id,
      fromId: req.user.id,
      toId: other.id,
      content
    }
  })
  // 用消息时间回写联系人更新时间，便于“最近聊天时间”排序
  await prisma.contact.update({ where: { id: contact.id }, data: { updatedAt: msg.createdAt } })
  res.json({ ok: true, message: msg })
})

// 查询/设置黑名单
router.get('/contacts/:username/blacklist', async (req, res) => {
  const other = await prisma.user.findUnique({ where: { username: req.params.username } })
  if (!other) return res.status(404).json({ error: '用户不存在' })
  const contact = await prisma.contact.findFirst({
    where: {
      OR: [
        { userA: req.user.id, userB: other.id },
        { userA: other.id, userB: req.user.id }
      ]
    }
  })
  const { blockedByMe, blockedMe } = computeBlockState(contact, req.user.id)
  res.json({ data: { blockedByMe, blockedMe, status: contact?.status || null } })
})

router.patch('/contacts/:username/blacklist', async (req, res) => {
  const { block } = req.body || {}
  const other = await prisma.user.findUnique({ where: { username: req.params.username } })
  if (!other) return res.status(404).json({ error: '用户不存在' })
  const a = Math.min(req.user.id, other.id)
  const b = Math.max(req.user.id, other.id)

  let contact = await prisma.contact.findFirst({ where: { userA: a, userB: b } })
  if (!contact) {
    contact = await prisma.contact.create({ data: { userA: a, userB: b, status: 'ACTIVE' } })
  }

  let status = 'ACTIVE'
  if (block === true || block === 'true' || block === 1 || block === '1') {
    status = req.user.id === a ? 'BLOCKED_BY_A' : 'BLOCKED_BY_B'
  }

  contact = await prisma.contact.update({ where: { id: contact.id }, data: { status, updatedAt: new Date() } })
  res.json({ ok: true, status: contact.status })
})

module.exports = router
