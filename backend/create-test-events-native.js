const http = require('http')
const https = require('https')

// 创建测试赛事活动数据
const createTestEvents = async () => {
  try {
    console.log('开始创建测试赛事活动数据...')

    // 首先登录获取token
    const loginData = JSON.stringify({
      username: 'admin',
      password: 'admin'
    })

    const loginResponse = await makeRequest('POST', '/api/auth/login', loginData, null, 38964)
    const token = loginResponse.token
    console.log('登录成功，获得token')

    // 创建测试活动数据
    const testEvents = [
      {
        title: '2024年山东省青少年科技创新大赛',
        eventType: 'COMPETITION',
        description: '本次大赛旨在激发青少年对科学技术的兴趣，培养创新精神和实践能力。大赛涵盖物理、化学、生物、计算机科学等多个领域。',
        location: '山东省科技馆',
        registerDeadline: '2024-12-31 23:59:59',
        endTime: '2025-02-15 09:00:00',
        price: 50,
        maxPeople: 200,
        tags: '科技创新,省白名单赛事,青少年',
        isHot: true,
        eventRules: '1. 参赛年龄为6-18岁青少年\n2. 每人限报1个项目\n3. 作品必须为原创\n4. 参赛费用包含评审费和证书费',
        isActive: true
      },
      {
        title: '红色文化研学之旅',
        eventType: 'STUDY_TOUR',
        description: '深入革命老区，体验红色文化，参观革命历史遗址，聆听革命故事，传承红色基因。',
        location: '临沂市革命老区',
        registerDeadline: '2024-11-30 23:59:59',
        endTime: '2024-12-20 08:00:00',
        price: 280,
        maxPeople: 50,
        tags: '研学活动,红色教育,社会实践',
        isHot: false,
        eventRules: '1. 参与年龄10岁以上\n2. 自备个人生活用品\n3. 服从团队管理\n4. 费用包含交通、住宿、餐饮',
        isActive: true
      },
      {
        title: '社区环保志愿服务活动',
        eventType: 'PUBLIC_WELFARE',
        description: '参与社区环保工作，包括垃圾分类宣传、社区清洁、植树造林等公益活动，培养环保意识和社会责任感。',
        location: '济南市各社区',
        registerDeadline: '2024-11-15 23:59:59',
        endTime: '2024-11-20 09:00:00',
        price: 0,
        maxPeople: 100,
        tags: '公益活动,环保,志愿服务',
        isHot: false,
        eventRules: '1. 年龄需满12岁\n2. 自备防护用品\n3. 准时到达集合地点\n4. 全程参与活动',
        isActive: true
      }
    ]

    // 逐个创建活动
    for (let i = 0; i < testEvents.length; i++) {
      const eventData = testEvents[i]
      console.log(`创建活动 ${i + 1}: ${eventData.title}`)

      try {
        const response = await makeRequest(
          'POST',
          '/api/services',
          JSON.stringify(eventData),
          token
        )
        console.log(`✅ 活动创建成功: ${response.data.title}`)
      } catch (error) {
        console.error(`❌ 创建活动失败: ${eventData.title}`)
        console.error('错误信息:', error.message)
      }
    }

    console.log('✅ 测试数据创建完成！')

  } catch (error) {
    console.error('❌ 创建测试数据失败:', error.message)
  }
}

// HTTP请求函数
function makeRequest(method, path, data, token = null, port = 38964) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: port,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`
    }

    const req = http.request(options, (res) => {
      let responseData = ''

      res.on('data', (chunk) => {
        responseData += chunk
      })

      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData)
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsedData)
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${parsedData.error || 'Request failed'}`))
          }
        } catch (error) {
          reject(new Error(`Response parse error: ${error.message}`))
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    req.write(data)
    req.end()
  })
}

// 运行脚本
createTestEvents()