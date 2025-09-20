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

  onUnload() {
    // 页面销毁时清理资源
    this.setData({
      isLoading: false
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

    // 防止重复提交
    if (this.data.isLoading) {
      return;
    }

    this.setData({ isLoading: true });

    try {
      const result = await wx.cloud.callFunction({
        name: 'seatArrangementFunctions',
        data: {
          type: 'adminLogin',
          username,
          password
        }
      });

      console.log('登录结果:', result);

      if (result.result && result.result.success) {
        const { token, adminProfile } = result.result.data;
        
        // 保存管理员信息
        wx.setStorageSync('adminToken', token);
        wx.setStorageSync('adminInfo', adminProfile);
        
        wx.showToast({
          title: '登录成功',
          icon: 'success'
        });

        // 跳转到管理员仪表盘
        setTimeout(() => {
          if (this.data.isLoading) { // 检查页面是否还在加载状态
            wx.redirectTo({
              url: '/pages/admin-dashboard/admin-dashboard'
            });
          }
        }, 1500);
      } else {
        const message = (result.result && result.result.message) || '登录失败';
        wx.showToast({
          title: message,
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('管理员登录失败:', error);
      let errorMessage = '登录失败，请重试';
      
      // 根据错误类型提供更具体的错误信息
      if (error.errCode === -502005) {
        errorMessage = '数据库连接失败，请检查网络';
      } else if (error.errMsg && error.errMsg.includes('cloud function')) {
        errorMessage = '云函数调用失败，请稍后重试';
      }
      
      wx.showToast({
        title: errorMessage,
        icon: 'none'
      });
    } finally {
      // 确保加载状态被正确清除
      if (this.data) {
        this.setData({ isLoading: false });
      }
    }
  },

  // 返回学生端
  backToStudent() {
    wx.navigateBack();
  }
});