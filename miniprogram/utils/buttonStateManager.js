/**
 * 按钮交互状态管理器
 * 统一管理按钮的各种状态变化和用户反馈
 */

class ButtonStateManager {
  constructor(page) {
    this.page = page;
    this.buttonStates = {};
    this.loadingTasks = new Set();
    this.defaultConfig = {
      loadingText: '处理中...',
      successText: '操作成功',
      errorTimeout: 3000,
      successTimeout: 2000,
      preventDoubleClick: true
    };
  }

  /**
   * 初始化按钮状态
   * @param {string} buttonId 按钮唯一标识
   * @param {Object} config 按钮配置
   */
  initButton(buttonId, config = {}) {
    this.buttonStates[buttonId] = {
      loading: false,
      disabled: false,
      text: config.text || '确认',
      originalText: config.text || '确认',
      type: config.type || 'primary',
      lastClickTime: 0,
      ...config
    };
    
    this.updateButtonData(buttonId);
  }

  /**
   * 设置按钮为加载状态
   * @param {string} buttonId 按钮ID
   * @param {string} loadingText 加载时显示的文字
   */
  setLoading(buttonId, loadingText) {
    if (!this.buttonStates[buttonId]) {
      this.initButton(buttonId);
    }

    const config = { ...this.defaultConfig, ...this.buttonStates[buttonId] };
    
    this.buttonStates[buttonId] = {
      ...this.buttonStates[buttonId],
      loading: true,
      disabled: true,
      text: loadingText || config.loadingText
    };

    this.loadingTasks.add(buttonId);
    this.updateButtonData(buttonId);
    
    // 显示全局加载提示
    wx.showLoading({
      title: loadingText || config.loadingText,
      mask: true
    });
  }

  /**
   * 设置按钮为成功状态
   * @param {string} buttonId 按钮ID
   * @param {string} successText 成功时显示的文字
   * @param {number} duration 成功状态持续时间
   */
  setSuccess(buttonId, successText, duration) {
    if (!this.buttonStates[buttonId]) return;

    const config = { ...this.defaultConfig, ...this.buttonStates[buttonId] };
    
    // 隐藏全局加载提示
    wx.hideLoading();
    this.loadingTasks.delete(buttonId);

    // 设置成功状态
    this.buttonStates[buttonId] = {
      ...this.buttonStates[buttonId],
      loading: false,
      disabled: true,
      text: successText || config.successText,
      type: 'success'
    };

    this.updateButtonData(buttonId);

    // 显示成功提示
    if (successText) {
      wx.showToast({
        title: successText || config.successText,
        icon: 'success',
        duration: duration || config.successTimeout
      });
    }

    // 延迟恢复到默认状态
    setTimeout(() => {
      this.resetButton(buttonId);
    }, duration || config.successTimeout);
  }

  /**
   * 设置按钮为错误状态
   * @param {string} buttonId 按钮ID
   * @param {string} errorText 错误提示文字
   * @param {Object} errorOptions 错误处理选项
   */
  setError(buttonId, errorText, errorOptions = {}) {
    if (!this.buttonStates[buttonId]) return;

    const config = { ...this.defaultConfig, ...this.buttonStates[buttonId] };
    
    // 隐藏全局加载提示
    wx.hideLoading();
    this.loadingTasks.delete(buttonId);

    // 设置错误状态
    this.buttonStates[buttonId] = {
      ...this.buttonStates[buttonId],
      loading: false,
      disabled: false,
      text: this.buttonStates[buttonId].originalText,
      type: 'error'
    };

    this.updateButtonData(buttonId);

    // 显示错误提示
    if (errorOptions.useModal) {
      wx.showModal({
        title: errorOptions.title || '操作失败',
        content: errorText,
        showCancel: errorOptions.showRetry || false,
        confirmText: errorOptions.confirmText || '确定',
        cancelText: errorOptions.cancelText || '重试',
        success: (res) => {
          if (res.cancel && errorOptions.onRetry) {
            errorOptions.onRetry();
          }
        }
      });
    } else {
      wx.showToast({
        title: errorText,
        icon: 'none',
        duration: config.errorTimeout
      });
    }

    // 延迟恢复按钮样式
    setTimeout(() => {
      if (this.buttonStates[buttonId]) {
        this.buttonStates[buttonId].type = this.buttonStates[buttonId].originalType || 'primary';
        this.updateButtonData(buttonId);
      }
    }, 1000);
  }

  /**
   * 重置按钮到默认状态
   * @param {string} buttonId 按钮ID
   */
  resetButton(buttonId) {
    if (!this.buttonStates[buttonId]) return;

    this.buttonStates[buttonId] = {
      ...this.buttonStates[buttonId],
      loading: false,
      disabled: false,
      text: this.buttonStates[buttonId].originalText,
      type: this.buttonStates[buttonId].originalType || 'primary'
    };

    this.loadingTasks.delete(buttonId);
    this.updateButtonData(buttonId);
  }

