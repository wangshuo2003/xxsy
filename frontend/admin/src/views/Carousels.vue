<template>
  <div>
    <div class="page-header">
      <h1>轮播图管理</h1>
    </div>

    <div class="toolbar">
      <el-button type="primary" @click="showDialog('add')">
        <el-icon><Plus /></el-icon>
        添加轮播图
      </el-button>
      <div>
        <el-input
          v-model="searchText"
          placeholder="搜索标题"
          style="width: 200px; margin-right: 10px"
          @keyup.enter="loadData"
        />
        <el-button @click="loadData">搜索</el-button>
      </div>
    </div>

    <div class="content-card">
      <el-table :data="tableData" v-loading="loading">
        <el-table-column prop="title" label="标题" />
        <el-table-column prop="imageUrl" label="图片">
          <template #default="{ row }">
            <el-image
              :src="row.imageUrl"
              style="width: 100px; height: 60px"
              fit="cover"
              :preview-src-list="[row.imageUrl]"
            />
          </template>
        </el-table-column>
        <el-table-column prop="linkUrl" label="链接" />
        <el-table-column prop="isActive" label="是否展示">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'danger'">
              {{ row.isActive ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
          <el-table-column prop="createdAt" label="创建时间">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="showDialog('edit', row)">编辑</el-button>
            <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="content-pagination" v-if="pagination.total > 0">
        <el-pagination
          :current-page="pagination.page"
          :page-size="pagination.limit"
          :total="pagination.total"
          @current-change="handlePageChange"
        />
      </div>
    </div>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="标题" prop="title">
          <el-input v-model="form.title" />
        </el-form-item>
        <el-form-item label="链接" prop="linkUrl">
          <el-input v-model="form.linkUrl" placeholder="可选，留空则不可点击" />
        </el-form-item>
        <el-form-item label="图片" prop="image">
          <el-upload
            :auto-upload="false"
            :show-file-list="false"
            accept="image/*"
            @change="handleImageChange"
          >
            <el-button type="primary">选择图片</el-button>
            <template #tip>
              <div class="el-upload__tip">支持jpg/png文件，大小不超过5MB</div>
            </template>
          </el-upload>
          <div v-if="form.imageUrl || previewImage" style="margin-top: 10px">
            <el-image :src="previewImage || form.imageUrl" style="width: 200px" />
          </div>
        </el-form-item>
        <el-form-item label="是否展示">
          <el-switch v-model="form.isActive" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@/api/request'

const loading = ref(false)
const dialogVisible = ref(false)
const dialogMode = ref('add')
const searchText = ref('')
const previewImage = ref('')
const formRef = ref()

const tableData = ref([])
const pagination = reactive({
  page: 1,
  limit: 10,
  total: 0
})

const form = reactive({
  id: null,
  title: '',
  linkUrl: '',
  imageUrl: '',
  isActive: true,
  imageFile: null
})

const rules = {
  title: [
    { required: true, message: '请输入标题', trigger: 'blur' }
  ]
}

const dialogTitle = computed(() => dialogMode.value === 'add' ? '添加轮播图' : '编辑轮播图')

const loadData = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      limit: pagination.limit,
      search: searchText.value
    }
    const response = await request.get('/carousels', { params })
    tableData.value = response.data
    pagination.total = response.pagination.total
  } catch (error) {
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

const showDialog = (mode, row = null) => {
  dialogMode.value = mode
  dialogVisible.value = true

  if (mode === 'edit' && row) {
    Object.assign(form, {
      id: row.id,
      title: row.title,
      linkUrl: row.linkUrl,
      imageUrl: row.imageUrl,
      isActive: row.isActive,
      imageFile: null
    })
    previewImage.value = ''
  } else {
    Object.assign(form, {
      id: null,
      title: '',
      linkUrl: '',
      imageUrl: '',
      isActive: true,
      imageFile: null
    })
    previewImage.value = ''
  }
}

const handleImageChange = (file) => {
  form.imageFile = file.raw
  previewImage.value = URL.createObjectURL(file.raw)
}

const handleSubmit = async () => {
  if (!formRef.value) return

  await formRef.value.validate(async (valid) => {
    if (!valid) return

    if (!form.imageFile && !form.imageUrl) {
      ElMessage.error('请选择图片')
      return
    }

    const formData = new FormData()
    formData.append('title', form.title)
    formData.append('linkUrl', form.linkUrl)
    formData.append('isActive', form.isActive)
    if (form.imageFile) {
      formData.append('image', form.imageFile)
    }

    try {
      if (dialogMode.value === 'add') {
        await request.post('/carousels', formData)
        ElMessage.success('添加成功')
      } else {
        formData.append('_method', 'PUT')
        await request.put(`/carousels/${form.id}`, formData)
        ElMessage.success('更新成功')
      }

      dialogVisible.value = false
      loadData()
    } catch (error) {
      ElMessage.error('操作失败')
    }
  })
}

const handleDelete = (row) => {
  ElMessageBox.confirm('确定要删除这个轮播图吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      await request.delete(`/carousels/${row.id}`)
      ElMessage.success('删除成功')
      loadData()
    } catch (error) {
      ElMessage.error('删除失败')
    }
  })
}

const handlePageChange = (page) => {
  pagination.page = page
  loadData()
}

const formatDate = (date) => {
  return new Date(date).toLocaleString('zh-CN')
}

onMounted(() => {
  loadData()
})
</script>
