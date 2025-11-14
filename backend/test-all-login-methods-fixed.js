const http = require('http');

async function testAllLoginMethods() {
  console.log('=== 测试所有登录方法 (使用正确密码) ===\n');

  const methods = [
    {
      name: '用户名登录 (username=admin)',
      body: { username: 'admin', password: '123456' }
    },
    {
      name: '用户名登录 (username=baseadmin)',
      body: { username: 'baseadmin', password: '123456' }
    },
    {
      name: '手机号登录 (phone=13800000000)',
      body: { phone: '13800000000', password: '123456' }
    }
  ];

  for (const method of methods) {
    console.log(`\n${method.name}...`);

    try {
      const response = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(method.body)
      });

      const data = await response.json();
      console.log(`   状态码: ${response.status}`);
      console.log(`   响应: ${JSON.stringify(data, null, 2)}`);

      if (response.status === 200 && data.token) {
        console.log(`✅ ${method.name}成功！Token: ${data.token.substring(0, 20)}...`);

        // 测试基地API
        try {
          const basesResponse = await fetch('http://localhost:3000/api/bases?page=1&limit=5&isApproved=true', {
            headers: {
              'Authorization': `Bearer ${data.token}`
            }
          });

          if (basesResponse.ok) {
            const basesData = await basesResponse.json();
            const dataLength = basesData.data?.length || 0;
            const total = basesData.pagination?.total || 0;

            console.log(`   📊 已通过基地数据: ${dataLength}/${total}`);
            console.log(`   📄 分页信息: ${JSON.stringify(basesData.pagination)}`);

            if (dataLength > 0 && total > 0) {
              console.log('   🎉 分页功能应该正常工作！');
              console.log(`   ✅ ${method.name}完全成功！用户可以正常使用系统。`);
              return; // 成功就停止测试
            } else {
              console.log(`   ❌ 基地API返回空数据或分页信息错误`);
            }
          } else {
            console.log(`   ❌ 基地API请求失败: ${basesResponse.status}`);
          }
        } catch (error) {
          console.log(`   ❌ 基地API测试失败: ${error.message}`);
        }
      } else {
        console.log(`   ❌ ${method.name}失败，状态码: ${response.status}`);
        if (data && data.error) {
          console.log(`   错误信息: ${data.error}`);
        }
      }
    } catch (error) {
      console.log(`   ❌ ${method.name}异常: ${error.message}`);
    }
  }

  console.log('\n=== 测试完成 ===');
  console.log('💡 请使用以下凭据登录管理界面：');
  console.log('   用户名: admin 或 baseadmin');
  console.log('   手机号: 13800000000 (admin) 或 13800000001 (baseadmin)');
  console.log('   密码: 123456');
}

// Helper function for Node.js environment
async function fetch(url, options) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            json: async () => JSON.parse(data)
          });
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

testAllLoginMethods().catch(console.error);