/**
 * 管理员认证工具模块
 * 提供管理员登录状态检查、权限验证、会话管理等功能
 */

class AdminAuthManager {
  constructor() {
    this.TOKEN_KEY = 'adminToken';
    this.INFO_KEY = 'adminInfo';
    this.EXPIRY_KEY = 'adminTokenExpiry';
  }

  /**
   * 检查管理员是否已登录
   * @returns {boolean} 是否已登录
   */
  isLoggedIn() {
    const token = this.getToken();
    const expiry = wx.getStorageSync(this.EXPIRY_KEY);
    
    if (!token || !expiry) {
      return false;
    }
    
    // 检查token是否过期
    if (Date.now() > expiry) {
      this.logout();
      return false;
    }
    
    return true;
  }

  /**
   * 获取管理员token
   * @returns {string|null} token
   */
  getToken() {
    try {
      return wx.getStorageSync(this.TOKEN_KEY);
    } catch (error) {
      console.error('获取管理员token失败:', error);
      return null;
    }
  }

  /**
   * 获取管理员信息
   * @returns {Object|null} 管理员信息
   */
  getAdminInfo() {
    try {
      return wx.getStorageSync(this.INFO_KEY);
    } catch (error) {
      console.error('获取管理员信息失败:', error);
      return null;
    }
  }

  /**
   * 保存登录信息
   * @param {string} token JWT token
   * @param {Object} adminInfo 管理员信息
   * @param {number} expiresIn 过期时间（秒）
   */
  saveLoginInfo(token, adminInfo, expiresIn) {
    try {
      const expiryTime = Date.now() + (expiresIn * 1000);
      
      wx.setStorageSync(this.TOKEN_KEY, token);
      wx.setStorageSync(this.INFO_KEY, adminInfo);
      wx.setStorageSync(this.EXPIRY_KEY, expiryTime);
      
      console.log('管理员登录信息保存成功');
    } catch (error) {
      console.error('保存管理员登录信息失败:', error);
    }
  }

  /**
   * 检查管理员权限
   * @param {string|Array} requiredRoles 需要的角色
   * @returns {boolean} 是否有权限
   */
  hasPermission(requiredRoles) {
    const adminInfo = this.getAdminInfo();
    if (!adminInfo || !adminInfo.role) {
      return false;
    }

    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    return roles.includes(adminInfo.role);
  }

  /**
   * 检查管理员对特定班级的权限
   * @param {string} classId 班级ID
   * @returns {boolean} 是否有权限
   */
  hasClassPermission(classId) {
    const adminInfo = this.getAdminInfo();
    if (!adminInfo) {
      return false;
    }

    // 排座负责人有所有班级权限
    if (adminInfo.role === 'seat_manager') {
      return true;
    }

    // 普通管理员只能管理指定班级
    return adminInfo.class_ids && adminInfo.class_ids.includes(classId);
  }

  /**
   * 检查功能权限
   * @param {string} functionName 功能名称
   * @returns {boolean} 是否有权限
   */
  hasFunctionPermission(functionName) {
    const adminInfo = this.getAdminInfo();
    if (!adminInfo) {
      return false;
    }

    // 功能权限映射
    const functionPermissions = {
      'createSession': ['seat_manager'],
      'executeArrangement': ['seat_manager'],
      'manualAdjustSeat': ['admin', 'seat_manager'],
      'importStudents': ['admin', 'seat_manager'],
      'viewStatistics': ['admin', 'seat_manager'],
      'manageUsers': ['seat_manager'],
      'viewResults': ['admin', 'seat_manager'],
      'exportData': ['admin', 'seat_manager'],
      'submitWish': ['admin', 'seat_manager'] // 管理员也可以填写意愿
    };

    const allowedRoles = functionPermissions[functionName];
    return allowedRoles && allowedRoles.includes(adminInfo.role);
  }

  /**
   * 检查token是否即将过期（30分钟内）
   * @returns {boolean} 是否即将过期
   */
  isTokenExpiringSoon() {
    const expiry = wx.getStorageSync(this.EXPIRY_KEY);
    if (!expiry) {
      return true;
    }

    const thirtyMinutes = 30 * 60 * 1000;
    return (expiry - Date.now()) < thirtyMinutes;
  }

