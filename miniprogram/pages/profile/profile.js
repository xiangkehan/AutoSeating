// pages/profile/profile.js
Page({
  data: {
    action: 'view', // view, setup, edit
    userInfo: {},
    formData: {
      name: '',
      student_number: '',
      class_id: '',
      special_needs: {
        vision_impaired: false,
        hearing_impaired: false,
        height_tall: false,
        other_requirements: ''
      }
    },
    classList: [],
    selectedClassName: '',
    loading: false,
    submitting: false
  },

  onLoad: function(options) {
    const action = options.action || 'view';
    this.setData({ action });

    // 加载用户信息
    this.loadUserInfo();
    
    // 加载班级列表
    this.loadClassList();
  },

  // 加载用户信息
  loadUserInfo: function() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.setData({
        userInfo: userInfo,
        formData: {
          name: userInfo.name || '',
          student_number: userInfo.student_number || '',
          class_id: userInfo.class_id || '',
          special_needs: userInfo.special_needs || {
            vision_impaired: false,
            hearing_impaired: false,
            height_tall: false,
            other_requirements: ''
          }
        }
      }, () => {
        this.updateSelectedClassName();
      });
    }
  },

  // 更新选中的班级名称
  updateSelectedClassName: function() {
    const { class_id } = this.data.formData;
    const { classList } = this.data;
    
    if (class_id && classList.length > 0) {
      const selectedClass = classList.find(item => item.class_id === class_id);
      this.setData({
        selectedClassName: selectedClass ? selectedClass.name : ''
      });
    } else {
      this.setData({
        selectedClassName: ''
      });
    }
  },

  // 加载班级列表
  loadClassList: function() {
    const that = this;
    that.setData({ loading: true });

    wx.cloud.callFunction({
      name: 'seatArrangementFunctions',
      data: {
        type: 'getClassList',
        token: wx.getStorageSync('token')
      },
      success: (res) => {
        console.log('get class list success', res);
        if (res.result.success) {
          that.setData({
            classList: res.result.data.classes || [],
            loading: false
          }, () => {
            that.updateSelectedClassName();
          });
        } else {
          that.setData({ loading: false });
          wx.showToast({
            title: res.result.message || '加载班级列表失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.error('get class list failed', err);
        that.setData({ loading: false });
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none'
        });
      }
    });
  },

  // 输入姓名
  onNameInput: function(e) {
    this.setData({
      'formData.name': e.detail.value
    });
  },

  // 输入学号
  onStudentNumberInput: function(e) {
    this.setData({
      'formData.student_number': e.detail.value
    });
  },

  // 选择班级
  onClassChange: function(e) {
    const index = e.detail.value;
    const selectedClass = this.data.classList[index];
    
    this.setData({
      'formData.class_id': selectedClass ? selectedClass.class_id : ''
    }, () => {
      this.updateSelectedClassName();
    });
  },

  // 特殊需求开关
  onSpecialNeedChange: function(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    
    this.setData({
      [`formData.special_needs.${field}`]: value
    });
  },

  // 其他需求输入
  onOtherRequirementsInput: function(e) {
    this.setData({
      'formData.special_needs.other_requirements': e.detail.value
    });
  },

  // 验证表单
  validateForm: function() {
    const { name, student_number, class_id } = this.data.formData;
    
    if (!name.trim()) {
      wx.showToast({
        title: '请输入姓名',
        icon: 'none'
      });
      return false;
    }
    
    if (!student_number.trim()) {
      wx.showToast({
        title: '请输入学号',
        icon: 'none'
      });
      return false;
    }
    
    // 学号格式验证
    if (!/^\d{9,12}$/.test(student_number)) {
      wx.showToast({
        title: '学号格式不正确',
        icon: 'none'
      });
      return false;
    }
    
    if (!class_id) {
      wx.showToast({
        title: '请选择班级',
        icon: 'none'
      });
      return false;
    }
    
    return true;
  },

  // 提交表单
  onSubmit: function() {
    if (!this.validateForm()) {
      return;
    }

    const that = this;
    that.setData({ submitting: true });

    wx.cloud.callFunction({
      name: 'seatArrangementFunctions',
      data: {
        type: 'updateStudentProfile',
        token: wx.getStorageSync('token'),
        profile_data: that.data.formData
      },
      success: (res) => {
        console.log('update profile success', res);
        
        if (res.result.success) {
          // 更新本地存储的用户信息
          const updatedUserInfo = {
            ...that.data.userInfo,
            ...res.result.data.userProfile
          };
          wx.setStorageSync('userInfo', updatedUserInfo);
          
          that.setData({
            userInfo: updatedUserInfo,
            submitting: false
          });
          
          wx.showToast({
            title: '保存成功',
            icon: 'success'
          });
          
          // 如果是初始设置，跳转到主页面
          if (that.data.action === 'setup') {
            setTimeout(() => {
              wx.switchTab({
                url: '/pages/seat-selection/seat-selection'
              });
            }, 1500);
          } else {
            that.setData({ action: 'view' });
          }
        } else {
          that.setData({ submitting: false });
          wx.showToast({
            title: res.result.message || '保存失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.error('update profile failed', err);
        that.setData({ submitting: false });
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none'
        });
      }
    });
  },

  // 编辑模式
  onEdit: function() {
    this.setData({ action: 'edit' });
  },

  // 取消编辑
  onCancel: function() {
    this.loadUserInfo(); // 重新加载数据
    this.setData({ action: 'view' });
  },

  // 导航到管理员登录
  onAdminLogin: function() {
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
          
          // 跳转到登录页面
          wx.redirectTo({
            url: '/pages/login/login'
          });
        }
      }
    });
  }
});