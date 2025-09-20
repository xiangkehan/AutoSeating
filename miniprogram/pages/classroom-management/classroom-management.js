// 教室管理页面逻辑
Page({
  data: {
    classrooms: []
  },

  onLoad: function() {
    this.fetchClassrooms();
  },

  onShow: function() {
    // 页面显示时重新加载数据
    this.fetchClassrooms();
  },

  // 获取教室列表
  fetchClassrooms: function() {
    wx.showLoading({ title: '加载中' });
    
    // 模拟获取数据
    // 实际应用中应该调用云函数获取数据
    setTimeout(() => {
      const classrooms = []; // 这里应该是从数据库获取的教室数据
      this.setData({ classrooms });
      wx.hideLoading();
    }, 500);
  },

  // 查看教室详情
  viewClassroom: function(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/classroom-management/classroom-detail?id=${id}`
    });
  },

  // 创建新教室
  createClassroom: function() {
    wx.navigateTo({
      url: '/pages/classroom-management/create-classroom'
    });
  }
});