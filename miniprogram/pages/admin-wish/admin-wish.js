// 管理员意愿填写页面逻辑
const { createButtonStateManager } = require('../../utils/buttonStateManager');

Page({
  data: {
    adminInfo: {},
    currentTab: 'prefer',
    classList: [],
    selectedClassIndex: -1,
    seatLayout: [],
    preferredSeats: [],
    avoidSeats: [],
    colleagueList: [],
    avoidColleagueList: [],
    specialRequirements: '',
    buttonStates: {}
  },

  onLoad() {
    wx.setNavigationBarTitle({
      title: '管理员意愿填写'
    });
    
    // 初始化按钮状态管理器
    this.buttonManager = createButtonStateManager(this);
    
    // 初始化按钮状态
    this.buttonManager.initButton('submitBtn', {
      text: '提交意愿',
      type: 'primary',
      loadingText: '提交中...',
      successText: '提交成功'
    });
    
    this.buttonManager.initButton('loadClassBtn', {
      text: '加载班级',
      type: 'secondary',
      loadingText: '加载中...',
      successText: '加载成功'
    });
    
    this.buttonManager.initButton('loadColleagueBtn', {
      text: '加载同事',
      type: 'secondary', 
      loadingText: '加载中...',
      successText: '加载成功'
    });
    
    this.loadAdminInfo();
    this.loadClassList();
    this.loadColleagueList();
  },
  
  onUnload() {
    // 页面销毁时清理资源
    if (this.buttonManager) {
      this.buttonManager.cleanup();
    }
  },

  // 加载管理员信息
  loadAdminInfo() {
    const adminInfo = wx.getStorageSync('adminInfo');
    if (adminInfo) {
      this.setData({ adminInfo });
    } else {
      wx.redirectTo({
        url: '/pages/admin-login/admin-login'
      });
    }
  },

  // 加载班级列表
  async loadClassList() {
    await this.buttonManager.executeAsync('loadClassBtn', async () => {
      const token = wx.getStorageSync('adminToken');
      const result = await wx.cloud.callFunction({
        name: 'seatArrangementFunctions',
        data: {
          type: 'getClassList',
          token
        }
      });

      if (result.result.success) {
        this.setData({
          classList: result.result.data
        });
        return result;
      } else {
        throw new Error('加载班级列表失败');
      }
    }, {
      successText: '',
      hideSuccess: true
    });
  },

  // 加载同事列表
  async loadColleagueList() {
    await this.buttonManager.executeAsync('loadColleagueBtn', async () => {
      const token = wx.getStorageSync('adminToken');
      const result = await wx.cloud.callFunction({
        name: 'seatArrangementFunctions',
        data: {
          type: 'getColleagueList',
          token
        }
      });

      if (result.result.success) {
        const colleagues = result.result.data.map(colleague => ({
          ...colleague,
          selected: false
        }));
        
        this.setData({
          colleagueList: colleagues,
          avoidColleagueList: colleagues.map(c => ({...c}))
        });
        return result;
      } else {
        throw new Error('加载同事列表失败');
      }
    }, {
      successText: '',
      hideSuccess: true
    });
  },

  // 班级选择
  async onClassChange(e) {
    const index = e.detail.value;
    const selectedClass = this.data.classList[index];
    
    this.setData({
      selectedClassIndex: index
    });

    // 加载教室座位布局
    await this.loadSeatLayout(selectedClass.classroom_id);
  },

  // 加载座位布局
  async loadSeatLayout(classroomId) {
    try {
      const token = wx.getStorageSync('adminToken');
      const result = await wx.cloud.callFunction({
        name: 'seatArrangementFunctions',
        data: {
          type: 'getClassroomLayout',
          classroom_id: classroomId,
          token
        }
      });

      if (result.result.success) {
        this.setData({
          seatLayout: result.result.data.seats
        });
      }
    } catch (error) {
      console.error('加载座位布局失败:', error);
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

  // 切换标签页
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      currentTab: tab
    });
  },

  // 座位点击
  onSeatTap(e) {
    const seat = e.currentTarget.dataset.seat;
    const { currentTab, preferredSeats, avoidSeats } = this.data;
    
    if (currentTab === 'prefer') {
      const index = preferredSeats.findIndex(s => s.id === seat.id);
      if (index >= 0) {
        preferredSeats.splice(index, 1);
      } else {
        // 从避免列表中移除
        const avoidIndex = avoidSeats.findIndex(s => s.id === seat.id);
        if (avoidIndex >= 0) {
          avoidSeats.splice(avoidIndex, 1);
        }
        preferredSeats.push(seat);
      }
      
      this.setData({
        preferredSeats,
        avoidSeats
      });
    } else {
      const index = avoidSeats.findIndex(s => s.id === seat.id);
      if (index >= 0) {
        avoidSeats.splice(index, 1);
      } else {
        // 从偏好列表中移除
        const preferIndex = preferredSeats.findIndex(s => s.id === seat.id);
        if (preferIndex >= 0) {
          preferredSeats.splice(preferIndex, 1);
        }
        avoidSeats.push(seat);
      }
      
      this.setData({
        preferredSeats,
        avoidSeats
      });
    }
  },

  // 获取座位样式类
  getSeatClass(seat) {
    const { preferredSeats, avoidSeats } = this.data;
    
    if (preferredSeats.find(s => s.id === seat.id)) {
      return 'prefer';
    }
    if (avoidSeats.find(s => s.id === seat.id)) {
      return 'avoid';
    }
    return '';
  },

  // 切换同事选择
  toggleColleague(e) {
    const id = e.currentTarget.dataset.id;
    const { colleagueList } = this.data;
    
    const colleague = colleagueList.find(c => c.id === id);
    if (colleague) {
      colleague.selected = !colleague.selected;
      this.setData({ colleagueList });
    }
  },

  // 切换避开同事选择
  toggleAvoidColleague(e) {
    const id = e.currentTarget.dataset.id;
    const { avoidColleagueList } = this.data;
    
    const colleague = avoidColleagueList.find(c => c.id === id);
    if (colleague) {
      colleague.selected = !colleague.selected;
      this.setData({ avoidColleagueList });
    }
  },

  // 特殊需求输入
  onSpecialInput(e) {
    this.setData({
      specialRequirements: e.detail.value
    });
  },

  // 提交意愿
  async submitWish() {
    const { 
      selectedClassIndex, 
      classList, 
      preferredSeats, 
      avoidSeats,
      colleagueList,
      avoidColleagueList,
      specialRequirements 
    } = this.data;

    if (selectedClassIndex < 0) {
      wx.showToast({
        title: '请选择参与班级',
        icon: 'none'
      });
      return;
    }

    await this.buttonManager.executeAsync('submitBtn', async () => {
      const token = wx.getStorageSync('adminToken');
      const preferredColleagues = colleagueList.filter(c => c.selected).map(c => c.id);
      const avoidColleagues = avoidColleagueList.filter(c => c.selected).map(c => c.id);
      
      const result = await wx.cloud.callFunction({
        name: 'seatArrangementFunctions',
        data: {
          type: 'submitAdminWish',
          class_id: classList[selectedClassIndex].id,
          wish_data: {
            preferred_seats: preferredSeats.map(s => s.id),
            avoid_seats: avoidSeats.map(s => s.id),
            preferred_neighbors: preferredColleagues,
            avoid_neighbors: avoidColleagues,
            special_requirements: specialRequirements
          },
          token
        }
      });

      if (result.result.success) {
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
        return result;
      } else {
        throw new Error(result.result.message || '提交失败');
      }
    }, {
      successText: '意愿提交成功',
      useErrorModal: true,
      errorTitle: '提交失败'
    });
  }
});