  /**
   * 刷新token
   * @returns {Promise<boolean>} 是否刷新成功
   */
  async refreshToken() {
    const currentToken = this.getToken();
    if (!currentToken) {
      return false;
    }

    try {
      const result = await wx.cloud.callFunction({
        name: 'seatArrangementFunctions',
        data: {
          type: 'refreshToken',
          refreshToken: currentToken
        }
      });

      if (result.result && result.result.success) {
        const { token, expiresIn } = result.result.data;
        const adminInfo = this.getAdminInfo();
        
        this.saveLoginInfo(token, adminInfo, expiresIn);
        return true;
      }
    } catch (error) {
      console.error('刷新token失败:', error);
    }

    return false;
  }

  /**
   * 登出
   */
  logout() {
    try {
      wx.removeStorageSync(this.TOKEN_KEY);
      wx.removeStorageSync(this.INFO_KEY);
      wx.removeStorageSync(this.EXPIRY_KEY);
      console.log('管理员登出成功');
    } catch (error) {
      console.error('登出失败:', error);
    }
  }

  /**
   * 验证并跳转到登录页（如果未登录）
   * @param {string} currentPage 当前页面路径
   * @returns {boolean} 是否需要跳转
   */
  requireLogin(currentPage) {
    if (!this.isLoggedIn()) {
      wx.showModal({
        title: '登录过期',
        content: '管理员登录已过期，请重新登录',
        showCancel: false,
        confirmText: '前往登录',
        success: () => {
          wx.redirectTo({
            url: '/pages/admin-login/admin-login'
          });
        }
      });
      return true;
    }

    // 检查token是否即将过期，自动刷新
    if (this.isTokenExpiringSoon()) {
      this.refreshToken().catch(error => {
        console.warn('自动刷新token失败:', error);
      });
    }

    return false;
  }

  /**
   * 验证页面权限
   * @param {string} pageName 页面名称
   * @returns {boolean} 是否有权限访问
   */
  checkPagePermission(pageName) {
    const adminInfo = this.getAdminInfo();
    if (!adminInfo) {
      return false;
    }

    // 页面权限映射
    const pagePermissions = {
      'admin-dashboard': ['admin', 'seat_manager'],
      'admin-wish': ['admin', 'seat_manager'],
      'session-management': ['seat_manager'],
      'student-management': ['admin', 'seat_manager'],
      'classroom-management': ['seat_manager'],
      'execute-arrangement': ['seat_manager'],
      'admin-results': ['admin', 'seat_manager'],
      'system-settings': ['seat_manager']
    };

    const allowedRoles = pagePermissions[pageName];
    if (!allowedRoles) {
      return true; // 未定义权限的页面默认允许
    }

    return allowedRoles.includes(adminInfo.role);
  }

  /**
   * 获取管理员角色显示文本
   * @param {string} role 角色代码
   * @returns {string} 角色显示文本
   */
  getRoleText(role) {
    const roleMap = {
      'admin': '普通管理员',
      'seat_manager': '排座负责人'
    };
    return roleMap[role] || '未知角色';
  }

  /**
   * 检查管理员是否为排座负责人
   * @returns {boolean} 是否为排座负责人
   */
  isSeatManager() {
    const adminInfo = this.getAdminInfo();
    return adminInfo && adminInfo.role === 'seat_manager';
  }

  /**
   * 获取管理员可访问的班级列表
   * @returns {Array} 班级ID列表
   */
  getAccessibleClasses() {
    const adminInfo = this.getAdminInfo();
    if (!adminInfo) {
      return [];
    }

    return adminInfo.class_ids || [];
  }

  /**
   * 创建带认证的云函数调用
   * @param {Object} options 云函数调用参数
   * @returns {Promise} 云函数调用结果
   */
  async callCloudFunction(options) {
    const token = this.getToken();
    if (!token) {
      throw new Error('管理员未登录');
    }

    // 在数据中添加token
    const dataWithToken = {
      ...options.data,
      token: token
    };

    return await wx.cloud.callFunction({
      ...options,
      data: dataWithToken
    });
  }
}

// 创建全局实例
const adminAuth = new AdminAuthManager();

module.exports = {
  AdminAuthManager,
  adminAuth
};