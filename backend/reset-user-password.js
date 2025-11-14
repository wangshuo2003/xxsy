const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function resetUserPassword() {
  try {
    console.log('开始重置用户密码...');

    // 重置admin密码
    const admin = await prisma.user.findUnique({
      where: { username: 'admin' }
    });

    if (admin) {
      const hashedPassword = await bcrypt.hash('1', 10);
      await prisma.user.update({
        where: { id: admin.id },
        data: { password: hashedPassword }
      });
      console.log('✅ 重置admin密码成功');
    }

    // 重置baseadmin密码
    const baseAdmin = await prisma.user.findUnique({
      where: { username: 'baseadmin' }
    });

    if (baseAdmin) {
      const hashedPassword = await bcrypt.hash('1', 10);
      await prisma.user.update({
        where: { id: baseAdmin.id },
        data: { password: hashedPassword }
      });
      console.log('✅ 重置baseadmin密码成功');
    }

    // 重置student密码
    const student = await prisma.user.findUnique({
      where: { username: 'studenta' }
    });

    if (student) {
      const hashedPassword = await bcrypt.hash('1', 10);
      await prisma.user.update({
        where: { id: student.id },
        data: { password: hashedPassword }
      });
      console.log('✅ 重置studenta密码成功');
    }

    console.log('\n🎉 密码重置完成！');
    console.log('\n可用的测试账户：');
    console.log('超级管理员: admin / 1');
    console.log('基地管理员: baseadmin / 1');
    console.log('学生用户: studenta / 1');

  } catch (error) {
    console.error('❌ 重置密码失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetUserPassword();
