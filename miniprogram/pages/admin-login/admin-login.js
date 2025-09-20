// 管理员登录页面逻辑
Page({
  data: {
    username: '',
    password: '',
    isLoading: false
  },

  onLoad() {
    wx.setNavigationBarTitle({
      title: '管理员登录'
    });
  },

  // 输入用户名
  onUsernameInput(e) {
    this.setData({
      username: e.detail.value
    });
  },

  // 输入密码
  onPasswordInput(e) {
    this.setData({
      password: e.detail.value
    });
  },

  // 管理员登录
  async onLogin() {
    const { username, password } = this.data;
    
    if (!username || !password) {
      wx.showToast({
        title: '请填写完整信息',
        icon: 'none'
      });
      return;
    }

    this.setData({ isLoading: true });

    try {
      const result = await wx.cloud.callFunction({
        name: 'seatArrangementFunctions',
        data: {
          action: 'adminLogin',
          username,
          password
        }
      });

      if (result.result.success) {
        const { token, admin } = result.result.data;
        
        // 保存管理员信息
        wx.setStorageSync('adminToken', token);
        wx.setStorageSync('adminInfo', admin);
        
        wx.showToast({
          title: '登录成功',
          icon: 'success'
        });

        // 跳转到管理员仪表盘
        setTimeout(() => {
          wx.redirectTo({
            url: '/pages/admin-dashboard/admin-dashboard'
          });
        }, 1500);
      } else {
        wx.showToast({
          title: result.result.message || '登录失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('管理员登录失败:', error);
      wx.showToast({
        title: '登录失败，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  // 返回学生端
  backToStudent() {
    wx.navigateBack();
  }
});