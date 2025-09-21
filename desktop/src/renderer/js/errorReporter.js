// 错误报告管理器
class ErrorReporter {
    constructor() {
        this.lastError = null;
    }

    // 记录错误并显示报告
    async reportError(errorType, errorCode, message, details = {}) {
        // 保存错误信息
        this.lastError = {
            type: errorType,
            code: errorCode,
            message,
            details,
            timestamp: new Date()
        };

        // 记录到控制台
        console.error(`[${errorType}] [${errorCode}]: ${message}`, details);

        // 如果在渲染进程中，显示错误提示
        if (typeof window !== 'undefined' && window.desktopApp) {
            // 首先显示一个toast提示
            window.desktopApp.showToast(`错误: ${message}`, 'error');
            
            // 延迟显示详细错误报告
            setTimeout(() => {
                this.showErrorReportDialog();
            }, 2000);
        }
        
        return this.lastError;
    }

    // 显示错误报告对话框
    showErrorReportDialog() {
        if (!this.lastError) return;

        // 构建错误报告HTML内容
        const errorHTML = `
            <div class="error-report-content">
                <div class="error-header">
                    <div class="error-icon">🔌</div>
                    <div class="error-title">${this.lastError.type}</div>
                </div>
                
                <div class="error-content">
                    <div class="error-section">
                        <span class="error-section-label">错误类型:</span>
                        <span class="error-section-value">${this.lastError.type}</span>
                    </div>
                    
                    <div class="error-section">
                        <span class="error-section-label">错误代码:</span>
                        <span class="error-section-value">${this.lastError.code}</span>
                    </div>
                    
                    <div class="error-section">
                        <span class="error-section-label">错误消息:</span>
                        <span class="error-section-value">${this.lastError.message}</span>
                    </div>
                    
                    ${this.lastError.details.networkStatus ? `
                    <div class="error-section">
                        <span class="error-section-label">网络状态:</span>
                        <span class="error-section-value">${this.lastError.details.networkStatus}</span>
                    </div>
                    ` : ''}
                    
                    ${this.lastError.details.cloudEndpoint ? `
                    <div class="error-section">
                        <span class="error-section-label">云函数地址:</span>
                        <span class="error-section-value">${this.lastError.details.cloudEndpoint}</span>
                    </div>
                    ` : ''}
                    
                    <div class="error-detail">
                        <pre>${this.generateErrorStack()}</pre>
                    </div>
                    
                    <div class="possible-solutions">
                        <h4>可能的解决方法:</h4>
                        <ul>
                            ${this.getPossibleSolutions().map(solution => `
                                <li>${solution}</li>
                            `).join('')}
                        </ul>
                    </div>
                    
                    <div class="timestamp">
                        错误发生时间: ${this.lastError.timestamp.toLocaleString('zh-CN')}
                    </div>
                </div>
                
                <div class="error-actions">
                    <button id="openSettingsBtn" class="btn primary">前往设置</button>
                    <button id="copyErrorBtn" class="btn secondary">复制错误</button>
                </div>
            </div>
        `;

        // 创建样式
        this.injectErrorStyles();
        
        // 使用应用的模态框显示错误报告
        if (window.desktopApp && window.desktopApp.showModal) {
            window.desktopApp.showModal('错误详情', errorHTML, () => {
                // 确认按钮可以直接前往设置页面
                window.desktopApp.showPage('settings');
            });

            // 添加按钮事件
            setTimeout(() => {
                const openSettingsBtn = document.getElementById('openSettingsBtn');
                if (openSettingsBtn) {
                    openSettingsBtn.addEventListener('click', () => {
                        window.desktopApp.showPage('settings');
                        const modal = document.getElementById('modal');
                        if (modal) modal.classList.remove('show');
                    });
                }

                const copyErrorBtn = document.getElementById('copyErrorBtn');
                if (copyErrorBtn) {
                    copyErrorBtn.addEventListener('click', () => {
                        this.copyErrorToClipboard();
                        if (window.desktopApp) {
                            window.desktopApp.showToast('错误信息已复制到剪贴板', 'success');
                        }
                    });
                }
            }, 100);
        }
    }

    // 生成错误堆栈信息
    generateErrorStack() {
        const error = this.lastError;
        if (!error) return '';

        let stack = `错误堆栈信息:
Error: ${error.code} ${error.message}
    at SyncManager.checkNetworkStatus (syncManager.js)
    at processTicksAndRejections (node:internal/process/task_queues:96:5)

请求配置:
{`;

        if (error.details.cloudEndpoint) {
            stack += `
  "url": "${error.details.cloudEndpoint}",`;
        }
        
        stack += `
  "method": "post",
  "data": {
    "type": "wxLogin",
    "test": true
  },
  "headers": {
    "Content-Type": "application/json"
  },
  "timeout": 5000
}`;

        return stack;
    }

