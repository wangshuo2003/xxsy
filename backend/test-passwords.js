const bcrypt = require('bcryptjs');

// 从数据库获取的密码哈希
const passwordHashes = [
  { username: 'admin', hash: '$2a$10$.a4cNkeq8wTo7ie1Hau0Duu/5mPjgkWUipnuXGk5SYdMVbPej9L9u' },
  { username: 'baseadmin', hash: '$2a$10$.a4cNkeq8wTo7ie1Hau0Duu/5mPjgkWUipnuXGk5SYdMVbPej9L9u' },
  { username: 'student', hash: '$2a$10$wVOZ/XBJ.2WHMRAyy/4yrecgp9FGJsEhI6dRfe0WqvKmeJep9Q2lu' }
];

// 常见测试密码
const testPasswords = [
  'admin123',
  '123456',
  'password',
  'admin',
  '123123',
  'qwerty',
  '111111',
  'student123',
  'base123',
  '000000'
];

async function testPasswordMatching() {
  console.log('=== 测试密码破解 ===\n');

  for (const userHash of passwordHashes) {
    console.log(`测试用户: ${userHash.username}`);
    console.log(`哈希: ${userHash.hash}`);

    for (const password of testPasswords) {
      try {
        const isMatch = await bcrypt.compare(password, userHash.hash);
        if (isMatch) {
          console.log(`✅ 找到正确密码: ${password}`);
          break;
        } else {
          console.log(`❌ ${password}: 不匹配`);
        }
      } catch (error) {
        console.log(`❌ ${password}: 验证错误 - ${error.message}`);
      }
    }
    console.log('\n' + '='.repeat(50) + '\n');
  }
}

testPasswordMatching().catch(console.error);
