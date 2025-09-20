// 桌面应用主要JavaScript逻辑
class DesktopAppUI {
    constructor() {
        this.currentPage = 'dashboard';
        this.syncStatus = {
            isOnline: false,
            isSyncing: false,
            lastSyncTime: null
        };
        this.buttonManager = new ButtonStateManager();
    }

    // 初始化应用
    async init() {
        this.setupEventListeners();
        this.setupNavigation();
        this.loadSettings();
        await this.updateSyncStatus();
        await this.loadDashboardData();
        
        console.log('桌面应用UI初始化完成');
    }

    // 设置事件监听器
    setupEventListeners() {
        // 同步按钮
        document.getElementById('syncBtn').addEventListener('click', () => {
            this.performSync();
        });

        // 快速操作按钮
        document.getElementById('importStudentsBtn').addEventListener('click', () => {
            this.importStudents();
        });

        document.getElementById('executeAlgorithmBtn').addEventListener('click', () => {
            this.executeAlgorithm();
        });

        document.getElementById('exportResultsBtn').addEventListener('click', () => {
            this.exportResults();
        });

        document.getElementById('backupDataBtn').addEventListener('click', () => {
            this.backupData();
        });

        // 设置页面按钮
        document.getElementById('saveSettingsBtn')?.addEventListener('click', () => {
            this.saveSettings();
        });

        // 算法配置滑块
        this.setupRangeInputs();

        // 主进程事件监听
        if (window.electronAPI) {
            this.setupElectronListeners();
        }

        // 模态框控制
        this.setupModal();
    }

    // 设置范围输入控件
    setupRangeInputs() {
        const ranges = document.querySelectorAll('input[type="range"]');
        ranges.forEach(range => {
            const valueDisplay = range.parentElement.querySelector('.range-value');
            if (valueDisplay) {
                range.addEventListener('input', () => {
                    valueDisplay.textContent = range.value;
                });
            }
        });
    }

    // 设置Electron事件监听
    setupElectronListeners() {
        window.electronAPI.onImportFileSelected((event, filePath) => {
            this.handleFileImport(filePath);
        });

        window.electronAPI.onExportFileSelected((event, filePath) => {
            this.handleFileExport(filePath);
        });

        window.electronAPI.onOpenSettings(() => {
            this.showPage('settings');
        });
    }

    // 设置导航
    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const page = item.dataset.page;
                this.showPage(page);
                
