<template>
  <div>
    <div class="page-header">
      <h1>赛事活动管理</h1>
      <el-button type="primary" @click="showCreateDialog = true">创建赛事活动</el-button>
    </div>

    <!-- 搜索和筛选 -->
    <div class="content-card">
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="活动类型">
          <el-select v-model="searchForm.eventType" placeholder="选择类型" clearable>
            <el-option label="赛事活动" value="COMPETITION" />
            <el-option label="研学活动" value="STUDY_TOUR" />
            <el-option label="社会实践" value="SOCIAL_PRACTICE" />
            <el-option label="公益活动" value="PUBLIC_WELFARE" />
          </el-select>
        </el-form-item>
        <el-form-item label="搜索">
          <el-input v-model="searchForm.search" placeholder="搜索标题、标签、地点" clearable />
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="searchForm.tags" placeholder="搜索标签" clearable />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchEvents">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>

      <!-- 活动列表 -->
      <el-table :data="events" v-loading="loading" stripe>
        <el-table-column prop="title" label="标题" min-width="200" />
        <el-table-column prop="eventType" label="类型" width="120">
          <template #default="{ row }">
            <el-tag :type="getEventTypeTag(row.eventType)">
              {{ getEventTypeName(row.eventType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="location" label="地点" width="150" />
        <el-table-column prop="registerDeadline" label="报名截止" width="150">
          <template #default="{ row }">
            {{ formatDate(row.registerDeadline) }}
          </template>
        </el-table-column>
        <el-table-column prop="price" label="价格" width="100">
          <template #default="{ row }">
            {{ row.price ? `¥${row.price}` : '免费' }}
          </template>
        </el-table-column>
        <el-table-column prop="isHot" label="热门" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.isHot" type="danger">热门</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="isActive" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'danger'">
              {{ row.isActive ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="报名人数" width="100">
          <template #default="{ row }">
            {{ row._count.orders }}/{{ row.maxPeople || '不限' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="viewEvent(row)">查看</el-button>
            <el-button size="small" type="primary" @click="editEvent(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteEvent(row)">下架</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.limit"
        :total="pagination.total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="fetchEvents"
        @current-change="fetchEvents"
      />
    </div>

    <!-- 创建/编辑对话框 -->
    <el-dialog
      v-model="showCreateDialog"
      :title="editingEvent ? '编辑赛事活动' : '创建赛事活动'"
      width="80%"
      @closed="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="120px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="活动标题" prop="title">
              <el-input v-model="form.title" placeholder="请输入活动标题" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="活动类型" prop="eventType">
              <el-select v-model="form.eventType" placeholder="选择活动类型">
                <el-option label="赛事活动" value="COMPETITION" />
                <el-option label="研学活动" value="STUDY_TOUR" />
                <el-option label="社会实践" value="SOCIAL_PRACTICE" />
                <el-option label="公益活动" value="PUBLIC_WELFARE" />
                <el-option label="特色服务" value="SPECIAL_SERVICE" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="活动地点" prop="location">
              <el-input v-model="form.location" placeholder="请输入活动地点" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="报名截止时间" prop="registerDeadline">
              <el-date-picker
                v-model="form.registerDeadline"
                type="datetime"
                placeholder="选择报名截止时间"
                format="YYYY-MM-DD HH:mm:ss"
                value-format="YYYY-MM-DD HH:mm:ss"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="价格" prop="price">
              <el-input-number
                v-model="form.price"
                :min="0"
                :precision="2"
                placeholder="0表示免费"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="最大人数" prop="maxPeople">
              <el-input-number
                v-model="form.maxPeople"
                :min="1"
                placeholder="不限制请留空"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="活动时间" prop="endTime">
              <el-date-picker
                v-model="form.endTime"
                type="datetime"
                placeholder="选择活动时间"
                format="YYYY-MM-DD HH:mm:ss"
                value-format="YYYY-MM-DD HH:mm:ss"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="标签" prop="tags">
          <el-input v-model="form.tags" placeholder="请输入标签，多个标签用逗号分隔" />
        </el-form-item>

        <el-form-item label="活动封面" prop="coverImage">
          <el-upload
            class="upload-demo"
            action="#"
            :auto-upload="false"
            :on-change="handleCoverChange"
            :show-file-list="false"
            accept="image/*"
          >
            <img v-if="form.coverImage" :src="form.coverImage" class="cover-image" />
            <el-button v-else type="primary">选择封面图片</el-button>
          </el-upload>
        </el-form-item>

        <el-form-item label="活动描述" prop="description">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="4"
            placeholder="请输入活动描述"
          />
        </el-form-item>

        <el-form-item label="活动规则" prop="eventRules">
          <el-input
            v-model="form.eventRules"
            type="textarea"
            :rows="4"
            placeholder="请输入活动规则（赛事活动特有）"
          />
        </el-form-item>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="热门推荐">
              <el-switch v-model="form.isHot" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="启用状态">
              <el-switch v-model="form.isActive" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">
          {{ editingEvent ? '更新' : '创建' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from 'axios'

const loading = ref(false)
const events = ref([])
const showCreateDialog = ref(false)
const editingEvent = ref(null)
const submitting = ref(false)
const formRef = ref()

const searchForm = reactive({
  eventType: '',
  search: '',
  tags: ''
})

const pagination = reactive({
  page: 1,
  limit: 10,
  total: 0,
  pages: 0
})

const form = reactive({
  title: '',
  eventType: 'COMPETITION',
  location: '',
  registerDeadline: '',
  price: 0,
  maxPeople: null,
  endTime: '',
  tags: '',
  coverImage: '',
  description: '',
  eventRules: '',
  isHot: false,
  isActive: true
})

const formRules = {
  title: [{ required: true, message: '请输入活动标题', trigger: 'blur' }],
  eventType: [{ required: true, message: '请选择活动类型', trigger: 'change' }],
  location: [{ required: true, message: '请输入活动地点', trigger: 'blur' }],
  description: [{ required: true, message: '请输入活动描述', trigger: 'blur' }]
}

const getEventTypeName = (type) => {
  const typeMap = {
    COMPETITION: '赛事活动',
    STUDY_TOUR: '研学活动',
    SOCIAL_PRACTICE: '社会实践',
    PUBLIC_WELFARE: '公益活动',
    SPECIAL_SERVICE: '特色服务'
  }
  return typeMap[type] || '未知类型'
}

const getEventTypeTag = (type) => {
  const tagMap = {
    COMPETITION: 'danger',
    STUDY_TOUR: 'warning',
    SOCIAL_PRACTICE: 'success',
    PUBLIC_WELFARE: 'info',
    SPECIAL_SERVICE: 'primary'
  }
  return tagMap[type] || ''
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

const fetchEvents = async () => {
  try {
    loading.value = true
    const params = {
      page: pagination.page,
      limit: pagination.limit,
      ...searchForm
    }

    // 只过滤赛事活动类型
    if (params.eventType) {
      // 保留选中的类型
    } else {
      // 如果没有选择类型，则不过滤 eventType，让后端返回所有活动类型
      delete params.eventType
    }

    const response = await axios.get('/api/services/events', { params })
    events.value = response.data.data
    pagination.total = response.data.pagination.total
    pagination.pages = response.data.pagination.pages
  } catch (error) {
    ElMessage.error('获取赛事活动列表失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

const resetSearch = () => {
  Object.assign(searchForm, {
    eventType: '',
    search: '',
    tags: ''
  })
  pagination.page = 1
  fetchEvents()
}

const handleCoverChange = (file) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    form.coverImage = e.target.result
  }
  reader.readAsDataURL(file.raw)
}

const resetForm = () => {
  Object.assign(form, {
    title: '',
    eventType: 'COMPETITION',
    location: '',
    registerDeadline: '',
    price: 0,
    maxPeople: null,
    endTime: '',
    tags: '',
    coverImage: '',
    description: '',
    eventRules: '',
    isHot: false,
    isActive: true
  })
  editingEvent.value = null
  formRef.value?.resetFields()
}

const editEvent = (event) => {
  editingEvent.value = event
  Object.assign(form, {
    ...event,
    price: event.price || 0,
    maxPeople: event.maxPeople || null
  })
  showCreateDialog.value = true
}

const viewEvent = (event) => {
  ElMessage.info('查看功能开发中...')
}

const deleteEvent = async (event) => {
  try {
    await ElMessageBox.confirm(
      `确定要下架赛事活动"${event.title}"吗？`,
      '确认下架',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await axios.delete(`/api/services/${event.id}`)
    ElMessage.success('下架成功')
    fetchEvents()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('下架失败')
      console.error(error)
    }
  }
}

const handleSubmit = async () => {
  try {
    await formRef.value.validate()
    submitting.value = true

    const formData = new FormData()
    Object.keys(form).forEach(key => {
      if (form[key] !== null && form[key] !== '') {
        formData.append(key, form[key])
      }
    })

    if (editingEvent.value) {
      await axios.put(`/api/services/${editingEvent.value.id}`, formData)
      ElMessage.success('更新成功')
    } else {
      await axios.post('/api/services', formData)
      ElMessage.success('创建成功')
    }

    showCreateDialog.value = false
    fetchEvents()
  } catch (error) {
    ElMessage.error(editingEvent.value ? '更新失败' : '创建失败')
    console.error(error)
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  fetchEvents()
})
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.content-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.search-form {
  margin-bottom: 20px;
}

.cover-image {
  width: 100px;
  height: 100px;
  object-fit: cover;
  border-radius: 4px;
}

.upload-demo {
  text-align: center;
}

.el-pagination {
  margin-top: 20px;
  text-align: right;
}
</style>