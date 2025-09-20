// 排座会话管理页面逻辑
Page({
  data: {
    sessionList: [],
    classList: [],
    classroomList: [],
    showCreateModal: false,
    showDetailModal: false,
    selectedSession: null,
    sessionStats: {},
    newSession: {
      name: '',
      classIndex: -1,
      classroomIndex: -1,
      deadline: '',
      config: {
        seatWeight: 40,
        relationWeight: 30,
        specialWeight: 30
      }
    }
  },

  onLoad() {
    wx.setNavigationBarTitle({
      title: '会话管理'
    });
    
    this.loadInitialData();
  },

  onShow() {
    this.refreshSessions();
  },

  // 加载初始数据
  async loadInitialData() {
    await Promise.all([
      this.loadSessionList(),
      this.loadClassList(),
      this.loadClassroomList()
    ]);
  },

  // 加载会话列表
  async loadSessionList() {
    try {
      const token = wx.getStorageSync('adminToken');
      const result = await wx.cloud.callFunction({
        name: 'seatArrangementFunctions',
        data: {
          type: 'getSessionList',
          token
        }
      });

      if (result.result.success) {
        this.setData({
          sessionList: result.result.data
        });
      }
    } catch (error) {
      console.error('加载会话列表失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  // 加载班级列表
  async loadClassList() {
    try {
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
      }
    } catch (error) {
      console.error('加载班级列表失败:', error);
    }
  },

  // 加载教室列表
  async loadClassroomList() {
    try {
      const token = wx.getStorageSync('adminToken');
      const result = await wx.cloud.callFunction({
        name: 'seatArrangementFunctions',
        data: {
          type: 'getClassroomList',
          token
        }
      });

      if (result.result.success) {
        this.setData({
          classroomList: result.result.data
        });
      }
    } catch (error) {
      console.error('加载教室列表失败:', error);
    }
  },

  // 刷新会话列表
  async refreshSessions() {
    wx.showLoading({
      title: '刷新中...'
    });
    
    await this.loadSessionList();
    
    wx.hideLoading();
    wx.showToast({
      title: '刷新完成',
      icon: 'success',
      duration: 1000
    });
  },

  // 显示创建会话弹窗
  showCreateModal() {
    this.setData({
      showCreateModal: true,
      newSession: {
        name: '',
        classIndex: -1,
        classroomIndex: -1,
        deadline: '',
        config: {
          seatWeight: 40,
          relationWeight: 30,
          specialWeight: 30
        }
      }
    });
  },

  // 隐藏创建会话弹窗
  hideCreateModal() {
    this.setData({
      showCreateModal: false
    });
  },

  // 会话名称输入
  onSessionNameInput(e) {
    this.setData({
      'newSession.name': e.detail.value
    });
  },

  // 班级选择
  onClassChange(e) {
    const classIndex = parseInt(e.detail.value);
    this.setData({
      'newSession.classIndex': classIndex
    });
  },

  // 教室选择
  onClassroomChange(e) {
    const classroomIndex = parseInt(e.detail.value);
    this.setData({
      'newSession.classroomIndex': classroomIndex
    });
  },

  // 截止时间选择
  onDeadlineChange(e) {
    this.setData({
      'newSession.deadline': e.detail.value
    });
  },

  // 算法配置改变
  onConfigChange(e) {
    const key = e.currentTarget.dataset.key;
    const value = e.detail.value;
    this.setData({
      [`newSession.config.${key}`]: value
    });
  },

  // 创建会话
  async createSession() {
    const { newSession, classList, classroomList } = this.data;
    
    // 验证输入
    if (!newSession.name.trim()) {
      wx.showToast({
        title: '请输入会话名称',
        icon: 'none'
      });
      return;
    }
    
    if (newSession.classIndex < 0) {
      wx.showToast({
        title: '请选择班级',
        icon: 'none'
      });
      return;
    }
    
    if (newSession.classroomIndex < 0) {
      wx.showToast({
        title: '请选择教室',
        icon: 'none'
      });
      return;
    }
    
    if (!newSession.deadline) {
      wx.showToast({
        title: '请选择截止时间',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '创建中...'
    });

    try {
      const token = wx.getStorageSync('adminToken');
      const selectedClass = classList[newSession.classIndex];
      const selectedClassroom = classroomList[newSession.classroomIndex];
      
      const result = await wx.cloud.callFunction({
        name: 'seatArrangementFunctions',
        data: {
          type: 'createArrangementSession',
          session_data: {
            name: newSession.name.trim(),
            class_id: selectedClass.class_id,
            classroom_id: selectedClassroom.classroom_id,
            deadline: newSession.deadline,
            algorithm_config: newSession.config
          },
          token
        }
      });

      wx.hideLoading();

      if (result.result.success) {
        wx.showToast({
          title: '创建成功',
          icon: 'success'
        });
        
        this.hideCreateModal();
        this.refreshSessions();
      } else {
        wx.showToast({
          title: result.result.message || '创建失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('创建会话失败:', error);
      wx.showToast({
        title: '创建失败，请重试',
        icon: 'none'
      });
    }
  },

  // 选择会话
  selectSession(e) {
    const session = e.currentTarget.dataset.session;
    this.viewSessionDetail(session);
  },

  // 查看会话详情
  async viewSessionDetail(session) {
    this.setData({
      selectedSession: session,
      showDetailModal: true
    });
    
    await this.loadSessionStats(session.session_id);
  },

  // 加载会话统计
  async loadSessionStats(sessionId) {
    try {
      const token = wx.getStorageSync('adminToken');
      const result = await wx.cloud.callFunction({
        name: 'seatArrangementFunctions',
        data: {
          type: 'getSessionStatistics',
          session_id: sessionId,
          token
        }
      });

      if (result.result.success) {
        this.setData({
          sessionStats: result.result.data
        });
      }
    } catch (error) {
      console.error('加载会话统计失败:', error);
    }
  },

  // 隐藏详情弹窗
  hideDetailModal() {
    this.setData({
      showDetailModal: false,
      selectedSession: null,
      sessionStats: {}
    });
  },

  // 查看会话
  viewSession(e) {
    const sessionId = e.currentTarget.dataset.sessionId;
    const session = this.data.sessionList.find(s => s.session_id === sessionId);
    if (session) {
      this.viewSessionDetail(session);
    }
  },

  // 执行排座
  async executeArrangement(e) {
    const sessionId = e.currentTarget.dataset.sessionId;
    
    const result = await wx.showModal({
      title: '确认执行',
      content: '确定要执行排座算法吗？执行后将生成座位分配结果。',
      confirmText: '执行',
      cancelText: '取消'
    });

    if (!result.confirm) return;

    wx.showLoading({
      title: '执行中...'
    });

    try {
      const token = wx.getStorageSync('adminToken');
      const executeResult = await wx.cloud.callFunction({
        name: 'seatArrangementFunctions',
        data: {
          type: 'executeAdminArrangement',
          session_id: sessionId,
          token
        }
      });

      wx.hideLoading();

      if (executeResult.result.success) {
        wx.showToast({
          title: '执行成功',
          icon: 'success'
        });
        
        this.refreshSessions();
      } else {
        wx.showToast({
          title: executeResult.result.message || '执行失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('执行排座失败:', error);
      wx.showToast({
        title: '执行失败，请重试',
        icon: 'none'
      });
    }
  },

  // 发布结果
  async publishResult(e) {
    const sessionId = e.currentTarget.dataset.sessionId;
    
    const result = await wx.showModal({
      title: '确认发布',
      content: '确定要发布排座结果吗？发布后学生将能查看自己的座位。',
      confirmText: '发布',
      cancelText: '取消'
    });

    if (!result.confirm) return;

    wx.showLoading({
      title: '发布中...'
    });

    try {
      const token = wx.getStorageSync('adminToken');
      const publishResult = await wx.cloud.callFunction({
        name: 'seatArrangementFunctions',
        data: {
          type: 'publishSessionResult',
          session_id: sessionId,
          token
        }
      });

      wx.hideLoading();

      if (publishResult.result.success) {
        wx.showToast({
          title: '发布成功',
          icon: 'success'
        });
        
        this.refreshSessions();
      } else {
        wx.showToast({
          title: publishResult.result.message || '发布失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('发布结果失败:', error);
      wx.showToast({
        title: '发布失败，请重试',
        icon: 'none'
      });
    }
  },

  // 导出会话数据
  exportSessionData() {
    wx.showToast({
      title: '导出功能开发中',
      icon: 'none'
    });
  },

  // 管理会话
  manageSession() {
    wx.showToast({
      title: '管理功能开发中',
      icon: 'none'
    });
  },

  // 获取状态文本
  getStatusText(status) {
    const statusMap = {
      'active': '进行中',
      'completed': '已完成',
      'expired': '已过期',
      'published': '已发布'
    };
    return statusMap[status] || '未知';
  },

  // 格式化日期
  formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN');
  }
});