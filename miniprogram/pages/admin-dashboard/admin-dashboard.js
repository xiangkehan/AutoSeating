// 管理员仪表盘页面逻辑
const { createButtonStateManager } = require('../../utils/buttonStateManager');
const { adminAuth } = require('../../utils/adminAuth');

Page({
  data: {
    adminInfo: {},
    stats: {
      activeSession: 0,
      totalStudents: 0,
      completedArrangements: 0,
      totalWishes: 0
    },
    recentActivities: [],
    buttonStates: {},
    cloudFunctionUrl: '' // 云端接口地址
  },

  onLoad() {
    wx.setNavigationBarTitle({
      title: '管理员仪表盘'
    });
    
    // 检查登录状态
    if (adminAuth.requireLogin('admin-dashboard')) {
      return;
    }
    
    // 检查页面权限
    if (!adminAuth.checkPagePermission('admin-dashboard')) {
      wx.showModal({
        title: '权限不足',
        content: '您没有访问此页面的权限',
        showCancel: false,
        success: () => {
          wx.navigateBack();
        }
      });
      return;
    }
    
    // 初始化按钮状态管理器
    this.buttonManager = createButtonStateManager(this);
    
    // 初始化按钮状态
    this.buttonManager.initButton('logoutBtn', {
      text: '退出登录',
      type: 'secondary',
      loadingText: '退出中...',
      successText: '已退出'
    });
    
    this.buttonManager.initButton('refreshBtn', {
      text: '刷新数据',
      type: 'primary',
      loadingText: '刷新中...',
      successText: '刷新成功'
    });
    
    this.buttonManager.initButton('initDbBtn', {
      text: '初始化数据库',
      type: 'warning',
      loadingText: '初始化中...',
      successText: '初始化成功'
    });
    
    this.buttonManager.initButton('copyCloudUrlBtn', {
      text: '复制',
      type: 'primary',
      loadingText: '复制中...',
      successText: '已复制'
    });
    
    this.loadAdminInfo();
    this.loadDashboardData();
    this.loadCloudFunctionUrl();
  },

  onShow() {
    // 页面显示时刷新数据
    this.refreshData();
  },
  
  onUnload() {
    // 页面销毁时清理资源
    if (this.buttonManager) {
      this.buttonManager.cleanup();
    }
  },

  // 加载管理员信息
  loadAdminInfo() {
    const adminInfo = adminAuth.getAdminInfo();
    if (adminInfo) {
      this.setData({ adminInfo });
    } else {
      // 未登录，跳转到登录页
      adminAuth.requireLogin('admin-dashboard');
    }
  },

  // 刷新数据
  async refreshData() {
    await this.buttonManager.executeAsync('refreshBtn', async () => {
      await this.loadDashboardData();
      return { success: true };
    }, {
      successText: '数据已更新',
      clickInterval: 2000 // 2秒内防止重复点击
    });
  },

  // 加载仪表盘数据
  async loadDashboardData() {
    try {
      const result = await adminAuth.callCloudFunction({
        name: 'seatArrangementFunctions',
        data: {
          type: 'getDashboardStats'
        }
      });

      console.log('仪表盘数据结果:', result);

      if (result.result && result.result.success) {
        const { stats, activities } = result.result.data;
        this.setData({
          stats: stats || this.data.stats,
          recentActivities: activities || []
        });
      } else {
        console.log('加载仪表盘数据失败:', result.result ? result.result.message : '未知错误');
      }
    } catch (error) {
      console.error('加载仪表盘数据失败:', error);
      // 如果是数据库错误，可能是首次初始化
      if (error.errCode === -502005) {
        this.showInitDBPrompt();
      }
    }
  },

  // 初始化数据库
  async initDatabase() {
    await this.buttonManager.executeAsync('initDbBtn', async () => {
      const result = await wx.cloud.callFunction({
        name: 'initDatabase',
        data: {}
      });
      
      if (result.result && result.result.success) {
        // 重新加载数据
        setTimeout(() => {
          this.loadDashboardData();
        }, 1000);
        
        return result;
      } else {
        throw new Error('初始化失败');
      }
    }, {
      successText: '初始化成功',
      useErrorModal: true,
      errorTitle: '初始化失败'
    });
  },
  
  // 显示初始化数据库提示
  showInitDBPrompt() {
    wx.showModal({
      title: '提示',
      content: '检测到系统首次初始化，是否现在初始化数据库？',
      confirmText: '初始化',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.initDatabase();
        }
      }
    });
  },

  // 获取角色文本
  getRoleText(role) {
    const roleMap = {
      'admin': '普通管理员',
      'seat_manager': '排座负责人'
    };
    return roleMap[role] || '未知角色';
  },

  // 导航到指定页面
  navigateTo(e) {
    // 检查e和currentTarget是否存在
    if (!e || !e.currentTarget) {
      console.error('Invalid event object in navigateTo');
      return;
    }
    
    const page = e.currentTarget.dataset.page;
    
    // 检查页面权限
    if (!adminAuth.checkPagePermission(page)) {
      wx.showToast({
        title: '权限不足，无法访问',
        icon: 'none'
      });
      return;
    }
    
    const pageMap = {
      'admin-wish': '/pages/admin-wish/admin-wish',
      'view-results': '/pages/result/result',
      'session-management': '/pages/session-management/session-management',
      'student-management': '/pages/student-management/student-management',
      'classroom-management': '/pages/classroom-management/classroom-management',
      'execute-arrangement': '/pages/execute-arrangement/execute-arrangement',
      'audit-logs': '/pages/audit-logs/audit-logs',
      'system-config': '/pages/system-config/system-config'
    };

    const url = pageMap[page];
    if (url) {
      // 直接跳转，避免DOM操作可能导致的错误
      wx.navigateTo({ url });
    } else {
      wx.showToast({
        title: '功能开发中',
        icon: 'none'
      });
    }
  },

  // 退出登录
  onLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          this.executeLogout();
        }
      }
    });
  },
  
  // 执行退出登录
  async executeLogout() {
    await this.buttonManager.executeAsync('logoutBtn', async () => {
      // 使用新的认证管理器登出
      adminAuth.logout();
      
      // 跳转到登录页
      setTimeout(() => {
        wx.redirectTo({
          url: '/pages/admin-login/admin-login'
        });
      }, 1500);
      
      return { success: true };
    }, {
      successText: '已退出登录'
    });
  },
  
  // 加载云端接口地址
  async loadCloudFunctionUrl() {
    try {
      // 获取云环境配置
      const app = getApp();
      const envId = app.globalData.env || 'cloud1-4gumvlngdea8db4b';
      
      // 构建云端接口地址格式
      // 微信云函数的接口地址格式通常为: https://api.weixin.qq.com/tcb/invokecloudfunction?env={env_id}&name=seatArrangementFunctions
      // 但对于离线管理端，需要的是完整的HTTP API地址，这里使用标准格式
      const cloudUrl = `https://${envId}.api.weixin.qq.com/tcb/invokecloudfunction?env=${envId}&name=seatArrangementFunctions`;
      
      this.setData({
        cloudFunctionUrl: cloudUrl
      });
    } catch (error) {
      console.error('加载云端接口地址失败:', error);
    }
  },
  
  // 复制云端接口地址
  async copyCloudFunctionUrl() {
    if (!this.data.cloudFunctionUrl) {
      wx.showToast({
        title: '接口地址为空',
        icon: 'none'
      });
      return;
    }
    
    await this.buttonManager.executeAsync('copyCloudUrlBtn', async () => {
      // 使用微信API复制文本
      wx.setClipboardData({
        data: this.data.cloudFunctionUrl,
        success: () => {
          wx.showToast({
            title: '复制成功',
            icon: 'success'
          });
        }
      });
      
      return { success: true };
    }, {
      successText: '已复制',
      clickInterval: 1000
    });
  }
});