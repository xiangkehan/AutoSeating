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
      const result = await wx.cloud.callFunction({
        name: 'seatArrangementFunctions',
        data: {
          action: 'getDashboardStats',
          token
        }
      });

      if (result.result.success) {
        const { stats, activities } = result.result.data;
        this.setData({
          stats,
          recentActivities: activities
        });
      }
    } catch (error) {
      console.error('加载仪表盘数据失败:', error);
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