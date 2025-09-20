// 管理员登录页面逻辑
const { createButtonStateManager } = require('../../utils/buttonStateManager');
const { adminAuth } = require('../../utils/adminAuth');

Page({
  data: {
    username: '',
    password: '',
    buttonStates: {}
  },

  onLoad() {
    wx.setNavigationBarTitle({
      title: '管理员登录'
    });
    
    // 检查是否已登录
    if (adminAuth.isLoggedIn()) {
      wx.redirectTo({
        url: '/pages/admin-dashboard/admin-dashboard'
      });
      return;
    }
    
    // 初始化按钮状态管理器
    this.buttonManager = createButtonStateManager(this);
    
    // 初始化按钮状态
    this.buttonManager.initButton('loginBtn', {
      text: '登录',
      type: 'primary',
      loadingText: '登录中...',
      successText: '登录成功'
    });
    
    this.buttonManager.initButton('initBtn', {
      text: '初始化数据库',
      type: 'secondary',
      loadingText: '初始化中...',
      successText: '初始化成功'
    });
  },

  onUnload() {
    // 页面销毁时清理资源
    if (this.buttonManager) {
      this.buttonManager.cleanup();
    }
  },

  // 输入用户名
  onUsernameInput(e) {
    this.setData({
      username: e.detail.value
    });
  },

  // 输入密码
  onPasswordInput(e) {
    this.setData({
      password: e.detail.value
    });
  },

  // 管理员登录
  async onLogin() {
    const { username, password } = this.data;
    
    if (!username || !password) {
      wx.showToast({
        title: '请填写完整信息',
        icon: 'none'
      });
      return;
    }

    // 使用按钮状态管理器执行登录
    await this.buttonManager.executeAsync('loginBtn', async () => {
      const result = await wx.cloud.callFunction({
        name: 'seatArrangementFunctions',
        data: {
          type: 'adminLogin',
          username,
          password
        }
      });

      console.log('登录结果:', result);

      if (result.result && result.result.success) {
        const { token, adminProfile, expiresIn } = result.result.data;
        
        // 使用新的认证管理器保存登录信息
        adminAuth.saveLoginInfo(token, adminProfile, expiresIn);
        
        // 跳转到管理员仪表盘
        setTimeout(() => {
          wx.redirectTo({
            url: '/pages/admin-dashboard/admin-dashboard'
          });
        }, 1500);
        
        return result;
      } else {
        const message = (result.result && result.result.message) || '登录失败';
        throw new Error(message);
      }
    }, {
      successText: '登录成功',
      useErrorModal: true,
      errorTitle: '登录失败',
      onError: (error) => {
        // 特殊错误处理
        if (this.isDBInitError(error)) {
          this.showDBInitPrompt();
        }
      }
    });
  },

  // 返回学生端
  backToStudent() {
    wx.navigateBack();
  },

  // 初始化数据库（根据项目记忆使用 initAdmin 云函数）
  async initDatabase() {
    await this.buttonManager.executeAsync('initBtn', async () => {
      const result = await wx.cloud.callFunction({
        name: 'initAdmin',
        data: {}
      });
      
      console.log('初始化结果:', result);
      
      if (result.result && result.result.success) {
        // 显示初始化成功信息
        wx.showModal({
          title: '初始化成功',
          content: `默认管理员账号已创建：
用户名：admin
密码：admin123

现在可以使用此账号登录。`,
          showCancel: false,
          confirmText: '知道了',
          success: () => {
            // 自动填入默认账号
            this.setData({
              username: 'admin',
              password: 'admin123'
            });
          }
        });
        return result;
      } else {
        const message = (result.result && result.result.message) || '初始化失败';
        if (message.includes('已存在') || message.includes('默认管理员已存在')) {
          // 如果管理员已存在，提示用户直接登录
          wx.showModal({
            title: '系统已初始化',
            content: '数据库已初始化完成，请使用以下默认账号登录：\n\n用户名：admin\n密码：admin123',
            showCancel: false,
            confirmText: '立即登录',
            success: () => {
              this.setData({
                username: 'admin',
                password: 'admin123'
              }, () => {
                // 自动触发登录
                this.onLogin();
              });
            }
          });
          return result;
        } else {
          throw new Error(message);
        }
      }
    }, {
      successText: '初始化完成',
      useErrorModal: true,
      errorTitle: '初始化失败',
      showRetry: true
    });
  },
  
  // 检查是否为数据库初始化错误
  isDBInitError(error) {
    if (error.result && error.result.message) {
      const message = error.result.message;
      return message.includes('collection not exists') || message.includes('502005');
    }
    
    return error.errCode === -502005 || (error.errMsg && error.errMsg.includes('collection not exists'));
  },
  
  // 显示数据库初始化提示
  showDBInitPrompt() {
    wx.showModal({
      title: '数据库未初始化',
      content: '检测到系统首次部署，需要初始化数据库。是否现在初始化？',
      confirmText: '初始化',
      cancelText: '取消',
      success: (modalRes) => {
        if (modalRes.confirm) {
          this.initDatabase();
        }
      }
    });
  }
});