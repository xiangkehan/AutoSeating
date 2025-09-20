// pages/system-config/system-config.js
const AdminAuthManager = require('../../utils/adminAuth');
const adminAuth = new AdminAuthManager();

Page({
  data: {
    configs: {},
    configCategories: [
      { key: 'algorithm', name: '算法配置', icon: '⚙️' },
      { key: 'session', name: '会话配置', icon: '📅' },
      { key: 'security', name: '安全配置', icon: '🔒' },
      { key: 'system', name: '系统配置', icon: '💻' }
    ],
    activeCategory: 'algorithm',
    loading: false,
    saveLoading: false,
    
    // 编辑状态
    editingConfig: null,
    editValue: '',
    showEditModal: false,
    
    // 历史记录
    showHistory: false,
    configHistory: [],
    historyLoading: false,
    
    // 导入导出
    showImportExport: false,
    exportData: null
  },

  onLoad() {
    this.checkAuth();
    this.loadSystemConfig();
  },

  async checkAuth() {
    if (!adminAuth.isLoggedIn()) {
      wx.showModal({
        title: '提示',
        content: '请先登录管理员账号',
        showCancel: false,
        success: () => {
          wx.redirectTo({
            url: '/pages/admin-login/admin-login'
          });
        }
      });
      return;
    }

    const userInfo = adminAuth.getUserInfo();
    if (!['admin', 'super_admin'].includes(userInfo.role)) {
      wx.showModal({
        title: '权限不足',
        content: '只有管理员可以管理系统配置',
        showCancel: false,
        success: () => {
          wx.navigateBack();
        }
      });
    }
  },

  async loadSystemConfig() {
    if (this.data.loading) return;
    
    this.setData({ loading: true });
    
    try {
      const token = adminAuth.getToken();
      
      const result = await wx.cloud.callFunction({
        name: 'seatArrangementFunctions',
        data: {
          type: 'getSystemConfig',
          token
        }
      });

      if (result.result.success) {
        this.setData({
          configs: result.result.data.config_by_category
        });
      } else {
        wx.showToast({
          title: result.result.message || '加载失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('加载系统配置失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  switchCategory(e) {
    const { category } = e.currentTarget.dataset;
    this.setData({ activeCategory: category });
  },

  editConfig(e) {
    const { config } = e.currentTarget.dataset;
    
    this.setData({
      editingConfig: config,
      editValue: this.formatEditValue(config.value, config.value_type),
      showEditModal: true
    });
  },

  formatEditValue(value, valueType) {
    if (valueType === 'json' || valueType === 'array') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  },

  parseEditValue(value, valueType) {
    try {
      switch (valueType) {
        case 'number':
          const num = parseFloat(value);
          if (isNaN(num)) throw new Error('无效的数字');
          return num;
        
        case 'boolean':
          if (value === 'true' || value === true) return true;
          if (value === 'false' || value === false) return false;
          throw new Error('无效的布尔值');
        
        case 'json':
        case 'array':
          return JSON.parse(value);
        
        case 'string':
        default:
          return String(value);
      }
    } catch (error) {
      throw new Error(`解析值失败: ${error.message}`);
    }
  },

  onEditValueChange(e) {
    this.setData({ editValue: e.detail.value });
  },

  async saveConfig() {
    if (this.data.saveLoading) return;
    
    const { editingConfig, editValue } = this.data;
    
    if (!editingConfig) return;
    
    try {
      // 解析并验证值
      const parsedValue = this.parseEditValue(editValue, editingConfig.value_type);
      
      this.setData({ saveLoading: true });
      
      const token = adminAuth.getToken();
      
      const result = await wx.cloud.callFunction({
        name: 'seatArrangementFunctions',
        data: {
          type: 'updateSystemConfig',
          token,
          config_id: editingConfig.config_id,
          value: parsedValue
        }
      });

      if (result.result.success) {
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });
        
        this.setData({ showEditModal: false });
        this.loadSystemConfig();
      } else {
        wx.showToast({
          title: result.result.message || '保存失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('保存配置失败:', error);
      wx.showToast({
        title: error.message || '保存失败',
        icon: 'none'
      });
    } finally {
      this.setData({ saveLoading: false });
    }
  },

  cancelEdit() {
    this.setData({
      showEditModal: false,
      editingConfig: null,
      editValue: ''
    });
  },

  async viewHistory(e) {
    const { config } = e.currentTarget.dataset;
    
    this.setData({ 
      historyLoading: true,
      showHistory: true
    });
    
    try {
      const token = adminAuth.getToken();
      
      const result = await wx.cloud.callFunction({
        name: 'seatArrangementFunctions',
        data: {
          type: 'getConfigHistory',
          token,
          config_id: config.config_id,
          limit: 10
        }
      });

      if (result.result.success) {
        this.setData({
          configHistory: result.result.data.history
        });
      } else {
        wx.showToast({
          title: result.result.message || '加载历史失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('加载配置历史失败:', error);
      wx.showToast({
        title: '加载历史失败',
        icon: 'none'
      });
    } finally {
      this.setData({ historyLoading: false });
    }
  },

  closeHistory() {
    this.setData({ 
      showHistory: false,
      configHistory: []
    });
  },

  async exportConfig() {
    try {
      const token = adminAuth.getToken();
      
      const result = await wx.cloud.callFunction({
        name: 'seatArrangementFunctions',
        data: {
          type: 'exportConfig',
          token
        }
      });

      if (result.result.success) {
        this.setData({
          exportData: JSON.stringify(result.result.data, null, 2),
          showImportExport: true
        });
      } else {
        wx.showToast({
          title: result.result.message || '导出失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('导出配置失败:', error);
      wx.showToast({
        title: '导出失败',
        icon: 'none'
      });
    }
  },

  copyExportData() {
    wx.setClipboardData({
      data: this.data.exportData,
      success: () => {
        wx.showToast({
          title: '已复制到剪贴板',
          icon: 'success'
        });
      }
    });
  },

  closeImportExport() {
    this.setData({ 
      showImportExport: false,
      exportData: null
    });
  },

  async initConfig() {
    wx.showModal({
      title: '确认初始化',
      content: '这将重置所有配置为默认值，确定继续吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const token = adminAuth.getToken();
            
            const result = await wx.cloud.callFunction({
              name: 'seatArrangementFunctions',
              data: {
                type: 'initSystemConfig',
                token
              }
            });

            if (result.result.success) {
              wx.showToast({
                title: '初始化成功',
                icon: 'success'
              });
              
              this.loadSystemConfig();
            } else {
              wx.showToast({
                title: result.result.message || '初始化失败',
                icon: 'none'
              });
            }
          } catch (error) {
            console.error('初始化配置失败:', error);
            wx.showToast({
              title: '初始化失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  formatValue(value, valueType) {
    if (value === null || value === undefined) {
      return '未设置';
    }
    
    switch (valueType) {
      case 'boolean':
        return value ? '是' : '否';
      
      case 'json':
      case 'array':
        return JSON.stringify(value);
      
      default:
        return String(value);
    }
  },

  formatDate(timestamp) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  },

  onPullDownRefresh() {
    this.loadSystemConfig();
    wx.stopPullDownRefresh();
  }
});", "file_path": "c:\\Users\\xjh20\\WeChatProjects\\miniprogram-2\\miniprogram\\pages\\system-config\\system-config.js"}]