// pages/neighbor-preference/neighbor-preference.js
Page({
  data: {
    classmates: [],
    preferredNeighbors: [],
    avoidedNeighbors: [],
    searchText: '',
    filteredClassmates: [],
    loading: false,
    specialRequirements: '',
    seatSelection: null
  },

  onLoad: function() {
    // 获取座位选择数据
    const app = getApp();
    if (app.globalData && app.globalData.seatSelection) {
      this.setData({
        seatSelection: app.globalData.seatSelection
      });
    }
    
    this.loadClassmates();
  },

  // 加载同班同学列表
  loadClassmates: function() {
    const that = this;
    that.setData({ loading: true });

    wx.cloud.callFunction({
      name: 'seatArrangementFunctions',
      data: {
        type: 'getClassmates',
        token: wx.getStorageSync('token')
      },
      success: (res) => {
        console.log('get classmates success', res);
        
        if (res.result.success) {
          // 过滤掉自己
          const userInfo = wx.getStorageSync('userInfo');
          const classmates = res.result.data.classmates.filter(
            student => student.student_id !== userInfo.student_id
          );
          
          that.setData({
            classmates: classmates,
            filteredClassmates: classmates,
            loading: false
          });
        } else {
          that.setData({ loading: false });
          wx.showToast({
            title: res.result.message || '加载同学列表失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.error('get classmates failed', err);
        that.setData({ loading: false });
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none'
        });
      }
    });
  },

  // 搜索同学
  onSearchInput: function(e) {
    const searchText = e.detail.value.toLowerCase();
    this.setData({ searchText });
    
    if (searchText.trim() === '') {
      this.setData({
        filteredClassmates: this.data.classmates
      });
    } else {
      const filtered = this.data.classmates.filter(student => 
        student.name.toLowerCase().includes(searchText) ||
        student.student_number.includes(searchText)
      );
      this.setData({
        filteredClassmates: filtered
      });
    }
  },

  // 添加期望邻座
  onAddPreferred: function(e) {
    const studentId = e.currentTarget.dataset.studentId;
    const student = this.data.classmates.find(s => s.student_id === studentId);
    
    if (!student) return;
    
    // 检查是否已在期望列表中
    const isAlreadyPreferred = this.data.preferredNeighbors.some(s => s.student_id === studentId);
    if (isAlreadyPreferred) {
      wx.showToast({
        title: '已在期望邻座列表中',
        icon: 'none'
      });
      return;
    }
    
    // 检查是否超出限制
    if (this.data.preferredNeighbors.length >= 3) {
      wx.showToast({
        title: '最多选择3个期望邻座',
        icon: 'none'
      });
      return;
    }
    
    // 从避免列表中移除（如果存在）
    const avoidedNeighbors = this.data.avoidedNeighbors.filter(s => s.student_id !== studentId);
    
    // 添加到期望列表
    const preferredNeighbors = [...this.data.preferredNeighbors, {
      student_id: studentId,
      name: student.name,
      student_number: student.student_number,
      relationship: 'friend'
    }];
    
    this.setData({
      preferredNeighbors,
      avoidedNeighbors
    });
    
    wx.showToast({
      title: '已添加到期望邻座',
      icon: 'success'
    });
  },

  // 添加避免邻座
  onAddAvoided: function(e) {
    const studentId = e.currentTarget.dataset.studentId;
    const student = this.data.classmates.find(s => s.student_id === studentId);
    
    if (!student) return;
    
    // 检查是否已在避免列表中
    const isAlreadyAvoided = this.data.avoidedNeighbors.some(s => s.student_id === studentId);
    if (isAlreadyAvoided) {
      wx.showToast({
        title: '已在避免邻座列表中',
        icon: 'none'
      });
      return;
    }
    
    // 检查是否超出限制
    if (this.data.avoidedNeighbors.length >= 3) {
      wx.showToast({
        title: '最多选择3个避免邻座',
        icon: 'none'
      });
      return;
    }
    
    // 从期望列表中移除（如果存在）
    const preferredNeighbors = this.data.preferredNeighbors.filter(s => s.student_id !== studentId);
    
    // 添加到避免列表
    const avoidedNeighbors = [...this.data.avoidedNeighbors, {
      student_id: studentId,
      name: student.name,
      student_number: student.student_number,
      reason: 'personal_preference'
    }];
    
    this.setData({
      preferredNeighbors,
      avoidedNeighbors
    });
    
    wx.showToast({
      title: '已添加到避免邻座',
      icon: 'success'
    });
  },

  // 移除期望邻座
  onRemovePreferred: function(e) {
    const studentId = e.currentTarget.dataset.studentId;
    const preferredNeighbors = this.data.preferredNeighbors.filter(s => s.student_id !== studentId);
    
    this.setData({ preferredNeighbors });
  },

  // 移除避免邻座
  onRemoveAvoided: function(e) {
    const studentId = e.currentTarget.dataset.studentId;
    const avoidedNeighbors = this.data.avoidedNeighbors.filter(s => s.student_id !== studentId);
    
    this.setData({ avoidedNeighbors });
  },

  // 修改关系类型
  onRelationshipChange: function(e) {
    const studentId = e.currentTarget.dataset.studentId;
    const relationship = e.detail.value;
    
    const preferredNeighbors = this.data.preferredNeighbors.map(neighbor => {
      if (neighbor.student_id === studentId) {
        return { ...neighbor, relationship };
      }
      return neighbor;
    });
    
    this.setData({ preferredNeighbors });
  },

  // 修改避免原因
  onReasonChange: function(e) {
    const studentId = e.currentTarget.dataset.studentId;
    const reason = e.detail.value;
    
    const avoidedNeighbors = this.data.avoidedNeighbors.map(neighbor => {
      if (neighbor.student_id === studentId) {
        return { ...neighbor, reason };
      }
      return neighbor;
    });
    
    this.setData({ avoidedNeighbors });
  },

  // 输入特殊需求
  onSpecialRequirementsInput: function(e) {
    this.setData({
      specialRequirements: e.detail.value
    });
  },

  // 检查学生状态
  getStudentStatus: function(student) {
    const isPreferred = this.data.preferredNeighbors.some(s => s.student_id === student.student_id);
    const isAvoided = this.data.avoidedNeighbors.some(s => s.student_id === student.student_id);
    
    if (isPreferred) return 'preferred';
    if (isAvoided) return 'avoided';
    return 'normal';
  },

  // 上一步
  onPrevious: function() {
    wx.navigateBack();
  },

  // 下一步：提交意愿
  onNext: function() {
    // 保存邻座偏好到全局数据
    const app = getApp();
    app.globalData = app.globalData || {};
    app.globalData.neighborPreference = {
      preferred_neighbors: this.data.preferredNeighbors,
      avoided_neighbors: this.data.avoidedNeighbors,
      special_requirements: this.data.specialRequirements
    };
    
    wx.navigateTo({
      url: '/pages/wish-submit/wish-submit'
    });
  },

  // 清空所有选择
  onClearAll: function() {
    wx.showModal({
      title: '提示',
      content: '确定要清空所有邻座偏好吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            preferredNeighbors: [],
            avoidedNeighbors: [],
            specialRequirements: ''
          });
        }
      }
    });
  },

  // 获取关系类型名称
  getRelationshipName: function(relationship) {
    const relationshipMap = {
      'friend': '好友',
      'study_partner': '学习伙伴',
      'roommate': '室友',
      'other': '其他'
    };
    return relationshipMap[relationship] || '好友';
  },

  // 获取避免原因名称
  getReasonName: function(reason) {
    const reasonMap = {
      'personal_preference': '个人偏好',
      'personality_conflict': '性格不合',
      'study_interference': '影响学习',
      'other': '其他原因'
    };
    return reasonMap[reason] || '个人偏好';
  }
});