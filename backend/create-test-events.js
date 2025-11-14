const axios = require('axios')

// 创建测试赛事活动数据
const createTestEvents = async () => {
  try {
    console.log('开始创建测试赛事活动数据...')

    // 首先登录获取token
    const loginResponse = await axios.post('http://localhost:28964/api/auth/login', {
      username: 'admin',
      password: 'admin'
    })

    const token = loginResponse.data.token
    console.log('登录成功，获得token')

    // 设置请求头
    const authConfig = {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }

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
      },
      {
        title: '乡村教育社会实践活动',
        eventType: 'SOCIAL_PRACTICE',
        description: '前往乡村学校开展支教活动，为当地学生提供课程辅导，体验乡村教育环境，提升社会责任感。',
        location: '菏泽市乡村学校',
        registerDeadline: '2024-12-01 23:59:59',
        endTime: '2024-12-15 08:00:00',
        price: 120,
        maxPeople: 30,
        tags: '社会实践,支教,乡村教育',
        isHot: false,
        eventRules: '1. 年龄需满16岁\n2. 具备一定的学科基础\n3. 需参加培训\n4. 保证全程参与',
        isActive: true
      }
    ]

    // 逐个创建活动
    for (let i = 0; i < testEvents.length; i++) {
      const eventData = testEvents[i]
      console.log(`创建活动 ${i + 1}: ${eventData.title}`)

      try {
        const response = await axios.post(
          'http://localhost:28964/api/services',
          eventData,
          authConfig
        )
        console.log(`✅ 活动创建成功: ${response.data.data.title}`)
      } catch (error) {
        console.error(`❌ 创建活动失败: ${eventData.title}`)
        console.error('错误信息:', error.response?.data || error.message)
      }
    }

    console.log('✅ 测试数据创建完成！')

  } catch (error) {
    console.error('❌ 创建测试数据失败:', error.message)
  }
}

// 运行脚本
createTestEvents()