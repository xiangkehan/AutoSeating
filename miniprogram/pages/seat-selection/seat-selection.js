// pages/seat-selection/seat-selection.js
Page({
  data: {
    currentSession: null,
    classroom: null,
    seats: [],
    selectedPreferred: [],
    selectedAvoided: [],
    selectionMode: 'preferred', // preferred, avoided
    loading: true,
    hasSession: false,
    userWish: null,
    canModify: false,
    scale: 1,
    translateX: 0,
    translateY: 0
  },

  onLoad: function() {
    this.checkLoginStatus();
  },

  onShow: function() {
    if (this.data.hasSession) {
      this.loadCurrentSession();
    }
  },

  // 检查登录状态
  checkLoginStatus: function() {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    
    if (!token || !userInfo) {
      wx.redirectTo({
        url: '/pages/login/login'
      });
      return;
    }
    
    // 检查用户信息是否完整
    if (!userInfo.student_id || !userInfo.name) {
      wx.navigateTo({
        url: '/pages/profile/profile?action=setup'
      });
      return;
    }
    
    this.loadCurrentSession();
  },

  // 加载当前排座会话
  loadCurrentSession: function() {
    const that = this;
    that.setData({ loading: true });

    wx.cloud.callFunction({
      name: 'seatArrangementFunctions',
      data: {
        type: 'getCurrentSession',
        token: wx.getStorageSync('token')
      },
      success: (res) => {
        console.log('get current session success', res);
        
        if (res.result.success && res.result.data.session_id) {
          that.setData({
            currentSession: res.result.data,
            classroom: res.result.data.classroom,
            seats: res.result.data.classroom.layout_config.seats || [],
            hasSession: true,
            canModify: res.result.data.can_modify,
            loading: false
          });
          
          // 如果已提交意愿，加载已有意愿
          if (res.result.data.my_wish_status === 'submitted') {
            that.loadMyWish();
          }
        } else {
          that.setData({
            hasSession: false,
            loading: false
          });
          
          wx.showToast({
            title: '当前没有进行中的排座会话',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.error('get current session failed', err);
        that.setData({ loading: false });
        wx.showToast({
          title: '加载失败，请检查网络',
          icon: 'none'
        });
      }
    });
  },

  // 加载我的意愿
  loadMyWish: function() {
    const that = this;
    
    wx.cloud.callFunction({
      name: 'seatArrangementFunctions',
      data: {
        type: 'getMyWish',
        token: wx.getStorageSync('token'),
        session_id: that.data.currentSession.session_id
      },
      success: (res) => {
        console.log('get my wish success', res);
        
        if (res.result.success && res.result.data) {
          const wishData = res.result.data.wish_data;
          that.setData({
            userWish: res.result.data,
            selectedPreferred: wishData.preferred_seats || [],
            selectedAvoided: wishData.avoided_seats || []
          });
        }
      },
      fail: (err) => {
        console.error('get my wish failed', err);
      }
    });
  },

  // 切换选择模式
  onModeChange: function(e) {
    this.setData({
      selectionMode: e.detail.value
    });
  },

  // 座位点击事件
  onSeatTap: function(e) {
    if (!this.data.canModify) {
      wx.showToast({
        title: '当前不可修改意愿',
        icon: 'none'
      });
      return;
    }

    const seatId = e.currentTarget.dataset.seatId;
    const seat = this.data.seats.find(s => s.seat_id === seatId);
    
    if (!seat || !seat.is_available) {
      wx.showToast({
        title: '该座位不可选择',
        icon: 'none'
      });
      return;
    }

    if (this.data.selectionMode === 'preferred') {
      this.handlePreferredSeatSelection(seat);
    } else {
      this.handleAvoidedSeatSelection(seat);
    }
  },

  // 处理偏好座位选择
  handlePreferredSeatSelection: function(seat) {
    let selectedPreferred = [...this.data.selectedPreferred];
    let selectedAvoided = [...this.data.selectedAvoided];
    
    // 检查是否已在偏好列表中
    const preferredIndex = selectedPreferred.findIndex(s => s.seat_id === seat.seat_id);
    
    if (preferredIndex > -1) {
      // 已选择，移除
      selectedPreferred.splice(preferredIndex, 1);
    } else {
      // 未选择，添加
      if (selectedPreferred.length >= 5) {
        wx.showToast({
          title: '最多选择5个偏好座位',
          icon: 'none'
        });
        return;
      }
      
      // 从避免列表中移除（如果存在）
      const avoidedIndex = selectedAvoided.findIndex(s => s.seat_id === seat.seat_id);
      if (avoidedIndex > -1) {
        selectedAvoided.splice(avoidedIndex, 1);
      }
      
      selectedPreferred.push({
        seat_id: seat.seat_id,
        position: seat.position,
        priority: selectedPreferred.length + 1
      });
    }
    
    this.setData({
      selectedPreferred,
      selectedAvoided
    });
  },

  // 处理避免座位选择
  handleAvoidedSeatSelection: function(seat) {
    let selectedPreferred = [...this.data.selectedPreferred];
    let selectedAvoided = [...this.data.selectedAvoided];
    
    // 检查是否已在避免列表中
    const avoidedIndex = selectedAvoided.findIndex(s => s.seat_id === seat.seat_id);
    
    if (avoidedIndex > -1) {
      // 已选择，移除
      selectedAvoided.splice(avoidedIndex, 1);
    } else {
      // 未选择，添加
      if (selectedAvoided.length >= 5) {
        wx.showToast({
          title: '最多选择5个避免座位',
          icon: 'none'
        });
        return;
      }
      
      // 从偏好列表中移除（如果存在）
      const preferredIndex = selectedPreferred.findIndex(s => s.seat_id === seat.seat_id);
      if (preferredIndex > -1) {
        selectedPreferred.splice(preferredIndex, 1);
        // 重新排序优先级
        selectedPreferred = selectedPreferred.map((s, index) => ({
          ...s,
          priority: index + 1
        }));
      }
      
      selectedAvoided.push({
        seat_id: seat.seat_id,
        position: seat.position
      });
    }
    
    this.setData({
      selectedPreferred,
      selectedAvoided
    });
  },

  // 获取座位状态
  getSeatStatus: function(seat) {
    if (!seat.is_available) return 'unavailable';
    
    const isPreferred = this.data.selectedPreferred.some(s => s.seat_id === seat.seat_id);
    const isAvoided = this.data.selectedAvoided.some(s => s.seat_id === seat.seat_id);
    
    if (isPreferred) return 'preferred';
    if (isAvoided) return 'avoided';
    return 'available';
  },

  // 获取座位优先级
  getSeatPriority: function(seat) {
    const preferred = this.data.selectedPreferred.find(s => s.seat_id === seat.seat_id);
    return preferred ? preferred.priority : null;
  },

  // 清空选择
  onClearSelection: function() {
    wx.showModal({
      title: '提示',
      content: '确定要清空所有选择吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            selectedPreferred: [],
            selectedAvoided: []
          });
        }
      }
    });
  },

  // 下一步：设置邻座偏好
  onNext: function() {
    if (this.data.selectedPreferred.length === 0) {
      wx.showModal({
        title: '提示',
        content: '建议至少选择1个偏好座位，确定要继续吗？',
        success: (res) => {
          if (res.confirm) {
            this.navigateToNext();
          }
        }
      });
      return;
    }
    
    this.navigateToNext();
  },

  // 跳转到下一步
  navigateToNext: function() {
    // 将座位选择数据存储到全局
    const app = getApp();
    app.globalData = app.globalData || {};
    app.globalData.seatSelection = {
      preferred_seats: this.data.selectedPreferred,
      avoided_seats: this.data.selectedAvoided
    };
    
    wx.navigateTo({
      url: '/pages/neighbor-preference/neighbor-preference'
    });
  },

  // 触摸开始
  onTouchStart: function(e) {
    this.startX = e.touches[0].clientX;
    this.startY = e.touches[0].clientY;
    this.startScale = this.data.scale;
    this.startTranslateX = this.data.translateX;
    this.startTranslateY = this.data.translateY;
  },

  // 触摸移动
  onTouchMove: function(e) {
    if (e.touches.length === 1) {
      // 单指拖拽
      const deltaX = e.touches[0].clientX - this.startX;
      const deltaY = e.touches[0].clientY - this.startY;
      
      this.setData({
        translateX: this.startTranslateX + deltaX,
        translateY: this.startTranslateY + deltaY
      });
    }
  },

  // 缩放
  onScale: function(e) {
    const scale = Math.max(0.5, Math.min(3, e.detail.scale));
    this.setData({ scale });
  },

  // 重置视图
  onResetView: function() {
    this.setData({
      scale: 1,
      translateX: 0,
      translateY: 0
    });
  },

  // 下拉刷新
  onPullDownRefresh: function() {
    this.loadCurrentSession();
    wx.stopPullDownRefresh();
  }
});