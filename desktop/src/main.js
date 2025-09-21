// Electron主进程 - 桌面应用入口
const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');
const SyncManager = require('../../offline/sync/syncManager.js');

class DesktopApp {
  constructor() {
    this.mainWindow = null;
    this.store = new Store();
    this.syncManager = null;
    this.isDev = process.argv.includes('--dev');
  }

  // 初始化应用
  async init() {
    // 等待Electron准备就绪
    await app.whenReady();
    
    // 初始化数据同步管理器
    await this.initSyncManager();
    
    // 创建主窗口
    this.createMainWindow();
    
    // 设置应用菜单
    this.setupMenu();
    
    // 注册IPC事件
    this.registerIPC();
    
    // 处理应用事件
    this.setupAppEvents();
  }

  // 初始化同步管理器
  async initSyncManager() {
    try {
      const dbPath = path.join(app.getPath('userData'), 'seat_arrangement.db');
      const cloudEndpoint = this.store.get('cloudEndpoint', 'https://your-cloud-function-url');
      
      this.syncManager = new SyncManager({
        dbPath,
        cloudEndpoint,
        syncInterval: 30000
      });
      
      await this.syncManager.initialize();
      console.log('数据同步管理器初始化成功');
    } catch (error) {
      console.error('数据同步管理器初始化失败:', error);
    }
  }

  // 创建主窗口
  createMainWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 1000,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      icon: path.join(__dirname, '../assets/icon.png'),
      title: '自动排座位系统',
      show: false
    });

    // 加载应用页面
    if (this.isDev) {
      this.mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));
    }

    // 窗口准备好后显示
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
    });

    // 处理窗口关闭
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  // 设置应用菜单
  setupMenu() {
    const template = [
      {
        label: '文件',
        submenu: [
          {
            label: '导入学生数据',
            accelerator: 'Ctrl+I',
            click: () => this.importStudentData()
          },
          {
            label: '导出排座结果',
            accelerator: 'Ctrl+E',
            click: () => this.exportResults()
          },
          { type: 'separator' },
          {
            label: '退出',
            accelerator: 'Ctrl+Q',
            click: () => app.quit()
          }
        ]
      },
      {
        label: '数据',
        submenu: [
          {
            label: '立即同步',
            accelerator: 'Ctrl+S',
            click: () => this.performSync()
          },
          {
            label: '同步状态',
            click: () => this.showSyncStatus()
          },
          { type: 'separator' },
          {
            label: '清空本地数据',
            click: () => this.clearLocalData()
          }
        ]
      },
      {
        label: '工具',
        submenu: [
          {
            label: '设置',
            accelerator: 'Ctrl+,',
            click: () => this.openSettings()
          },
          { type: 'separator' },
          {
            label: '开发者工具',
            accelerator: 'F12',
            click: () => this.mainWindow.webContents.toggleDevTools()
          }
        ]
      },
      {
        label: '帮助',
        submenu: [
          {
            label: '使用说明',
            click: () => this.showHelp()
          },
          {
            label: '关于',
            click: () => this.showAbout()
          }
        ]
      }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  // 注册IPC事件
  registerIPC() {
    // 获取同步状态
    ipcMain.handle('get-sync-status', async () => {
      if (this.syncManager) {
        return await this.syncManager.getSyncStatus();
      }
      return null;
    });

    // 执行同步
    ipcMain.handle('perform-sync', async () => {
      if (this.syncManager) {
        await this.syncManager.performFullSync();
        return { success: true };
      }
      return { success: false, error: '同步管理器未初始化' };
    });

    // 获取本地数据
    ipcMain.handle('get-local-data', async (event, tableName) => {
      if (this.syncManager) {
        return await this.syncManager.localDB.exportToJSON(tableName);
      }
      return { success: false, error: '数据库未初始化' };
    });

    // 导入数据
    ipcMain.handle('import-data', async (event, tableName, data) => {
      if (this.syncManager) {
        return await this.syncManager.localDB.importFromExcel(tableName, data);
      }
      return { success: false, error: '数据库未初始化' };
    });

    // 保存设置
    ipcMain.handle('save-settings', async (event, settings) => {
      for (const [key, value] of Object.entries(settings)) {
        this.store.set(key, value);
      }
      return { success: true };
    });

    // 获取设置
    ipcMain.handle('get-settings', async () => {
      return {
        cloudEndpoint: this.store.get('cloudEndpoint', ''),
        syncInterval: this.store.get('syncInterval', 30000),
        autoSync: this.store.get('autoSync', true)
      };
    });
  }

  // 设置应用事件
  setupAppEvents() {
    // 当所有窗口关闭时
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    // 应用激活时
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createMainWindow();
      }
    });

    // 应用退出前
    app.on('before-quit', async () => {
      if (this.syncManager) {
        await this.syncManager.close();
      }
    });
  }

  // 导入学生数据
  async importStudentData() {
    const result = await dialog.showOpenDialog(this.mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Excel文件', extensions: ['xlsx', 'xls'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });

    if (!result.canceled && result.filePaths.length > 0) {
      // 发送文件路径到渲染进程处理
      this.mainWindow.webContents.send('import-file-selected', result.filePaths[0]);
    }
  }

  // 导出排座结果
  async exportResults() {
    const result = await dialog.showSaveDialog(this.mainWindow, {
      defaultPath: `排座结果_${new Date().toISOString().split('T')[0]}.xlsx`,
      filters: [
        { name: 'Excel文件', extensions: ['xlsx'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });

    if (!result.canceled && result.filePath) {
      // 发送保存路径到渲染进程处理
      this.mainWindow.webContents.send('export-file-selected', result.filePath);
    }
  }

  // 执行同步
  async performSync() {
    if (this.syncManager) {
      try {
        await this.syncManager.performFullSync();
        dialog.showMessageBox(this.mainWindow, {
          type: 'info',
          title: '同步完成',
          message: '数据同步已完成'
        });
      } catch (error) {
        dialog.showErrorBox('同步失败', error.message);
      }
    }
  }

  // 显示同步状态
  async showSyncStatus() {
    if (this.syncManager) {
      const status = await this.syncManager.getSyncStatus();
      const message = `
在线状态: ${status.isOnline ? '在线' : '离线'}
同步状态: ${status.isSyncing ? '同步中' : '空闲'}
最后同步: ${status.lastSyncTime || '从未同步'}
待同步数据: ${status.pendingData} 条
      `.trim();

      dialog.showMessageBox(this.mainWindow, {
        type: 'info',
        title: '同步状态',
        message
      });
    }
  }

  // 清空本地数据
  async clearLocalData() {
    const result = await dialog.showMessageBox(this.mainWindow, {
      type: 'warning',
      title: '确认清空',
      message: '确定要清空所有本地数据吗？此操作不可恢复。',
      buttons: ['取消', '确定'],
      defaultId: 0
    });

    if (result.response === 1) {
      // 发送清空数据命令到渲染进程
      this.mainWindow.webContents.send('clear-local-data');
    }
  }

  // 打开设置
  openSettings() {
    this.mainWindow.webContents.send('open-settings');
  }

  // 显示帮助
  showHelp() {
    this.mainWindow.webContents.send('show-help');
  }

  // 显示关于
  showAbout() {
    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: '关于',
      message: '自动排座位系统',
      detail: 'Version 1.0.0\n\n智能座位分配系统，支持在线和离线使用。'
    });
  }
}

// 创建应用实例并启动
const desktopApp = new DesktopApp();
desktopApp.init().catch(console.error);

module.exports = DesktopApp;