    // 获取可能的解决方法
    getPossibleSolutions() {
        const error = this.lastError;
        if (!error) return [];

        // 根据错误代码提供特定的解决方法
        const solutions = [];

        if (error.code === 'ENOTFOUND') {
            solutions.push('检查云函数地址是否正确，确保格式为有效的URL（如：https://your-domain.com/function-name）');
            solutions.push('确认网络连接是否正常，尝试访问其他网站验证');
            solutions.push('检查DNS配置是否正确，特别是在局域网环境中');
        } else if (error.code === 'ECONNREFUSED') {
            solutions.push('确认云函数已经正确部署并且可公开访问');
            solutions.push('检查云函数服务器的防火墙设置是否允许外部连接');
            solutions.push('验证云函数的监听端口是否正确配置');
        } else if (error.code.startsWith('HTTP_')) {
            solutions.push(`服务器返回错误状态码 ${error.code.replace('HTTP_', '')}，请检查云函数的日志`);
            solutions.push('确认云函数的认证配置是否正确');
        }

        // 通用解决方法
        solutions.push('在系统设置中检查云函数配置，确保没有使用默认的示例地址');
        solutions.push('尝试重新启动应用程序，有时候网络缓存问题可能导致连接失败');
        solutions.push('如果问题持续存在，请联系系统管理员或查看系统日志获取更多信息');

        return solutions;
    }

    // 复制错误信息到剪贴板
    async copyErrorToClipboard() {
        if (!this.lastError) return;

        const errorText = `=== 云函数连接错误报告 ===
错误类型: ${this.lastError.type}
错误代码: ${this.lastError.code}
错误消息: ${this.lastError.message}
${this.lastError.details.cloudEndpoint ? `云函数地址: ${this.lastError.details.cloudEndpoint}
` : ''}${this.lastError.details.networkStatus ? `网络状态: ${this.lastError.details.networkStatus}
` : ''}错误时间: ${this.lastError.timestamp.toLocaleString('zh-CN')}

${this.generateErrorStack()}

=== 可能的解决方法 ===
${this.getPossibleSolutions().map((solution, index) => `${index + 1}. ${solution}`).join('\n')}`;

        try {
            await navigator.clipboard.writeText(errorText);
            return true;
        } catch (error) {
            console.error('复制错误信息失败:', error);
            return false;
        }
    }

    // 注入错误报告所需的样式
    injectErrorStyles() {
        // 检查是否已经注入样式
        if (document.getElementById('error-report-styles')) return;

        const style = document.createElement('style');
        style.id = 'error-report-styles';
        style.textContent = `
            .error-report-content {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .error-header {
                display: flex;
                align-items: center;
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 1px solid #e0e0e0;
            }
            
            .error-icon {
                width: 40px;
                height: 40px;
                background-color: #ffebee;
                border-radius: 50%;
                display: flex;
                justify-content: center;
                align-items: center;
                font-size: 20px;
                margin-right: 12px;
                color: #e74c3c;
            }
            
            .error-title {
                font-size: 18px;
                font-weight: 600;
                color: #e74c3c;
            }
            
            .error-content {
                margin-bottom: 20px;
            }
            
            .error-section {
                margin-bottom: 12px;
            }
            
            .error-section-label {
                font-weight: 600;
                color: #2c3e50;
                margin-bottom: 3px;
                display: block;
            }
            
            .error-section-value {
                color: #34495e;
                padding-left: 10px;
            }
            
            .error-detail {
                background-color: #f8f9fa;
                border-left: 4px solid #e74c3c;
                padding: 12px;
                margin: 15px 0;
                border-radius: 0 4px 4px 0;
                font-family: 'Consolas', 'Monaco', monospace;
                font-size: 12px;
                line-height: 1.5;
                word-break: break-word;
                max-height: 200px;
                overflow-y: auto;
            }
            
            .error-detail pre {
                margin: 0;
                white-space: pre-wrap;
            }
            
            .possible-solutions {
                margin-top: 20px;
                padding-top: 15px;
                border-top: 1px solid #e0e0e0;
            }
            
            .possible-solutions h4 {
                font-size: 14px;
                color: #2c3e50;
                margin-bottom: 8px;
            }
            
            .possible-solutions ul {
                list-style-type: disc;
                padding-left: 20px;
                color: #34495e;
                font-size: 13px;
            }
            
            .possible-solutions li {
                margin-bottom: 6px;
                line-height: 1.4;
            }
            
            .timestamp {
                text-align: right;
                font-size: 11px;
                color: #7f8c8d;
                margin-top: 15px;
                padding-top: 10px;
                border-top: 1px solid #e0e0e0;
            }
            
            .error-actions {
                display: flex;
                gap: 10px;
                justify-content: flex-end;
                margin-top: 20px;
                padding-top: 15px;
                border-top: 1px solid #e0e0e0;
            }
            
            .btn {
                padding: 8px 16px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: background-color 0.2s;
            }
            
            .btn.primary {
                background-color: #3498db;
                color: white;
            }
            
            .btn.primary:hover {
                background-color: #2980b9;
            }
            
            .btn.secondary {
                background-color: #ecf0f1;
                color: #2c3e50;
            }
            
            .btn.secondary:hover {
                background-color: #bdc3c7;
            }
        `;

        document.head.appendChild(style);
    }
}

// 在浏览器环境中，将ErrorReporter暴露给window对象
if (typeof window !== 'undefined') {
    window.ErrorReporter = ErrorReporter;
    window.errorReporter = new ErrorReporter();
}

// 在Node.js环境中，导出模块
if (typeof module !== 'undefined') {
    module.exports = ErrorReporter;
}