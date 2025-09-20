/**
 * 数据库安全访问控制工具类
 * 提供统一的数据库访问权限验证和安全操作
 */
class DatabaseSecurity {
  constructor(db, userInfo) {
    this.db = db;
    this.userInfo = userInfo;
  }

  /**
   * 验证用户是否有权限访问指定集合
   */
  async checkPermission(collection, operation = 'read') {
    if (!this.userInfo || !this.userInfo.openid) {
      throw new Error('用户身份验证失败');
    }

    // 检查用户角色
    const userRole = await this.getUserRole();
    
    // 超级管理员有所有权限
    if (userRole === 'super_admin') {
      return true;
    }

    // 根据集合和操作类型检查权限
    const permissions = this.getCollectionPermissions(collection);
    const requiredRoles = permissions[operation] || [];
    
    return requiredRoles.includes(userRole) || requiredRoles.includes('any');
  }

  /**
   * 获取用户角色
   */
  async getUserRole() {
    if (this.userInfo.role) {
      return this.userInfo.role;
    }

    try {
      const result = await this.db.collection('system_users')
        .where({ openid: this.userInfo.openid })
        .get();
      
      if (result.data.length > 0) {
        return result.data[0].role || 'student';
      }
      
      return 'student';
    } catch (error) {
      console.error('获取用户角色失败:', error);
      return 'student';
    }
  }

  /**
   * 获取集合权限配置
   */
  getCollectionPermissions(collection) {
    const permissions = {
      'admin_collection': {
        read: ['admin', 'super_admin'],
        write: ['admin', 'super_admin'],
        delete: ['super_admin']
      },
      'system_users': {
        read: ['super_admin'],
        write: ['super_admin'],
        delete: ['super_admin']
      },
      'seat_arrangement': {
        read: ['admin', 'seat_manager', 'super_admin'],
        write: ['admin', 'seat_manager', 'super_admin'],
        delete: ['admin', 'super_admin']
      },
      'wish_records': {
        read: ['admin', 'seat_manager', 'super_admin', 'student'],
        write: ['admin', 'seat_manager', 'super_admin', 'student'],
        delete: ['admin', 'super_admin']
      },
      'neighbor_preferences': {
        read: ['admin', 'seat_manager', 'super_admin', 'student'],
        write: ['admin', 'seat_manager', 'super_admin', 'student'],
        delete: ['admin', 'super_admin']
      },
      'session_info': {
        read: ['admin', 'seat_manager', 'super_admin'],
        write: ['admin', 'seat_manager', 'super_admin'],
        delete: ['admin', 'super_admin']
      },
      'audit_logs': {
        read: ['admin', 'super_admin'],
        write: ['system'], // 只有系统可以写入
        delete: ['super_admin']
      },
      'system_config': {
        read: ['admin', 'super_admin'],
        write: ['super_admin'],
        delete: ['super_admin']
      }
    };

    return permissions[collection] || {
      read: ['student'],
      write: ['student'],
      delete: ['admin']
    };
  }

  /**
   * 安全的数据库查询
   */
  async secureQuery(collection, query = {}, operation = 'read') {
    await this.checkPermission(collection, operation);
    
    const userRole = await this.getUserRole();
    
    // 如果不是管理员，添加openid过滤
    if (!['admin', 'seat_manager', 'super_admin'].includes(userRole)) {
      query.openid = this.userInfo.openid;
    }

    return this.db.collection(collection).where(query);
  }

  /**
   * 安全的数据插入
   */
  async secureAdd(collection, data) {
    await this.checkPermission(collection, 'write');
    
    // 添加审计字段
    const auditData = {
      ...data,
      created_at: new Date(),
      created_by: this.userInfo.openid,
      updated_at: new Date(),
      updated_by: this.userInfo.openid
    };

    // 记录操作日志
    await this.logOperation('create', collection, auditData);
    
    return this.db.collection(collection).add({ data: auditData });
  }

  /**
   * 安全的数据更新
   */
  async secureUpdate(collection, docId, updateData) {
    await this.checkPermission(collection, 'write');
    
    // 添加更新审计字段
    const auditData = {
      ...updateData,
      updated_at: new Date(),
      updated_by: this.userInfo.openid
    };

    // 记录操作日志
    await this.logOperation('update', collection, { docId, updateData: auditData });
    
    return this.db.collection(collection).doc(docId).update({ data: auditData });
  }

  /**
   * 安全的数据删除
   */
  async secureDelete(collection, docId) {
    await this.checkPermission(collection, 'delete');
    
    // 记录操作日志
    await this.logOperation('delete', collection, { docId });
    
    return this.db.collection(collection).doc(docId).remove();
  }

  /**
   * 记录操作日志
   */
  async logOperation(operation, collection, data) {
    try {
      const logData = {
        operation,
        collection,
        data: JSON.stringify(data),
        user_openid: this.userInfo.openid,
        user_role: await this.getUserRole(),
        timestamp: new Date(),
        ip_address: this.userInfo.ip || 'unknown',
        user_agent: this.userInfo.userAgent || 'unknown'
      };

      await this.db.collection('audit_logs').add({ data: logData });
    } catch (error) {
      console.error('记录操作日志失败:', error);
      // 不要因为日志记录失败而中断主要操作
    }
  }

  /**
   * 数据脱敏
   */
  sanitizeData(data, level = 'basic') {
    if (!data) return data;
    
    const sanitized = { ...data };
    
    // 基础脱敏
    if (level === 'basic') {
      delete sanitized.openid;
      delete sanitized.unionid;
    }
    
    // 高级脱敏
    if (level === 'advanced') {
      delete sanitized.openid;
      delete sanitized.unionid;
      delete sanitized.phone;
      delete sanitized.email;
      if (sanitized.name) {
        sanitized.name = sanitized.name.charAt(0) + '*'.repeat(sanitized.name.length - 1);
      }
    }
    
    return sanitized;
  }

  /**
   * 验证数据完整性
   */
  validateDataIntegrity(data, schema) {
    const errors = [];
    
    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];
      
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`字段 ${field} 是必填的`);
      }
      
      if (value !== undefined && rules.type && typeof value !== rules.type) {
        errors.push(`字段 ${field} 类型错误，期望 ${rules.type}`);
      }
      
      if (value !== undefined && rules.pattern && !rules.pattern.test(value)) {
        errors.push(`字段 ${field} 格式不正确`);
      }
      
      if (value !== undefined && rules.minLength && value.length < rules.minLength) {
        errors.push(`字段 ${field} 长度不能少于 ${rules.minLength} 个字符`);
      }
      
      if (value !== undefined && rules.maxLength && value.length > rules.maxLength) {
        errors.push(`字段 ${field} 长度不能超过 ${rules.maxLength} 个字符`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = DatabaseSecurity;