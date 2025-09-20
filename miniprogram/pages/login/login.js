// pages/login/login.js
Page({
  data: {
    canIUse: wx.canIUse('button.open-type.getUserInfo'),
    isLoggedIn: false,
    userInfo: {},
    loading: false
  },

  onLoad: function(options) {
    // 检查是否已经登录
    this.checkLoginStatus();
  },

  // 检查登录状态
  checkLoginStatus: function() {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    
    if (token && userInfo) {
      this.setData({
        isLoggedIn: true,
        userInfo: userInfo
      });
      // 跳转到主页面
      this.navigateToMain();
    }
  },

  // 微信授权登录
  onWxLogin: function() {
    const that = this;
    
    if (!wx.cloud) {
      wx.showToast({
        title: '请使用2.2.3或以上版本的基础库',
        icon: 'none'
      });
      return;
    }

    that.setData({ loading: true });

    // 获取微信授权
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        console.log('getUserProfile success', res);
        
        // 获取微信登录凭证
        wx.login({
          success: (loginRes) => {
            console.log('wx.login success', loginRes);
            
            // 调用云函数进行登录
            that.callCloudLogin(loginRes.code, res.userInfo);
          },
          fail: (err) => {
            console.error('wx.login failed', err);
            that.setData({ loading: false });
            wx.showToast({
              title: '登录失败，请重试',
              icon: 'none'
            });
          }
        });
      },
      fail: (err) => {
        console.error('getUserProfile failed', err);
        that.setData({ loading: false });
        wx.showToast({
          title: '需要授权才能使用',
          icon: 'none'
        });
      }
    });
  },

  // 调用云函数登录
  callCloudLogin: function(code, userInfo) {
    const that = this;
    
    wx.cloud.callFunction({
      name: 'seatArrangementFunctions',
      data: {
        type: 'wxLogin',
        code: code,
        userInfo: userInfo
      },
      success: (res) => {
        console.log('cloud login success', res);
        
        if (res.result.success) {
          // 保存登录信息
          wx.setStorageSync('token', res.result.data.token);
          wx.setStorageSync('userInfo', res.result.data.userProfile);
          wx.setStorageSync('expiresIn', res.result.data.expiresIn);
          wx.setStorageSync('loginTime', Date.now());
          
          that.setData({
            isLoggedIn: true,
            userInfo: res.result.data.userProfile,
            loading: false
          });
          
          wx.showToast({
            title: '登录成功',
            icon: 'success'
          });
          
          // 检查是否需要完善个人信息
          that.checkUserProfile(res.result.data.userProfile);
        } else {
          that.setData({ loading: false });
          wx.showToast({
            title: res.result.message || '登录失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.error('cloud login failed', err);
        that.setData({ loading: false });
        wx.showToast({
          title: '登录失败，请检查网络',
          icon: 'none'
        });
      }
    });
  },

  // 检查用户信息是否完整
  checkUserProfile: function(userProfile) {
    if (!userProfile.student_id || !userProfile.name) {
      // 需要完善个人信息
      wx.navigateTo({
        url: '/pages/profile/profile?action=setup'
      });
    } else {
      // 信息完整，跳转到主页面
      this.navigateToMain();
    }
  },

  // 跳转到主页面
  navigateToMain: function() {
    wx.switchTab({
      url: '/pages/seat-selection/seat-selection'
    });
  },

  // 跳转到管理员登录
  navigateToAdmin: function() {
    wx.navigateTo({
      url: '/pages/admin-login/admin-login'
    });
  },

  // 退出登录
  onLogout: function() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除本地存储
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          wx.removeStorageSync('expiresIn');
          wx.removeStorageSync('loginTime');
          
          this.setData({
            isLoggedIn: false,
            userInfo: {}
          });
          
          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          });
        }
      }
    });
  }
});