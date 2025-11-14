const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const mappings = [
  { from: '科技研学', to: '研学' },
  { from: '社会实践', to: '实践' },
  { from: '公益服务', to: '公益' },
  { from: '文化体验', to: '赛事' },
  { from: '研学活动', to: '研学' },
  { from: '实践活动', to: '实践' },
  { from: '公益活动', to: '公益' },
  { from: '赛事活动', to: '赛事' }
]

async function main () {
  try {
    for (const map of mappings) {
      const result = await prisma.activity.updateMany({
        where: { type: map.from },
        data: { type: map.to }
      })
      console.log(`将 ${map.from} -> ${map.to} ，共 ${result.count} 条`)
    }
    console.log('🎯 活动类型修复完成')
  } catch (error) {
    console.error('❌ 修复活动类型失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
