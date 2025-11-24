<template>
  <div class="order-management-page">
    <div class="page-header">
      <h1>订单管理</h1>
      <p>在这里管理所有的用户订单。</p>
    </div>

    <div class="content-card">
      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane label="全部订单" name="ALL"></el-tab-pane>
        <el-tab-pane label="待支付" name="PENDING"></el-tab-pane>
        <el-tab-pane label="已支付" name="PAID"></el-tab-pane>
        <el-tab-pane label="退款中" name="REFUNDING"></el-tab-pane>
        <el-tab-pane label="已退款" name="REFUNDED"></el-tab-pane>
        <el-tab-pane label="已取消" name="CANCELLED"></el-tab-pane>
      </el-tabs>

      <div class="toolbar">
        <el-input
          v-model="filters.search"
          placeholder="搜索订单号或活动名称"
          @input="handleSearch"
          clearable
          style="width: 250px;"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-select v-model="filters.baseId" placeholder="选择基地" @change="handleBaseChange" clearable>
          <el-option label="全部基地" :value="null" />
          <el-option v-for="base in bases" :key="base.id" :label="base.name" :value="base.id" />
        </el-select>
        <el-select v-model="filters.activityId" placeholder="选择活动" @change="handleActivityChange" clearable>
          <el-option label="全部活动" :value="null" />
          <el-option v-for="activity in activities" :key="activity.id" :label="activity.name" :value="activity.id" />
        </el-select>
      </div>

      <el-table :data="orders" v-loading="loading" border>
        <el-table-column label="订单信息" min-width="180" show-overflow-tooltip>
          <template #default="scope">
            <div class="order-info">
              <div class="order-title">{{ scope.row.orderNo }}</div>
              <div class="order-subtitle">
                {{ scope.row.activity?.name || scope.row.service?.title || '未知订单' }}
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="用户" width="120" show-overflow-tooltip>
          <template #default="scope">
            <div class="user-info">
              <div>{{ scope.row.user?.name || '用户' }}</div>
              <div class="user-sub">{{ scope.row.user?.phone }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="totalFee" label="金额" width="90">
          <template #default="scope">
            ¥{{ scope.row.amount.toFixed(2) }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="订单状态" width="100">
            <template #default="scope">
                <el-tag :type="orderStatusTagType(scope.row.status)">
                    {{ formatOrderStatus(scope.row.status) }}
                </el-tag>
            </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="145">
          <template #default="scope">
            {{ formatDate(scope.row.createdAt) }}
          </template>
        </el-table-column>
        
        <el-table-column v-if="activeTab === 'REFUNDING'" prop="refund.reason" label="退款原因" min-width="120" show-overflow-tooltip />
        <el-table-column v-if="activeTab === 'REFUNDING'" label="处理信息" min-width="150" show-overflow-tooltip>
          <template #default="scope">
            <div v-if="scope.row.refund && scope.row.refund.status !== 'PENDING'">
              <div>{{ scope.row.refund.decisionNote || '无备注' }}</div>
              <div class="user-sub">
                {{ scope.row.refund.processedBy ? '管理员 ID: ' + scope.row.refund.processedBy : '' }}
                <span v-if="scope.row.refund.processedAt"> · {{ formatDate(scope.row.refund.processedAt) }}</span>
              </div>
            </div>
            <span v-else>--</span>
          </template>
        </el-table-column>
        <el-table-column  v-if="activeTab === 'REFUNDING'" label="操作" width="150">
          <template #default="scope">
            <template v-if="scope.row.refund && scope.row.refund.status === 'PENDING'">
              <el-button
                type="success"
                size="small"
                @click="handleApprove(scope.row.refund)"
              >
                同意
              </el-button>
              <el-button
                type="danger"
                size="small"
                @click="openRejectDialog(scope.row.refund)"
              >
                拒绝
              </el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination" v-if="pagination.total > 0">
        <el-pagination
          layout="total, prev, pager, next"
          :page-size="pagination.limit"
          :current-page="pagination.page"
          :total="pagination.total"
          @current-change="handlePageChange"
        />
      </div>
    </div>

    <el-dialog v-model="rejectDialogVisible" title="拒绝退款" width="400px">
      <el-form :model="rejectForm">
        <el-form-item label="理由">
          <el-input
            v-model="rejectForm.note"
            type="textarea"
            :rows="4"
            maxlength="200"
            show-word-limit
            placeholder="请输入拒绝理由"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitReject" :loading="rejectLoading">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Search } from '@element-plus/icons-vue';
import request from '@/api/request';

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const orders = ref([]);
const bases = ref([]);
const activities = ref([]);
const activeTab = ref('ALL'); // Default tab

const filters = reactive({
  search: '',
  baseId: null,
  activityId: null,
});

const pagination = reactive({ page: 1, limit: 10, total: 0 });
const rejectDialogVisible = ref(false);
const rejectForm = reactive({ id: null, note: '' });
const rejectLoading = ref(false);

const formatOrderStatus = (status) => {
    const map = {
        'PENDING': '待支付',
        'PAID': '已支付',
        'CANCELLED': '已取消',
        'REFUNDING': '退款中',
        'REFUNDED': '已退款',
    };
    return map[status] || status;
};

const orderStatusTagType = (status) => {
    const map = {
        'PENDING': 'warning',
        'PAID': 'success',
        'CANCELLED': 'info',
        'REFUNDING': 'primary',
        'REFUNDED': 'danger',
    };
    return map[status] || 'info';
};

const formatDate = (date) => {
  if (!date) return '--';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  const hour = d.getHours().toString().padStart(2, '0');
  const minute = d.getMinutes().toString().padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
};

const fetchOrders = async () => {
  loading.value = true;
  try {
    const params = {
      page: pagination.page,
      limit: pagination.limit,
      search: filters.search,
      baseId: filters.baseId,
      activityId: filters.activityId,
    };

    if (activeTab.value !== 'ALL') {
      params.orderStatus = activeTab.value;
    }

    const response = await request.get('/orders', { params });
    orders.value = response.data || [];
    const pg = response.pagination || {};
    pagination.total = pg.total || 0;
    pagination.limit = pg.limit || 10;
    pagination.page = pg.page || 1;
  } catch (error) {
    console.error('获取订单失败:', error);
    ElMessage.error(error.response?.data?.error || '加载失败');
  } finally {
    loading.value = false;
  }
};

const fetchBases = async () => {
  try {
    const response = await request.get('/bases', { params: { limit: 1000, isApproved: true } });
    bases.value = response.data;
  } catch (error) {
    console.error('获取基地列表失败:', error);
  }
};

const fetchActivities = async () => {
  try {
    const params = {
        limit: 1000,
        isApproved: true,
        baseId: filters.baseId
    };
    if (!params.baseId) {
        delete params.baseId;
    }
    const response = await request.get('/activities', { params });
    activities.value = response.data;
  } catch (error) {
    console.error('获取活动列表失败:', error);
  }
};

const handlePageChange = (page) => {
  pagination.page = page;
  fetchOrders();
};

const handleTabChange = (tabName) => {
  activeTab.value = tabName;
};

const handleSearch = () => {
  pagination.page = 1;
  fetchOrders();
};

const handleBaseChange = (baseId) => {
  filters.baseId = baseId;
  filters.activityId = null; // Reset activity filter
  fetchActivities();
  pagination.page = 1;
  fetchOrders();
};

const handleActivityChange = () => {
    pagination.page = 1;
    fetchOrders();
}


const handleApprove = async (refund) => {
  try {
    await ElMessageBox.confirm('确定同意该退款申请吗？', '提示', { type: 'warning' });
    await request.put(`/refunds/${refund.id}/decision`, { action: 'APPROVED' });
    ElMessage.success('已同意退款');
    fetchOrders();
  } catch (error) {
    if (error !== 'cancel') {
      console.error('同意退款失败:', error);
      ElMessage.error(error.response?.data?.error || '操作失败');
    }
  }
};

const openRejectDialog = (refund) => {
  rejectForm.id = refund.id;
  rejectForm.note = '';
  rejectDialogVisible.value = true;
};

const submitReject = async () => {
  if (!rejectForm.note.trim()) {
    ElMessage.error('请输入拒绝原因');
    return;
  }
  rejectLoading.value = true;
  try {
    await request.put(`/refunds/${rejectForm.id}/decision`, {
      action: 'REJECTED',
      note: rejectForm.note,
    });
    ElMessage.success('已拒绝该退款申请');
    rejectDialogVisible.value = false;
    fetchOrders();
  } catch (error) {
    console.error('拒绝退款失败:', error);
    ElMessage.error(error.response?.data?.error || '操作失败');
  } finally {
    rejectLoading.value = false;
  }
};

onMounted(() => {
  fetchBases();
  fetchActivities();
});

// Watcher for when the user clicks a tab
watch(activeTab, (newTab) => {
  // Update URL if it's not in sync. This will trigger the route watcher.
  if (route.query.tab !== newTab) {
    router.replace({ query: { ...route.query, tab: newTab } });
  }
});

// Watcher for when the URL changes directly (e.g., browser back/forward, or from the activeTab watcher)
watch(() => route.query.tab, (newTabQuery) => {
  const newTab = (newTabQuery || 'ALL').toUpperCase();
  const availableTabs = ['ALL', 'PENDING', 'PAID', 'REFUNDING', 'REFUNDED', 'CANCELLED'];
  
  if (availableTabs.includes(newTab)) {
    // Sync the tab UI if it's not aligned with the URL
    if (activeTab.value !== newTab) {
        activeTab.value = newTab;
    }
    // Centralized fetch logic
    pagination.page = 1;
    fetchOrders();
  }
}, { immediate: true }); // Run this on component load
</script>

<style scoped>
.order-management-page {
  display: grid;
  gap: 16px;
}

.content-card {
  overflow-x: auto;
}

:deep(.el-table .el-table__cell) {
  padding: 12px 5px !important;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 16px;
}

.order-info .order-title {
  font-weight: 600;
}

.order-info .order-subtitle,
.user-sub {
  font-size: 12px;
  color: #909399;
}

.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
