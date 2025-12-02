const http = require('http')

// 创建测试政策通知数据
const createTestPolicies = async () => {
  try {
    console.log('开始创建测试政策通知数据...')

    // 首先登录获取token
    const loginData = JSON.stringify({
      username: 'admin',
      password: 'admin'
    })

    const loginResponse = await makeRequest('POST', '/api/auth/login', loginData, null, 28964)
    const token = loginResponse.token
    console.log('登录成功，获得token')

    // 创建测试政策数据
    const testPolicies = [
      {
        title: '山东省教育厅关于深化新时代教育评价改革的实施意见',
        content: `<h2>总体要求</h2>
<p>为深入贯彻习近平总书记关于教育的重要论述和全国教育大会精神，落实《深化新时代教育评价改革总体方案》要求，结合我省实际，现就深化新时代教育评价改革提出如下实施意见。</p>
<h3>一、指导思想</h3>
<p>以习近平新时代中国特色社会主义思想为指导，全面贯彻党的教育方针，落实立德树人根本任务，坚持"五育"并举，树立科学的教育发展观、人才成长观、选人用人观，推动构建德智体美劳全面培养的教育体系。</p>
<h3>二、基本原则</h3>
<ul>
<li><strong>立德树人，德育为先</strong></li>
<li><strong>面向人人，因材施教</strong></li>
<li><strong>改进结果，强化过程</strong></li>
</ul>`,
        tags: '教育政策,综合素质评价',
        isDraft: false,
        sortOrder: 1
      },
      {
        title: '关于加强中小学生劳动教育的指导意见',
        content: `<h2>总体要求</h2>
<p>为深入贯彻落实中共中央、国务院《关于全面加强新时代大中小学劳动教育的意见》精神，切实加强中小学生劳动教育，培养学生劳动意识和实践能力，特制定本指导意见。</p>
<h3>一、重要意义</h3>
<p>劳动教育是中国特色社会主义教育制度的重要内容，直接决定社会主义建设者和接班人的劳动精神面貌、劳动价值取向和劳动技能水平。</p>
<h3>二、基本原则</h3>
<ul>
<li><strong>把握育人导向</strong> - 坚持培养全面发展的人，培养社会主义建设者和接班人</li>
<li><strong>遵循教育规律</strong> - 符合学生年龄特点，以体力劳动为主，注意手脑并用、安全适度</li>
<li><strong>体现时代特征</strong> - 适应科技发展和产业变革，注重新兴技术、新兴业态支撑</li>
</ul>`,
        tags: '劳动教育,实践育人',
        isDraft: false,
        sortOrder: 2
      },
      {
        title: '山东省中小学生综合素质评价实施办法（试行）',
        content: `<h2>第一章 总则</h2>
<p><strong>第一条</strong> 为全面贯彻党的教育方针，落实立德树人根本任务，发展素质教育，培养德智体美劳全面发展的社会主义建设者和接班人，根据有关法律法规和政策规定，结合本省实际，制定本办法。</p>
<p><strong>第二条</strong> 本办法适用于本省行政区域内所有中小学生的综合素质评价工作。</p>
<h3>评价内容</h3>
<p>综合素质评价主要包括以下内容：</p>
<ol>
<li><strong>思想品德</strong>：理想信念、社会责任、行为习惯等</li>
<li><strong>学业水平</strong>：知识技能、学科素养、学习能力等</li>
<li><strong>身心健康</strong>：体质健康、心理素质、生活方式等</li>
<li><strong>艺术素养</strong>：审美情趣、艺术表现、文化理解等</li>
<li><strong>劳动实践</strong>：劳动意识、劳动技能、劳动成果等</li>
</ol>`,
        tags: '综合素质,评价体系',
        isDraft: false,
        sortOrder: 3
      },
      {
        title: '关于推进研学旅行工作的实施意见',
        content: `<h2>总体要求</h2>
<p>为贯彻落实教育部等11部门《关于推进中小学生研学旅行的意见》精神，深入推进我省中小学生研学旅行工作，促进学生德智体美劳全面发展，现提出以下实施意见。</p>
<h3>一、重要意义</h3>
<p>研学旅行是学校教育和校外教育衔接的创新形式，是教育教学的重要内容，是综合实践育人的有效途径。</p>
<h3>二、主要目标</h3>
<ul>
<li>培养学生社会责任感、创新精神和实践能力</li>
<li>让学生感受祖国大好河山，感受中华传统美德，感受革命光荣历史</li>
<li>学会动手动脑，生存生活，做人做事，促进身心健康、体魄强健、意志坚强</li>
</ul>`,
        tags: '研学旅行,社会实践',
        isDraft: false,
        sortOrder: 4
      },
      {
        title: '关于加强和改进中小学美育工作的指导意见',
        content: `<h2>总体要求</h2>
<p>为深入贯彻落实习近平总书记关于教育的重要论述和全国教育大会精神，切实加强和改进新时代学校美育工作，提高学生审美和人文素养，促进学生德智体美劳全面发展，特制定本指导意见。</p>
<h3>一、总体目标</h3>
<p>到2025年，美育取得突破性进展，学生审美和人文素养明显提升。到2035年，基本形成全覆盖、多样化、高质量的具有中国特色的现代化学校美育体系。</p>
<h3>二、重点任务</h3>
<ul>
<li><strong>树立学科融合理念</strong> - 加强美育与德育、智育、体育、劳动教育有机融合</li>
<li><strong>完善课程设置</strong> - 开设丰富优质的美育课程，逐步完善"艺术基础知识基本技能+艺术审美体验+艺术专项特长"的教学模式</li>
<li><strong>深化教学改革</strong> - 逐步完善"艺术基础知识基本技能+艺术审美体验+艺术专项特长"的教学模式</li>
</ul>`,
        tags: '美育工作,艺术教育',
        isDraft: false,
        sortOrder: 5
      },
      {
        title: '如何用一颗土豆拯救世界？',
        content: `<h2>土豆的奇妙用途</h2>
<p>你知道吗？一颗土豆不仅能填饱肚子，还能发电、净化水，甚至用作生物燃料！</p>
<h3>行动指南</h3>
<ul>
<li>种植土豆，减少碳足迹</li>
<li>用土豆电池点亮小灯泡</li>
<li>探索土豆在未来能源中的潜力</li>
</ul>`,
        tags: '趣味,环保,教育',
        isDraft: false,
        sortOrder: 6
      },
      {
        title: '猫咪与编程：如何让你的宠物参与代码审查？',
        content: `<h2>猫咪的编程天赋</h2>
<p>研究表明，猫咪对键盘的热爱可能隐藏着它们对代码的独特见解。</p>
<h3>实践步骤</h3>
<ul>
<li>在键盘旁放置猫薄荷，吸引猫咪参与</li>
<li>观察猫咪按下的键，寻找灵感</li>
<li>将猫咪的行为转化为代码优化的创意</li>
</ul>`,
        tags: '趣味,编程,宠物',
        isDraft: false,
        sortOrder: 7
      },
      {
        title: '用纸飞机传递爱：校园创意活动指南',
        content: `<h2>纸飞机的艺术</h2>
<p>纸飞机不仅是童年的回忆，更是一种传递情感的方式。</p>
<h3>活动亮点</h3>
<ul>
<li>设计独特的纸飞机，写上祝福语</li>
<li>举办纸飞机比赛，评选最远飞行奖</li>
<li>通过纸飞机传递友谊和爱</li>
</ul>`,
        tags: '创意,校园活动,趣味',
        isDraft: false,
        sortOrder: 8
      },
      ...Array.from({ length: 27 }, (_, i) => ({
        title: `趣味通知 ${i + 9}`,
        content: `<h2>这是第 ${i + 9} 条有趣的通知</h2><p>内容丰富多彩，充满创意！</p>`,
        tags: '趣味,通知',
        isDraft: false,
        sortOrder: i + 9
      }))
    ]

    // 逐个创建政策
    for (let i = 0; i < testPolicies.length; i++) {
      const policyData = testPolicies[i]
      console.log(`创建政策 ${i + 1}: ${policyData.title}`)

      try {
        const response = await makeRequest(
          'POST',
          '/api/policies',
          JSON.stringify(policyData),
          token,
          28964
        )
        console.log(`✅ 政策创建成功: ${response.data.title}`)
      } catch (error) {
        console.error(`❌ 创建政策失败: ${policyData.title}`)
        console.error('错误信息:', error.message)
      }
    }

    console.log('✅ 测试政策数据创建完成！')

  } catch (error) {
    console.error('❌ 创建测试数据失败:', error.message)
  }
}

// HTTP请求函数
function makeRequest(method, path, data, token = null, port = 28964) {
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
createTestPolicies()