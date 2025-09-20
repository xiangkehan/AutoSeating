// pages/result/result.js
Page({
  data: {
    currentSession: null,
    myAssignment: null,
    loading: true,
    hasResult: false,
    seatMap: [],
    classroomLayout: null,
    satisfactionScore: '0'
  },

  onLoad: function() {
    this.checkLoginStatus();
  },

  onShow: function() {
    if (this.data.currentSession) {
      this.loadResult();
    }
  },

  // 检查登录状态
  checkLoginStatus: function() {
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.redirectTo({
        url: '/pages/login/login'
      });
      return;
    }
    
    this.loadCurrentSession();
  },

  // 加载当前会话
  loadCurrentSession: function() {
    const that = this;
    
    wx.cloud.callFunction({
      name: 'seatArrangementFunctions',
      data: {
        type: 'getCurrentSession',
        token: wx.getStorageSync('token')
      },
      success: (res) => {
        if (res.result.success && res.result.data.session_id) {
          that.setData({
            currentSession: res.result.data,
            classroomLayout: res.result.data.classroom
          });
          
          // 如果排座已完成，加载结果
          if (res.result.data.status === 'published') {
            that.loadResult();
          } else {
            that.setData({ 
              loading: false,
              hasResult: false 
            });
          }
        } else {
          that.setData({ 
            loading: false,
            hasResult: false 
          });
        }
      },
      fail: (err) => {
        that.setData({ loading: false });
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        });
      }
    });
  },

  // 加载排座结果
  loadResult: function() {
    const that = this;
    
    wx.cloud.callFunction({
      name: 'seatArrangementFunctions',
      data: {
        type: 'getMyAssignment',
        token: wx.getStorageSync('token'),
        session_id: that.data.currentSession.session_id
      },
      success: (res) => {
        if (res.result.success && res.result.data) {
          const assignmentData = res.result.data;
          const score = assignmentData.satisfaction_score || 0;
          
          that.setData({
            myAssignment: assignmentData,
            satisfactionScore: (score * 100).toFixed(0),
            hasResult: true,
            loading: false
          });
          
          // 加载完整座位图
          that.loadSeatMap();
        } else {
          that.setData({ 
            loading: false,
            hasResult: false 
          });
        }
      },
      fail: (err) => {
        that.setData({ loading: false });
        wx.showToast({
          title: '加载结果失败',
          icon: 'none'
        });
      }
    });
  },

  // 加载座位图
  loadSeatMap: function() {
    const that = this;
    
    wx.cloud.callFunction({
      name: 'seatArrangementFunctions',
      data: {
        type: 'getArrangementResult',
        token: wx.getStorageSync('token'),
        session_id: that.data.currentSession.session_id,
        format: 'simple'
      },
      success: (res) => {
        if (res.result.success) {
          const seatMapData = res.result.data.classroom_layout.seat_map || [];
          
          // 为每个座位添加学生姓名首字母
          const processedSeatMap = seatMapData.map(row => {
            return row.map(seat => {
              return {
                ...seat,
                studentInitial: seat.student && seat.student.name 
                  ? seat.student.name.charAt(0) 
                  : ''
              };
            });
          });
          
          that.setData({
            seatMap: processedSeatMap
          });
        }
      },
      fail: (err) => {
        console.error('load seat map failed', err);
      }
    });
  },

  // 分享结果
  onShare: function() {
    if (!this.data.myAssignment) return;
    
    const assignment = this.data.myAssignment;
    wx.showShareMenu({
      withShareTicket: true,
      success: () => {
        console.log('share menu shown');
      }
    });
  },

  // 查看详细统计
  onViewStatistics: function() {
    wx.navigateTo({
      url: '/pages/statistics/statistics?session_id=' + this.data.currentSession.session_id
    });
  },

  // 重新提交意愿
  onResubmit: function() {
    wx.switchTab({
      url: '/pages/seat-selection/seat-selection'
    });
  },

  // 下拉刷新
  onPullDownRefresh: function() {
    this.loadCurrentSession();
    wx.stopPullDownRefresh();
  },

  // 获取满意度等级
  getSatisfactionLevel: function(score) {
    if (score >= 0.8) return 'excellent';
    if (score >= 0.6) return 'good';
    return 'fair';
  },

  // 获取满意度描述
  getSatisfactionDesc: function(score) {
    if (score >= 0.8) return '非常满意';
    if (score >= 0.6) return '比较满意';
    return '一般满意';
  }
});