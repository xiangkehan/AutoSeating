// pages/audit-logs/audit-logs.js
const AdminAuthManager = require('../../utils/adminAuth');
const adminAuth = new AdminAuthManager();

Page({
  data: {
    logs: [],
    loading: false,
    page: 1,
    hasMore: true,
    totalCount: 0,
    
    // 筛选条件
    filters: {
      operation: '',
      severity: '',
      status: '',
      start_date: '',
      end_date: ''
    },
    
    // 筛选选项
    operationOptions: [
      { value: '', label: '全部操作' },
      { value: 'login', label: '登录' },
      { value: 'logout', label: '登出' },
      { value: 'create_session', label: '创建会话' },
      { value: 'execute_arrangement', label: '执行排座' },
      { value: 'manual_adjust', label: '手动调整' },
      { value: 'publish_result', label: '发布结果' },
      { value: 'delete_admin', label: '删除管理员' },
      { value: 'create_admin', label: '创建管理员' }
    ],
    
    severityOptions: [
      { value: '', label: '全部级别' },
      { value: 'low', label: '低风险' },
      { value: 'medium', label: '中风险' },
      { value: 'high', label: '高风险' }
    ],
    
    statusOptions: [
      { value: '', label: '全部状态' },
      { value: 'success', label: '成功' },
      { value: 'error', label: '失败' }
    ],
    
    showFilters: false,
    statistics: null,
    showStatistics: false
  },

  onLoad() {
    this.checkAuth();
    this.loadAuditLogs();
    this.loadStatistics();
  },

  async checkAuth() {
    if (!adminAuth.isLoggedIn()) {
      wx.showModal({
        title: '提示',
        content: '请先登录管理员账号',
        showCancel: false,
        success: () => {
          wx.redirectTo({
            url: '/pages/admin-login/admin-login'
          });
        }
      });
      return;
    }

    const userInfo = adminAuth.getUserInfo();
    if (!['admin', 'super_admin'].includes(userInfo.role)) {
      wx.showModal({
        title: '权限不足',
        content: '只有管理员可以查看审计日志',
        showCancel: false,
        success: () => {
          wx.navigateBack();
        }
      });
    }
  },

  async loadAuditLogs(refresh = false) {
    if (this.data.loading) return;
    
    this.setData({ loading: true });
    
    try {
      const page = refresh ? 1 : this.data.page;
      const token = adminAuth.getToken();
      
      const result = await wx.cloud.callFunction({
        name: 'seatArrangementFunctions',
        data: {
          type: 'getAuditLogs',
          token,
          page,
          limit: 20,
          ...this.data.filters
        }
      });

      if (result.result.success) {
        const { logs, pagination } = result.result.data;
        
        this.setData({
          logs: refresh ? logs : [...this.data.logs, ...logs],
          page: page + 1,
          hasMore: page < pagination.total_pages,
          totalCount: pagination.total
        });
      } else {
        wx.showToast({
          title: result.result.message || '加载失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('加载审计日志失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadStatistics() {
    try {
      const token = adminAuth.getToken();
      
      const result = await wx.cloud.callFunction({
        name: 'seatArrangementFunctions',
        data: {
          type: 'getAuditStatistics',
          token,
          days: 7
        }
      });

      if (result.result.success) {
        this.setData({
          statistics: result.result.data
        });
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadAuditLogs();
    }
  },

  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true });
    this.loadAuditLogs(true);
    this.loadStatistics();
    wx.stopPullDownRefresh();
  },

  toggleFilters() {
    this.setData({
      showFilters: !this.data.showFilters
    });
  },

  toggleStatistics() {
    this.setData({
      showStatistics: !this.data.showStatistics
    });
  },

  onFilterChange(e) {
    const { field } = e.currentTarget.dataset;
    const { value } = e.detail;
    
    this.setData({
      [`filters.${field}`]: value
    });
  },

  applyFilters() {
    this.setData({ 
      page: 1, 
      hasMore: true,
      showFilters: false 
    });
    this.loadAuditLogs(true);
  },

  clearFilters() {
    this.setData({
      filters: {
        operation: '',
        severity: '',
        status: '',
        start_date: '',
        end_date: ''
      },
      page: 1,
      hasMore: true
    });
    this.loadAuditLogs(true);
  },

  viewLogDetail(e) {
    const { log } = e.currentTarget.dataset;
    
    wx.showModal({
      title: '操作详情',
      content: `操作：${log.operation}
目标：${log.target}
详情：${log.details}
时间：${this.formatDate(log.timestamp)}
用户：${log.user_name}(${log.user_role})`,
      showCancel: false
    });
  },

  formatDate(timestamp) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
  },

  getSeverityClass(severity) {
    const classMap = {
      'low': 'severity-low',
      'medium': 'severity-medium', 
      'high': 'severity-high'
    };
    return classMap[severity] || 'severity-medium';
  },

  getSeverityText(severity) {
    const textMap = {
      'low': '低风险',
      'medium': '中风险',
      'high': '高风险'
    };
    return textMap[severity] || '中风险';
  },

  getOperationText(operation) {
    const textMap = {
      'login': '登录',
      'logout': '登出',
      'create_session': '创建会话',
      'execute_arrangement': '执行排座',
      'manual_adjust': '手动调整',
      'publish_result': '发布结果',
      'delete_admin': '删除管理员',
      'create_admin': '创建管理员',
      'update_admin': '更新管理员',
      'submit_wish': '提交意愿',
      'update_profile': '更新档案'
    };
    return textMap[operation] || operation;
  }
});", "original_text": "操作：${log.operation}
目标：${log.target}
详情：${log.details}
时间：${this.formatDate(log.timestamp)}
用户：${log.user_name}(${log.user_role})", "new_text": "操作：${this.getOperationText(log.operation)}
目标：${log.target}
详情：${log.details}
时间：${this.formatDate(log.timestamp)}
用户：${log.user_name}(${log.user_role})"}, {"file_path": "c:\\Users\\xjh20\\WeChatProjects\\miniprogram-2\\miniprogram\\pages\\audit-logs\\audit-logs.js"}]