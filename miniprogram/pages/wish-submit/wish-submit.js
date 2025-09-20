// pages/wish-submit/wish-submit.js
Page({
  data: {
    seatSelection: null,
    neighborPreference: null,
    wishData: {},
    submitting: false,
    isModification: false
  },

  onLoad: function() {
    this.loadWishData();
  },

  // 加载意愿数据
  loadWishData: function() {
    const app = getApp();
    
    // 从全局数据获取
    const seatSelection = app.globalData?.seatSelection || {};
    const neighborPreference = app.globalData?.neighborPreference || {};
    
    // 构建完整的意愿数据
    const wishData = {
      preferred_seats: seatSelection.preferred_seats || [],
      avoided_seats: seatSelection.avoided_seats || [],
      preferred_neighbors: neighborPreference.preferred_neighbors || [],
      avoided_neighbors: neighborPreference.avoided_neighbors || [],
      special_requirements: neighborPreference.special_requirements || ''
    };
    
    this.setData({
      seatSelection,
      neighborPreference,
      wishData
    });
  },

  // 提交意愿
  onSubmit: function() {
    const that = this;
    
    // 验证数据
    if (!this.validateWishData()) {
      return;
    }
    
    that.setData({ submitting: true });
    
    wx.cloud.callFunction({
      name: 'seatArrangementFunctions',
      data: {
        type: that.data.isModification ? 'updateWish' : 'submitWish',
        token: wx.getStorageSync('token'),
        wish_data: that.data.wishData
      },
      success: (res) => {
        console.log('submit wish success', res);
        
        if (res.result.success) {
          wx.showToast({
            title: '提交成功',
            icon: 'success'
          });
          
          // 清除全局数据
          const app = getApp();
          app.globalData = {};
          
          setTimeout(() => {
            wx.switchTab({
              url: '/pages/result/result'
            });
          }, 1500);
        } else {
          that.setData({ submitting: false });
          wx.showToast({
            title: res.result.message || '提交失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.error('submit wish failed', err);
        that.setData({ submitting: false });
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none'
        });
      }
    });
  },

  // 验证意愿数据
  validateWishData: function() {
    const { preferred_seats, avoided_seats } = this.data.wishData;
    
    if (preferred_seats.length === 0 && avoided_seats.length === 0) {
      wx.showToast({
        title: '请至少选择一个座位偏好',
        icon: 'none'
      });
      return false;
    }
    
    return true;
  },

  // 修改座位偏好
  onModifySeat: function() {
    wx.navigateTo({
      url: '/pages/seat-selection/seat-selection'
    });
  },

  // 修改邻座偏好
  onModifyNeighbor: function() {
    wx.navigateTo({
      url: '/pages/neighbor-preference/neighbor-preference'
    });
  }
});