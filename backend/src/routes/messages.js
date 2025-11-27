const express = require('express')
const { PrismaClient } = require('@prisma/client')

const router = express.Router()
const prisma = new PrismaClient()

const ensureContact = async (userAId, userBId) => {
  const a = Math.min(userAId, userBId)
  const b = Math.max(userAId, userBId)
  let contact = await prisma.contact.findFirst({ where: { userA: a, userB: b } })
  if (!contact) {
    contact = await prisma.contact.create({ data: { userA: a, userB: b } })
  }
  return contact
}

// 发起好友申请
router.post('/requests', async (req, res) => {
  const { toUser, message } = req.body || {}
  if (!toUser) return res.status(400).json({ error: 'toUser 必填' })

  const target = await prisma.user.findUnique({ where: { username: toUser } })
  if (!target) return res.status(404).json({ error: '该用户不存在' })

  const existing = await prisma.friendRequest.findFirst({
    where: {
      fromId: req.user.id,
      toId: target.id,
      status: 'PENDING'
    }
  })
  if (existing) return res.json({ ok: true, request: existing })

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
    await ensureContact(fr.fromId, fr.toId)
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
  const list = await prisma.contact.findMany({
    where: { OR: [{ userA: req.user.id }, { userB: req.user.id }] },
    orderBy: { updatedAt: 'desc' }
  })
  const contacts = await Promise.all(
    list.map(async (c) => {
      const otherId = c.userA === req.user.id ? c.userB : c.userA
      const other = await prisma.user.findUnique({ where: { id: otherId } })
      return {
        id: other.username,
        name: other.name || other.username,
        updatedAt: c.updatedAt
      }
    })
  )
  res.json({ data: contacts })
})

// 拉取聊天记录
router.get('/contacts/:username/messages', async (req, res) => {
  const other = await prisma.user.findUnique({ where: { username: req.params.username } })
  if (!other) return res.status(404).json({ error: '联系人不存在' })
  const contact = await ensureContact(req.user.id, other.id)
  const msgs = await prisma.chatMessage.findMany({
    where: { contactId: contact.id },
    orderBy: { createdAt: 'asc' }
  })
  res.json({ data: msgs })
})

// 发送消息
router.post('/contacts/:username/messages', async (req, res) => {
  const other = await prisma.user.findUnique({ where: { username: req.params.username } })
  if (!other) return res.status(404).json({ error: '联系人不存在' })
  const { content } = req.body || {}
  if (!content) return res.status(400).json({ error: 'content 必填' })
  const contact = await ensureContact(req.user.id, other.id)
  const msg = await prisma.chatMessage.create({
    data: {
      contactId: contact.id,
      fromId: req.user.id,
      toId: other.id,
      content
    }
  })
  await prisma.contact.update({ where: { id: contact.id }, data: { updatedAt: new Date() } })
  res.json({ ok: true, message: msg })
})

module.exports = router
