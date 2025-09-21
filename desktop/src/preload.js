// preload.js - 渲染进程预加载脚本
const { contextBridge, ipcRenderer } = require('electron');

// 将安全的API暴露给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 同步管理
  getSyncStatus: () => ipcRenderer.invoke('get-sync-status'),
  performSync: () => ipcRenderer.invoke('perform-sync'),
  updateSyncManagerCloudEndpoint: (endpoint) => ipcRenderer.invoke('updateSyncManagerCloudEndpoint', endpoint),
  
  // 数据操作
  getLocalData: (tableName) => ipcRenderer.invoke('get-local-data', tableName),
  importData: (tableName, data) => ipcRenderer.invoke('import-data', tableName, data),
  
  // 设置管理
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  
  // 监听主进程事件
  onImportFileSelected: (callback) => ipcRenderer.on('import-file-selected', callback),
  onExportFileSelected: (callback) => ipcRenderer.on('export-file-selected', callback),
  onClearLocalData: (callback) => ipcRenderer.on('clear-local-data', callback),
  onOpenSettings: (callback) => ipcRenderer.on('open-settings', callback),
  onShowHelp: (callback) => ipcRenderer.on('show-help', callback),
  
  // 移除监听器
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});