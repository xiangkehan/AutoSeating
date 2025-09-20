// 管理员仪表盘页面逻辑
Page({
  data: {
    adminInfo: {},
    stats: {
      activeSession: 0,
      totalStudents: 0,
      completedArrangements: 0,
      totalWishes: 0
    },
    recentActivities: []
  },

  onLoad() {
    wx.setNavigationBarTitle({
      title: '管理员仪表盘'
    });
    
    this.loadAdminInfo();
    this.loadDashboardData();
  },

  onShow() {
    // 页面显示时刷新数据
    this.loadDashboardData();
  },

  // 加载管理员信息
  loadAdminInfo() {
    const adminInfo = wx.getStorageSync('adminInfo');
    if (adminInfo) {
      this.setData({ adminInfo });
    } else {
      // 未登录，跳转到登录页
      wx.redirectTo({
        url: '/pages/admin-login/admin-login'
      });
    }
  },

  // 加载仪表盘数据
  async loadDashboardData() {
    try {
      const token = wx.getStorageSync('adminToken');
      if (!token) {
        console.log('未找到管理员令牌');
        return;
      }
      
      const result = await wx.cloud.callFunction({
        name: 'seatArrangementFunctions',
        data: {
          type: 'getDashboardStats',
          token
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
      }
    }
  },

  // 初始化数据库
  async initDatabase() {
    wx.showLoading({
      title: '初始化中...'
    });
    
    try {
      const result = await wx.cloud.callFunction({
        name: 'initDatabase',
        data: {}
      });
      
      wx.hideLoading();
      
      if (result.result && result.result.success) {
        wx.showToast({
          title: '初始化成功',
          icon: 'success'
        });
        
        // 重新加载数据
        setTimeout(() => {
          this.loadDashboardData();
        }, 1000);
      } else {
        wx.showToast({
          title: '初始化失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('初始化数据库失败:', error);
      wx.showToast({
        title: '初始化失败',
        icon: 'none'
      });
    }
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
    const page = e.currentTarget.dataset.page;
    const pageMap = {
      'admin-wish': '/pages/admin-wish/admin-wish',
      'view-results': '/pages/admin-results/admin-results',
      'session-management': '/pages/session-management/session-management',
      'student-management': '/pages/student-management/student-management',
      'classroom-management': '/pages/classroom-management/classroom-management',
      'execute-arrangement': '/pages/execute-arrangement/execute-arrangement'
    };

    const url = pageMap[page];
    if (url) {
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
          // 清除存储的管理员信息
          wx.removeStorageSync('adminToken');
          wx.removeStorageSync('adminInfo');
          
          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          });

          // 跳转到登录页
          setTimeout(() => {
            wx.redirectTo({
              url: '/pages/admin-login/admin-login'
            });
          }, 1500);
        }
      }
    });
  }
});