// 离线数据存储模块 - 使用SQLite作为本地数据库
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class LocalDatabase {
  constructor(dbPath = null) {
    this.dbPath = dbPath || path.join(__dirname, '../data/seat_arrangement.db');
    this.db = null;
    this.isConnected = false;
  }

  // 初始化数据库连接
  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('数据库连接失败:', err);
          reject(err);
        } else {
          console.log('本地数据库连接成功');
          this.isConnected = true;
          resolve();
        }
      });
    });
  }

  // 创建所有必要的表结构
  async createTables() {
    const tables = [
      // 学生表
      `CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        class_id TEXT NOT NULL,
        student_number TEXT,
        contact_info TEXT,
        special_needs TEXT,
        is_active INTEGER DEFAULT 1,
        create_time TEXT DEFAULT CURRENT_TIMESTAMP,
        update_time TEXT DEFAULT CURRENT_TIMESTAMP,
        sync_status INTEGER DEFAULT 0
      )`,

      // 教室表
      `CREATE TABLE IF NOT EXISTS classrooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        classroom_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        total_seats INTEGER NOT NULL,
        layout_config TEXT,
        create_time TEXT DEFAULT CURRENT_TIMESTAMP,
        sync_status INTEGER DEFAULT 0
      )`,

      // 排座会话表
      `CREATE TABLE IF NOT EXISTS arrangement_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        class_id TEXT NOT NULL,
        classroom_id TEXT NOT NULL,
        creator_id TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        deadline TEXT,
        algorithm_config TEXT,
        create_time TEXT DEFAULT CURRENT_TIMESTAMP,
        sync_status INTEGER DEFAULT 0
      )`,

      // 意愿表
      `CREATE TABLE IF NOT EXISTS wishes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wish_id TEXT UNIQUE NOT NULL,
        student_id TEXT NOT NULL,
        student_name TEXT NOT NULL,
        class_id TEXT NOT NULL,
        user_type TEXT DEFAULT 'student',
        preferred_seats TEXT,
        avoid_seats TEXT,
        preferred_neighbors TEXT,
        avoid_neighbors TEXT,
        special_requirements TEXT,
        submit_time TEXT DEFAULT CURRENT_TIMESTAMP,
        update_time TEXT DEFAULT CURRENT_TIMESTAMP,
        is_active INTEGER DEFAULT 1,
        sync_status INTEGER DEFAULT 0
      )`,

      // 座位分配结果表
      `CREATE TABLE IF NOT EXISTS seat_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assignment_id TEXT UNIQUE NOT NULL,
        session_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        seat_id TEXT NOT NULL,
        seat_position TEXT,
        assignment_time TEXT DEFAULT CURRENT_TIMESTAMP,
        sync_status INTEGER DEFAULT 0
      )`,

      // 管理员表
      `CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT DEFAULT 'admin',
        permissions TEXT,
        class_ids TEXT,
        is_active INTEGER DEFAULT 1,
        create_time TEXT DEFAULT CURRENT_TIMESTAMP,
        sync_status INTEGER DEFAULT 0
      )`,

      // 班级表
      `CREATE TABLE IF NOT EXISTS classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        grade TEXT,
        classroom_id TEXT,
        student_count INTEGER DEFAULT 0,
        create_time TEXT DEFAULT CURRENT_TIMESTAMP,
        sync_status INTEGER DEFAULT 0
      )`,

      // 系统日志表
      `CREATE TABLE IF NOT EXISTS system_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        log_id TEXT UNIQUE NOT NULL,
        operator_id TEXT NOT NULL,
        operator_type TEXT NOT NULL,
        action TEXT NOT NULL,
        description TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        sync_status INTEGER DEFAULT 0
      )`,

      // 数据同步记录表
      `CREATE TABLE IF NOT EXISTS sync_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        sync_time TEXT DEFAULT CURRENT_TIMESTAMP,
        cloud_sync_time TEXT,
        sync_status INTEGER DEFAULT 0,
        error_message TEXT
      )`
    ];

    for (const tableSQL of tables) {
      await this.executeSQL(tableSQL);
    }

    console.log('数据库表结构创建完成');
  }

  // 执行SQL语句
  executeSQL(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          console.error('SQL执行失败:', err);
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  // 查询数据
  querySQL(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('查询失败:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // 查询单条数据
  getSQL(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          console.error('查询失败:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // 批量插入数据
  async batchInsert(tableName, records) {
    if (!records || records.length === 0) return;

    const fields = Object.keys(records[0]);
    const placeholders = fields.map(() => '?').join(',');
    const sql = `INSERT OR REPLACE INTO ${tableName} (${fields.join(',')}) VALUES (${placeholders})`;

    const stmt = this.db.prepare(sql);
    
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        for (const record of records) {
          const values = fields.map(field => record[field]);
          stmt.run(values);
        }
        
        this.db.run('COMMIT', (err) => {
          if (err) {
            this.db.run('ROLLBACK');
            reject(err);
          } else {
            resolve();
          }
        });
      });
      
      stmt.finalize();
    });
  }

  // 获取需要同步的数据
  async getPendingSyncData(tableName) {
    const sql = `SELECT * FROM ${tableName} WHERE sync_status = 0`;
    return await this.querySQL(sql);
  }

  // 标记数据为已同步
  async markAsSynced(tableName, recordIds) {
    if (!recordIds || recordIds.length === 0) return;
    
    const placeholders = recordIds.map(() => '?').join(',');
    const sql = `UPDATE ${tableName} SET sync_status = 1 WHERE id IN (${placeholders})`;
    
    return await this.executeSQL(sql, recordIds);
  }

  // 导入Excel数据
  async importFromExcel(tableName, data) {
    try {
      await this.batchInsert(tableName, data);
      console.log(`成功导入 ${data.length} 条数据到 ${tableName}`);
      return { success: true, count: data.length };
    } catch (error) {
      console.error('Excel数据导入失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 导出数据为JSON
  async exportToJSON(tableName) {
    try {
      const data = await this.querySQL(`SELECT * FROM ${tableName}`);
      return { success: true, data };
    } catch (error) {
      console.error('数据导出失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 清理旧数据
  async cleanupOldData(daysToKeep = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffString = cutoffDate.toISOString();

    const cleanupTables = [
      'system_logs',
      'sync_records'
    ];

    for (const table of cleanupTables) {
      const sql = `DELETE FROM ${table} WHERE timestamp < ?`;
      await this.executeSQL(sql, [cutoffString]);
    }

    console.log(`清理了 ${daysToKeep} 天前的旧数据`);
  }

  // 获取数据库统计信息
  async getStats() {
    const tables = [
      'students', 'classrooms', 'arrangement_sessions', 
      'wishes', 'seat_assignments', 'admins', 'classes'
    ];

    const stats = {};
    
    for (const table of tables) {
      const totalResult = await this.getSQL(`SELECT COUNT(*) as count FROM ${table}`);
      const pendingResult = await this.getSQL(`SELECT COUNT(*) as count FROM ${table} WHERE sync_status = 0`);
      
      stats[table] = {
        total: totalResult.count,
        pending: pendingResult.count
      };
    }

    return stats;
  }

  // 关闭数据库连接
  close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            console.error('关闭数据库连接失败:', err);
          } else {
            console.log('数据库连接已关闭');
          }
          this.isConnected = false;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = LocalDatabase;