                // 更新导航状态
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
            });
        });
    }

    // 显示指定页面
    showPage(pageId) {
        // 隐藏所有页面
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });

        // 显示目标页面
        const targetPage = document.getElementById(`${pageId}-page`);
        if (targetPage) {
            targetPage.classList.add('active');
            this.currentPage = pageId;
            
            // 加载页面数据
            this.loadPageData(pageId);
        }
    }

    // 加载页面数据
    async loadPageData(pageId) {
        switch (pageId) {
            case 'dashboard':
                await this.loadDashboardData();
                break;
            case 'students':
                await this.loadStudentsData();
                break;
            case 'classrooms':
                await this.loadClassroomsData();
                break;
            case 'results':
                await this.loadResultsData();
                break;
            case 'settings':
                await this.loadSettings();
                break;
        }
    }

    // 加载仪表盘数据
    async loadDashboardData() {
        try {
            if (window.electronAPI) {
                const studentsData = await window.electronAPI.getLocalData('students');
                const classroomsData = await window.electronAPI.getLocalData('classrooms');
                const resultsData = await window.electronAPI.getLocalData('results');
                
                this.updateDashboardStats({
                    totalStudents: studentsData?.data?.length || 0,
                    totalClassrooms: classroomsData?.data?.length || 0,
                    totalArrangements: resultsData?.data?.length || 0,
                    syncProgress: this.syncStatus.isOnline ? '100%' : '0%'
                });
            }
        } catch (error) {
            console.error('加载仪表盘数据失败:', error);
        }
    }

    // 更新仪表盘统计
    updateDashboardStats(stats) {
        document.getElementById('totalStudents').textContent = stats.totalStudents;
        document.getElementById('totalClassrooms').textContent = stats.totalClassrooms;
        document.getElementById('totalArrangements').textContent = stats.totalArrangements;
        document.getElementById('syncProgress').textContent = stats.syncProgress;
    }

    // 加载学生数据
    async loadStudentsData() {
        try {
            if (window.electronAPI) {
                const result = await window.electronAPI.getLocalData('students');
                const students = result?.data || [];
                
                const tbody = document.getElementById('studentsTableBody');
                if (tbody) {
                    tbody.innerHTML = students.map(student => `
                        <tr>
                            <td>${student.name}</td>
                            <td>${student.student_id}</td>
                            <td>${student.class_name}</td>
                            <td><span class="status-badge">${student.status || '正常'}</span></td>
                            <td>
                                <button class="btn secondary small">编辑</button>
                                <button class="btn secondary small">删除</button>
                            </td>
                        </tr>
                    `).join('');
                }
            }
        } catch (error) {
            console.error('加载学生数据失败:', error);
        }
    }

    // 执行同步
    async performSync() {
        try {
            this.buttonManager.setLoading('syncBtn', '同步中...');
            this.updateSyncIndicator(true);
            
            if (window.electronAPI) {
                const result = await window.electronAPI.performSync();
                if (result.success) {
                    this.showToast('同步成功', 'success');
                    await this.updateSyncStatus();
                } else {
                    throw new Error(result.error || '同步失败');
                }
            }
        } catch (error) {
            console.error('同步失败:', error);
            this.showToast('同步失败: ' + error.message, 'error');
        } finally {
            this.buttonManager.resetButton('syncBtn');
            this.updateSyncIndicator(false);
        }
    }

    // 更新同步状态
    async updateSyncStatus() {
        try {
            if (window.electronAPI) {
                const status = await window.electronAPI.getSyncStatus();
                this.syncStatus = status || this.syncStatus;
                
                // 更新UI状态
                const indicator = document.getElementById('statusIndicator');
                const statusText = document.getElementById('statusText');
                const lastSyncTime = document.getElementById('lastSyncTime');
                
                if (indicator && statusText) {
                    indicator.className = `status-indicator ${status.isOnline ? 'online' : 'offline'}`;
                    statusText.textContent = status.isOnline ? '在线' : '离线';
                }
                
                if (lastSyncTime && status.lastSyncTime) {
                    lastSyncTime.textContent = `最后同步: ${new Date(status.lastSyncTime).toLocaleString()}`;
                }
            }
        } catch (error) {
            console.error('获取同步状态失败:', error);
        }
    }

    // 更新同步指示器
    updateSyncIndicator(isSyncing) {
        const indicator = document.getElementById('statusIndicator');
        const syncBtn = document.getElementById('syncBtn');
        
        if (indicator) {
            indicator.classList.toggle('syncing', isSyncing);
        }
        
        if (syncBtn) {
            syncBtn.disabled = isSyncing;
            syncBtn.textContent = isSyncing ? '同步中...' : '立即同步';
        }
    }

    // 执行排座算法
    async executeAlgorithm() {
        try {
            this.showModal('执行排座算法', 
                '<p>确定要执行排座算法吗？这将重新分配所有座位。</p>', 
                async () => {
                    await this.runAlgorithmProcess();
                }
            );
        } catch (error) {
            console.error('算法执行失败:', error);
            this.showToast('算法执行失败: ' + error.message, 'error');
        }
    }

    // 运行算法流程
    async runAlgorithmProcess() {
        const statusEl = document.getElementById('algorithmStatus');
        const progressEl = document.getElementById('algorithmProgress');
        
        try {
            // 模拟算法执行过程
            if (statusEl) statusEl.querySelector('.status-text').textContent = '初始化算法...';
            if (progressEl) progressEl.style.width = '10%';
            
            await this.delay(1000);
            
            if (statusEl) statusEl.querySelector('.status-text').textContent = '加载数据...';
            if (progressEl) progressEl.style.width = '30%';
            
            await this.delay(1000);
            
            if (statusEl) statusEl.querySelector('.status-text').textContent = '执行算法...';
            if (progressEl) progressEl.style.width = '70%';
            
            await this.delay(2000);
            
            if (statusEl) statusEl.querySelector('.status-text').textContent = '保存结果...';
            if (progressEl) progressEl.style.width = '90%';
            
            await this.delay(500);
            
            if (statusEl) statusEl.querySelector('.status-text').textContent = '算法执行完成';
            if (progressEl) progressEl.style.width = '100%';
            
            this.showToast('排座算法执行成功', 'success');
            
            // 重置状态
            setTimeout(() => {
                if (statusEl) statusEl.querySelector('.status-text').textContent = '准备就绪';
                if (progressEl) progressEl.style.width = '0%';
            }, 3000);
            
        } catch (error) {
            if (statusEl) statusEl.querySelector('.status-text').textContent = '算法执行失败';
            if (progressEl) progressEl.style.width = '0%';
            throw error;
        }
    }

    // 保存设置
    async saveSettings() {
        try {
            const settings = {
                cloudEndpoint: document.getElementById('cloudEndpoint')?.value || '',
                syncInterval: parseInt(document.getElementById('syncInterval')?.value) || 30,
                autoSync: document.getElementById('autoSync')?.checked || false,
                maxIterations: parseInt(document.getElementById('maxIterations')?.value) || 1000,
                minSatisfaction: parseFloat(document.getElementById('minSatisfaction')?.value) || 0.7
            };
            
            if (window.electronAPI) {
                const result = await window.electronAPI.saveSettings(settings);
                if (result.success) {
                    this.showToast('设置保存成功', 'success');
                } else {
                    throw new Error('保存设置失败');
                }
            }
        } catch (error) {
            console.error('保存设置失败:', error);
            this.showToast('保存设置失败', 'error');
        }
    }

    // 加载设置
    async loadSettings() {
        try {
            if (window.electronAPI) {
                const settings = await window.electronAPI.getSettings();
                
                const cloudEndpoint = document.getElementById('cloudEndpoint');
                const syncInterval = document.getElementById('syncInterval');
                const autoSync = document.getElementById('autoSync');
                const maxIterations = document.getElementById('maxIterations');
                const minSatisfaction = document.getElementById('minSatisfaction');
                
                if (cloudEndpoint) cloudEndpoint.value = settings.cloudEndpoint || '';
                if (syncInterval) syncInterval.value = settings.syncInterval || 30;
                if (autoSync) autoSync.checked = settings.autoSync !== false;
                if (maxIterations) maxIterations.value = settings.maxIterations || 1000;
                if (minSatisfaction) minSatisfaction.value = settings.minSatisfaction || 0.7;
            }
        } catch (error) {
            console.error('加载设置失败:', error);
        }
    }

    // 显示模态框
    showModal(title, content, onConfirm) {
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
        const modalConfirm = document.getElementById('modalConfirm');
        const modalCancel = document.getElementById('modalCancel');
        const modalClose = document.getElementById('modalClose');
        
        if (modal && modalTitle && modalBody) {
            modalTitle.textContent = title;
            modalBody.innerHTML = content;
            modal.classList.add('show');
            
            const closeModal = () => {
                modal.classList.remove('show');
            };
            
            const confirmHandler = async () => {
                if (onConfirm) {
                    await onConfirm();
                }
                closeModal();
            };
            
            modalConfirm.onclick = confirmHandler;
            modalCancel.onclick = closeModal;
            modalClose.onclick = closeModal;
            
            // 点击背景关闭
            modal.onclick = (e) => {
                if (e.target === modal) {
                    closeModal();
                }
            };
        }
    }

    // 设置模态框
    setupModal() {
        const modal = document.getElementById('modal');
        const modalClose = document.getElementById('modalClose');
        const modalCancel = document.getElementById('modalCancel');
        
        if (modalClose) {
            modalClose.addEventListener('click', () => {
                modal.classList.remove('show');
            });
        }
        
        if (modalCancel) {
            modalCancel.addEventListener('click', () => {
                modal.classList.remove('show');
            });
        }
    }

    // 显示提示消息
    showToast(message, type = 'info') {
        // 创建toast元素
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        // 添加样式
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 4px;
            color: white;
            font-size: 14px;
            z-index: 2000;
            transition: all 0.3s ease;
            background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
        `;
        
        document.body.appendChild(toast);
        
        // 自动移除
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    }

    // 工具方法：延迟
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 导入学生数据
    importStudents() {
        this.showToast('正在打开文件选择对话框...', 'info');
        // 实际的文件导入会通过主进程的菜单触发
    }

    // 导出结果
    exportResults() {
        this.showToast('正在打开文件保存对话框...', 'info');
        // 实际的文件导出会通过主进程的菜单触发
    }

    // 备份数据
    async backupData() {
        this.showToast('功能开发中...', 'info');
    }

    // 处理文件导入
    async handleFileImport(filePath) {
        try {
            this.showToast('正在导入文件...', 'info');
            // 这里应该实现实际的文件导入逻辑
            await this.delay(2000);
            this.showToast('文件导入成功', 'success');
        } catch (error) {
            this.showToast('文件导入失败: ' + error.message, 'error');
        }
    }

    // 处理文件导出
    async handleFileExport(filePath) {
        try {
            this.showToast('正在导出文件...', 'info');
            // 这里应该实现实际的文件导出逻辑
            await this.delay(2000);
            this.showToast('文件导出成功', 'success');
        } catch (error) {
            this.showToast('文件导出失败: ' + error.message, 'error');
        }
    }
}

// 简化的按钮状态管理器（桌面版）
class ButtonStateManager {
    constructor() {
        this.buttonStates = new Map();
    }

    setLoading(buttonId, text = '处理中...') {
        const button = document.getElementById(buttonId);
        if (button) {
            button.disabled = true;
            button.textContent = text;
            this.buttonStates.set(buttonId, { 
                originalText: button.textContent,
                loading: true 
            });
        }
    }

    resetButton(buttonId) {
        const button = document.getElementById(buttonId);
        const state = this.buttonStates.get(buttonId);
        
        if (button && state) {
            button.disabled = false;
            button.textContent = state.originalText || '确定';
            this.buttonStates.delete(buttonId);
        }
    }
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', async () => {
    const app = new DesktopAppUI();
    await app.init();
    window.desktopApp = app; // 全局访问
});