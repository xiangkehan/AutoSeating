// 数据同步管理器 - 处理在线和离线数据同步
const LocalDatabase = require('../storage/localdb');
// 使用相对路径导入axios模块以解决Electron环境下的模块查找问题
const axios = require('../../desktop/node_modules/axios');

// 尝试导入错误报告器，如果在主进程中不可用则创建简单的模拟版本
let ErrorReporter = null;
try {
  // 在主进程中，我们使用简单的错误处理逻辑
  ErrorReporter = class {
    reportError(errorType, errorCode, message, details = {}) {
      console.error(`[${errorType}] [${errorCode}]: ${message}`, details);
      return { type: errorType, code: errorCode, message, details, timestamp: new Date() };
    }
  };
} catch (e) {
  console.warn('无法加载错误报告器模块:', e);
}

class SyncManager {
  constructor(options = {}) {
    this.localDB = new LocalDatabase(options.dbPath);
    this.cloudEndpoint = options.cloudEndpoint || 'https://your-cloud-function-url';
    this.syncInterval = options.syncInterval || 30000; // 30秒
    this.maxRetries = options.maxRetries || 3;
    this.isOnline = false;
    this.isSyncing = false;
    this.syncTimer = null;
    this.authToken = null;
    
    // 连接状态相关属性
    this.lastConnectionCheck = null;
    this.connectionErrorType = null;
    this.connectionErrorMessage = null;
  }

  // 初始化同步管理器
  async initialize() {
    await this.localDB.initialize();
    await this.localDB.createTables();
    
    // 初始化错误报告器
    this.errorReporter = new ErrorReporter();
    
    // 检查是否使用了默认的云函数地址
    if (this.cloudEndpoint === 'https://your-cloud-function-url' || !this.cloudEndpoint) {
      console.warn('⚠️ 警告: 当前使用的是默认云函数地址，请在系统设置中更新为正确的云函数地址');
      this.isOnline = false;
      
      // 记录默认地址警告
      if (this.errorReporter) {
        this.errorReporter.reportError(
          '配置警告', 
          'DEFAULT_URL', 
          '当前使用的是默认云函数地址，请在系统设置中更新为正确的云函数地址',
          {
            networkStatus: '离线',
            cloudEndpoint: this.cloudEndpoint
          }
        );
      }
    } else {
      // 检查网络状态
      this.checkNetworkStatus();
    }
    
    // 启动定期同步
    this.startPeriodicSync();
    
    console.log('数据同步管理器初始化完成');
  }

  // 检查网络状态
  async checkNetworkStatus() {
    const now = new Date();
    this.lastConnectionCheck = now;
    
    try {
      // 验证云函数地址格式是否正确
      if (!this.cloudEndpoint || this.cloudEndpoint === 'https://your-cloud-function-url') {
        this.isOnline = false;
        this.connectionErrorType = 'DEFAULT_URL';
        this.connectionErrorMessage = '云函数地址未设置或使用了默认地址';
        console.warn('⚠️ 警告: 云函数地址未设置或使用了默认地址，请在系统设置中更新');
        return false;
      }
      
      // 使用正确的POST请求格式与云函数通信
      const response = await axios.post(this.cloudEndpoint, {
        type: 'wxLogin', // 使用公开的wxLogin接口进行网络状态检查
        test: true // 添加测试标记，避免实际登录行为
      }, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      // 只要能接收到响应，就认为网络在线
      this.isOnline = true;
      this.connectionErrorType = null;
      this.connectionErrorMessage = null;
      console.log('云函数连接成功');
    } catch (error) {
      this.isOnline = false;
      // 提供更详细的错误信息并记录连接状态
      if (error.code === 'ENOTFOUND') {
        console.error('云函数连接失败: 无法解析云函数地址，请检查地址是否正确');
        this.connectionErrorType = 'ENOTFOUND';
        this.connectionErrorMessage = '无法解析云函数地址，请检查地址是否正确';
        
        // 记录详细的错误报告
        if (this.errorReporter) {
          this.errorReporter.reportError(
            '网络连接错误', 
            'ENOTFOUND', 
            '无法解析云函数地址，请检查地址是否正确',
            {
              networkStatus: '离线',
              cloudEndpoint: this.cloudEndpoint,
              errorDetails: error
            }
          );
        }
      } else if (error.code === 'ECONNREFUSED') {
        console.error('云函数连接失败: 连接被拒绝，请确认云函数已部署并可访问');
        this.connectionErrorType = 'ECONNREFUSED';
        this.connectionErrorMessage = '连接被拒绝，请确认云函数已部署并可访问';
        
        // 记录详细的错误报告
        if (this.errorReporter) {
          this.errorReporter.reportError(
            '网络连接错误', 
            'ECONNREFUSED', 
            '连接被拒绝，请确认云函数已部署并可访问',
            {
              networkStatus: '离线',
              cloudEndpoint: this.cloudEndpoint,
              errorDetails: error
            }
          );
        }
      } else if (error.response) {
        console.error(`云函数连接失败: 服务器返回错误状态码 ${error.response.status}`);
        this.connectionErrorType = `HTTP_${error.response.status}`;
        this.connectionErrorMessage = `服务器返回错误状态码 ${error.response.status}`;
        
        // 记录详细的错误报告
        if (this.errorReporter) {
          this.errorReporter.reportError(
            '服务器响应错误', 
            `HTTP_${error.response.status}`, 
            `服务器返回错误状态码 ${error.response.status}`,
            {
              networkStatus: '在线',
              cloudEndpoint: this.cloudEndpoint,
              errorDetails: error,
              responseData: error.response.data
            }
          );
        }
      } else {
        console.error('云函数连接失败:', error.message);
        this.connectionErrorType = 'UNKNOWN';
        this.connectionErrorMessage = error.message || '未知错误';
        
        // 记录详细的错误报告
        if (this.errorReporter) {
          this.errorReporter.reportError(
            '未知错误', 
            'UNKNOWN', 
            error.message || '未知错误',
            {
              networkStatus: '离线',
              cloudEndpoint: this.cloudEndpoint,
              errorDetails: error
            }
          );
        }
      }
    }
    
    console.log('网络状态:', this.isOnline ? '在线' : '离线');
    return this.isOnline;
  }

  // 设置认证令牌
  setAuthToken(token) {
    this.authToken = token;
  }

  // 更新云端接口地址
  updateCloudEndpoint(endpoint) {
    if (endpoint && endpoint !== this.cloudEndpoint) {
      this.cloudEndpoint = endpoint;
      console.log('云端接口地址已更新:', endpoint);
      // 立即检查新地址的网络状态
      this.checkNetworkStatus();
    }
    return this.cloudEndpoint;
  }

  // 启动定期同步
  startPeriodicSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    
    this.syncTimer = setInterval(async () => {
      if (this.isOnline && !this.isSyncing) {
        await this.performFullSync();
      }
    }, this.syncInterval);
  }

