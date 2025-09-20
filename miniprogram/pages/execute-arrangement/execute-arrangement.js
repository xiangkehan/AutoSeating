// 执行排座页面逻辑
Page({
  data: {
    sessions: [],
    sessionIndex: 0,
    classrooms: [],
    classroomIndex: 0,
    considerPreferences: true,
    balanceScores: true,
    isExecuting: false
  },

  onLoad: function() {
    this.fetchSessions();
    this.fetchClassrooms();
  },

  // 获取会话列表
  fetchSessions: function() {
    wx.showLoading({ title: '加载中' });
    
    // 模拟获取数据
    // 实际应用中应该调用云函数获取数据
    setTimeout(() => {
      const sessions = []; // 这里应该是从数据库获取的会话数据
      this.setData({ sessions });
      wx.hideLoading();
    }, 500);
  },

  // 获取教室列表
  fetchClassrooms: function() {
    // 模拟获取数据
    setTimeout(() => {
      const classrooms = []; // 这里应该是从数据库获取的教室数据
      this.setData({ classrooms });
    }, 500);
  },

  // 选择会话
  onSessionChange: function(e) {
    this.setData({ sessionIndex: e.detail.value });
  },

  // 选择教室
  onClassroomChange: function(e) {
    this.setData({ classroomIndex: e.detail.value });
  },

  // 切换是否考虑学生偏好
  onPreferenceChange: function(e) {
    this.setData({ considerPreferences: e.detail.value });
  },

  // 切换是否平衡学习成绩
  onScoreBalanceChange: function(e) {
    this.setData({ balanceScores: e.detail.value });
  },

  // 执行排座
  executeArrangement: function() {
    const { sessionIndex, classroomIndex, sessions, classrooms, considerPreferences, balanceScores } = this.data;
    
    if (!sessions[sessionIndex]) {
      wx.showToast({ title: '请选择会话', icon: 'none' });
      return;
    }
    
    if (!classrooms[classroomIndex]) {
      wx.showToast({ title: '请选择教室', icon: 'none' });
      return;
    }
    
    this.setData({ isExecuting: true });
    
    // 调用云函数执行排座算法
    wx.cloud.callFunction({
      name: 'seatArrangementFunctions',
      data: {
        action: 'executeArrangement',
        sessionId: sessions[sessionIndex].id,
        classroomId: classrooms[classroomIndex].id,
        considerPreferences,
        balanceScores
      },
      success: res => {
        wx.showToast({ title: '排座成功', icon: 'success' });
        // 跳转到结果页面
        wx.navigateTo({
          url: `/pages/result/result?arrangementId=${res.result.arrangementId}`
        });
      },
      fail: err => {
        console.error('排座失败', err);
        wx.showToast({ title: '排座失败', icon: 'none' });
      },
      complete: () => {
        this.setData({ isExecuting: false });
      }
    });
  }
});