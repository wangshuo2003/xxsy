const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const users = [
  ...['a1','a2','a3','a4'].map(u => ({ username: u, role: 'SUPER_ADMIN' })),
  ...['b1','b2','b3','b4'].map(u => ({ username: u, role: 'ACTIVITY_ADMIN' })),
  ...['s1','s2','s3','s4'].map(u => ({ username: u, role: 'STUDENT' }))
]

async function main() {
  const hash = bcrypt.hashSync('1', 10)
  for (const u of users) {
    const name = u.username.toUpperCase()
    await prisma.user.upsert({
      where: { username: u.username },
      update: { password: hash, role: u.role, name, phone: `199${Math.floor(Math.random()*1e8).toString().padStart(8,'0')}` },
      create: { username: u.username, password: hash, role: u.role, name, phone: `199${Math.floor(Math.random()*1e8).toString().padStart(8,'0')}` }
    })
    console.log(`ok ${u.username} (${u.role})`)
  }
}

main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect())