  // 停止定期同步
  stopPeriodicSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  // 执行完整同步
  async performFullSync() {
    if (this.isSyncing) return;
    
    this.isSyncing = true;
    console.log('开始执行数据同步...');
    
    try {
      // 检查网络状态
      await this.checkNetworkStatus();
      
      if (!this.isOnline) {
        console.log('网络离线，跳过同步');
        return;
      }

      // 上传本地数据到云端
      await this.uploadLocalData();
      
      // 下载云端数据到本地
      await this.downloadCloudData();
      
      console.log('数据同步完成');
    } catch (error) {
      console.error('数据同步失败:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  // 上传本地数据到云端
  async uploadLocalData() {
    const tables = [
      'students', 'classrooms', 'arrangement_sessions', 
      'wishes', 'seat_assignments', 'admins', 'classes', 'system_logs'
    ];

    for (const table of tables) {
      try {
        const pendingData = await this.localDB.getPendingSyncData(table);
        
        if (pendingData.length > 0) {
          console.log(`上传 ${table} 表的 ${pendingData.length} 条数据`);
          
          const result = await this.uploadTableData(table, pendingData);
          
          if (result.success) {
            // 标记为已同步
            const ids = pendingData.map(item => item.id);
            await this.localDB.markAsSynced(table, ids);
            
            // 记录同步日志
            await this.recordSyncLog(table, 'upload', pendingData.length, true);
          } else {
            await this.recordSyncLog(table, 'upload', pendingData.length, false, result.error);
          }
        }
      } catch (error) {
        console.error(`上传 ${table} 数据失败:`, error);
        await this.recordSyncLog(table, 'upload', 0, false, error.message);
      }
    }
  }

  // 下载云端数据到本地
  async downloadCloudData() {
    try {
      const response = await axios.post(this.cloudEndpoint, {
        type: 'getUpdatedData',
        token: this.authToken,
        lastSyncTime: await this.getLastSyncTime()
      }, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        const { data } = response.data;
        
        for (const [table, records] of Object.entries(data)) {
          if (records && records.length > 0) {
            console.log(`下载 ${table} 表的 ${records.length} 条数据`);
            
            // 批量插入或更新本地数据
            await this.localDB.batchInsert(table, records);
            
            // 记录同步日志
            await this.recordSyncLog(table, 'download', records.length, true);
          }
        }
        
        // 更新最后同步时间
        await this.updateLastSyncTime();
      }
    } catch (error) {
      console.error('下载云端数据失败:', error);
      await this.recordSyncLog('all', 'download', 0, false, error.message);
    }
  }

  // 上传表数据
  async uploadTableData(tableName, data) {
    try {
      const response = await axios.post(this.cloudEndpoint, {
        type: 'syncData',
        table: tableName,
        data: data,
        token: this.authToken
      }, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      console.error(`上传 ${tableName} 数据失败:`, error);
      return { success: false, error: error.message };
    }
  }

  // 强制同步特定表
  async forceSyncTable(tableName) {
    if (!this.isOnline) {
      throw new Error('网络离线，无法同步');
    }

    const pendingData = await this.localDB.getPendingSyncData(tableName);
    
    if (pendingData.length > 0) {
      const result = await this.uploadTableData(tableName, pendingData);
      
      if (result.success) {
        const ids = pendingData.map(item => item.id);
        await this.localDB.markAsSynced(tableName, ids);
        return { success: true, synced: pendingData.length };
      } else {
        throw new Error(result.error);
      }
    }
    
    return { success: true, synced: 0 };
  }

  // 冲突解决策略
  async resolveConflicts(localData, cloudData) {
    // 使用时间戳优先策略
    const conflicts = [];
    const resolved = [];
    
    for (const localItem of localData) {
      const cloudItem = cloudData.find(item => 
        item.student_id === localItem.student_id || 
        item.wish_id === localItem.wish_id ||
        item.session_id === localItem.session_id
      );
      
      if (cloudItem) {
        const localTime = new Date(localItem.update_time || localItem.create_time);
        const cloudTime = new Date(cloudItem.update_time || cloudItem.create_time);
        
        if (localTime > cloudTime) {
          // 本地数据更新
          resolved.push({ ...localItem, source: 'local' });
        } else {
          // 云端数据更新
          resolved.push({ ...cloudItem, source: 'cloud' });
        }
        
        conflicts.push({
          local: localItem,
          cloud: cloudItem,
          resolved: resolved[resolved.length - 1]
        });
      } else {
        // 无冲突，保留本地数据
        resolved.push({ ...localItem, source: 'local' });
      }
    }
    
    return { conflicts, resolved };
  }

  // 获取同步状态
  async getSyncStatus() {
    const stats = await this.localDB.getStats();
    const lastSyncTime = await this.getLastSyncTime();
    
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      lastSyncTime,
      pendingData: Object.values(stats).reduce((total, stat) => total + stat.pending, 0),
      tables: stats,
      // 添加详细的连接状态信息
      connectionStatus: {
        endpoint: this.cloudEndpoint,
        lastCheckTime: this.lastConnectionCheck,
        errorType: this.connectionErrorType,
        errorMessage: this.connectionErrorMessage
      }
    };
  }

  // 记录同步日志
  async recordSyncLog(tableName, operation, recordCount, success, errorMessage = null) {
    const logData = {
      log_id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      operator_id: 'system',
      operator_type: 'sync',
      action: `sync_${operation}`,
      description: `${operation} ${tableName}: ${recordCount} records, ${success ? 'success' : 'failed'}${errorMessage ? ': ' + errorMessage : ''}`,
      timestamp: new Date().toISOString()
    };
    
    await this.localDB.executeSQL(
      'INSERT INTO system_logs (log_id, operator_id, operator_type, action, description, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
      [logData.log_id, logData.operator_id, logData.operator_type, logData.action, logData.description, logData.timestamp]
    );
  }

  // 获取最后同步时间
  async getLastSyncTime() {
    try {
      const result = await this.localDB.getSQL(
        'SELECT cloud_sync_time FROM sync_records ORDER BY sync_time DESC LIMIT 1'
      );
      return result ? result.cloud_sync_time : null;
    } catch (error) {
      return null;
    }
  }

  // 更新最后同步时间
  async updateLastSyncTime() {
    const now = new Date().toISOString();
    await this.localDB.executeSQL(
      'INSERT INTO sync_records (table_name, record_id, operation, sync_time, cloud_sync_time, sync_status) VALUES (?, ?, ?, ?, ?, ?)',
      ['sync_timestamp', 'global', 'sync', now, now, 1]
    );
  }

  // 重置同步状态
  async resetSyncStatus() {
    const tables = [
      'students', 'classrooms', 'arrangement_sessions', 
      'wishes', 'seat_assignments', 'admins', 'classes', 'system_logs'
    ];

    for (const table of tables) {
      await this.localDB.executeSQL(`UPDATE ${table} SET sync_status = 0`);
    }
    
    console.log('同步状态已重置');
  }

  // 清理同步日志
  async cleanupSyncLogs(daysToKeep = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffString = cutoffDate.toISOString();

    await this.localDB.executeSQL(
      'DELETE FROM sync_records WHERE sync_time < ?',
      [cutoffString]
    );
    
    console.log(`清理了 ${daysToKeep} 天前的同步日志`);
  }

  // 关闭同步管理器
  async close() {
    this.stopPeriodicSync();
    await this.localDB.close();
    console.log('数据同步管理器已关闭');
  }
}

module.exports = SyncManager;