  /**
   * 检查是否可以点击按钮（防重复点击）
   * @param {string} buttonId 按钮ID
   * @param {number} interval 防重复点击间隔（毫秒）
   * @returns {boolean} 是否可以点击
   */
  canClick(buttonId, interval = 1000) {
    if (!this.buttonStates[buttonId]) {
      this.initButton(buttonId);
    }

    const now = Date.now();
    const lastClick = this.buttonStates[buttonId].lastClickTime;
    
    if (this.buttonStates[buttonId].loading || this.buttonStates[buttonId].disabled) {
      return false;
    }

    if (now - lastClick < interval) {
      wx.showToast({
        title: '操作过于频繁',
        icon: 'none',
        duration: 1000
      });
      return false;
    }

    this.buttonStates[buttonId].lastClickTime = now;
    return true;
  }

  /**
   * 更新页面数据
   * @param {string} buttonId 按钮ID
   */
  updateButtonData(buttonId) {
    if (!this.page || !this.page.setData) return;

    const updateData = {};
    updateData[`buttonStates.${buttonId}`] = this.buttonStates[buttonId];
    
    this.page.setData(updateData);
  }

  /**
   * 批量更新多个按钮状态
   * @param {Object} updates 更新对象，key为buttonId，value为状态
   */
  batchUpdate(updates) {
    const updateData = {};
    
    Object.keys(updates).forEach(buttonId => {
      if (this.buttonStates[buttonId]) {
        this.buttonStates[buttonId] = {
          ...this.buttonStates[buttonId],
          ...updates[buttonId]
        };
        updateData[`buttonStates.${buttonId}`] = this.buttonStates[buttonId];
      }
    });

    if (this.page && this.page.setData) {
      this.page.setData(updateData);
    }
  }

  /**
   * 禁用按钮
   * @param {string} buttonId 按钮ID
   * @param {string} reason 禁用原因
   */
  disableButton(buttonId, reason) {
    if (!this.buttonStates[buttonId]) return;

    this.buttonStates[buttonId].disabled = true;
    this.buttonStates[buttonId].disableReason = reason;
    this.updateButtonData(buttonId);
  }

  /**
   * 启用按钮
   * @param {string} buttonId 按钮ID
   */
  enableButton(buttonId) {
    if (!this.buttonStates[buttonId]) return;

    this.buttonStates[buttonId].disabled = false;
    delete this.buttonStates[buttonId].disableReason;
    this.updateButtonData(buttonId);
  }

  /**
   * 执行异步操作的通用方法
   * @param {string} buttonId 按钮ID
   * @param {Function} asyncFunction 异步函数
   * @param {Object} options 配置选项
   */
  async executeAsync(buttonId, asyncFunction, options = {}) {
    const config = { ...this.defaultConfig, ...options };

    // 检查是否可以点击
    if (!this.canClick(buttonId, config.clickInterval)) {
      return;
    }

    // 设置加载状态
    this.setLoading(buttonId, config.loadingText);

    try {
      const result = await asyncFunction();
      
      // 操作成功
      this.setSuccess(buttonId, config.successText, config.successTimeout, config.hideSuccess);
      
      // 执行成功回调
      if (config.onSuccess) {
        config.onSuccess(result);
      }

      return result;
    } catch (error) {
      console.error(`按钮 ${buttonId} 异步操作失败:`, error);
      
      // 处理错误
      const errorMessage = this.getErrorMessage(error, config);
      this.setError(buttonId, errorMessage, {
        useModal: config.useErrorModal,
        title: config.errorTitle,
        showRetry: config.showRetry,
        onRetry: () => this.executeAsync(buttonId, asyncFunction, options)
      });

      // 执行错误回调
      if (config.onError) {
        config.onError(error);
      }

      throw error;
    }
  }

  /**
   * 获取错误消息
   * @param {Error} error 错误对象
   * @param {Object} config 配置
   * @returns {string} 错误消息
   */
  getErrorMessage(error, config) {
    if (config.customErrorMessage) {
      return config.customErrorMessage;
    }

    // 云函数错误处理
    if (error.result && error.result.message) {
      return error.result.message;
    }

    // 网络错误处理
    if (error.errCode === -502005) {
      return '网络连接失败，请检查网络后重试';
    }

    if (error.errMsg) {
      if (error.errMsg.includes('cloud function')) {
        return '服务调用失败，请稍后重试';
      }
      if (error.errMsg.includes('timeout')) {
        return '请求超时，请重试';
      }
    }

    return '操作失败，请重试';
  }

  /**
   * 清理所有状态
   */
  cleanup() {
    // 隐藏所有加载提示
    wx.hideLoading();
    
    // 清理所有任务
    this.loadingTasks.clear();
    
    // 重置所有按钮状态
    Object.keys(this.buttonStates).forEach(buttonId => {
      this.resetButton(buttonId);
    });
  }

  /**
   * 获取按钮状态
   * @param {string} buttonId 按钮ID
   * @returns {Object} 按钮状态
   */
  getButtonState(buttonId) {
    return this.buttonStates[buttonId] || null;
  }

  /**
   * 是否有正在执行的任务
   * @returns {boolean}
   */
  hasLoadingTasks() {
    return this.loadingTasks.size > 0;
  }
}

/**
 * 创建按钮状态管理器实例
 * @param {Object} page 页面实例
 * @returns {ButtonStateManager}
 */
function createButtonStateManager(page) {
  return new ButtonStateManager(page);
}

module.exports = {
  ButtonStateManager,
  createButtonStateManager
};