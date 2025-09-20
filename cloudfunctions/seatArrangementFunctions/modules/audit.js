/**
 * 审计日志模块
 * 负责记录和查询管理员操作日志
 */

/**
 * 记录操作日志
 */
const logOperation = async (event, userInfo, { db, generateId, createResponse, dbSecurity }) => {
  try {
    const { 
      operation,      // 操作类型
      target,         // 操作目标
      details,        // 操作详情
      ip_address,     // IP地址
      user_agent,     // 用户代理
      additional_data // 额外数据
    } = event;

    if (!operation || !target) {
      return createResponse(false, null, '缺少必要的日志参数', 400);
    }

    // 验证权限
    if (dbSecurity) {
      const hasPermission = await dbSecurity.checkPermission('audit_logs', 'write');
      if (!hasPermission) {
        return createResponse(false, null, '无权限记录日志', 403);
      }
    }

    const logData = {
      log_id: generateId('log_'),
      operation,
      target,
      details: details || '',
      user_openid: userInfo.openid,
      user_role: userInfo.role || 'unknown',
      user_name: userInfo.name || '未知用户',
      ip_address: ip_address || 'unknown',
      user_agent: user_agent || 'unknown',
      additional_data: additional_data || {},
      timestamp: new Date(),
      session_id: userInfo.sessionId || generateId('session_'),
      severity: getSeverityLevel(operation),
      status: 'success'
    };

    // 使用安全方式添加日志
    if (dbSecurity) {
      await dbSecurity.secureAdd('audit_logs', logData);
    } else {
      await db.collection('audit_logs').add({
        data: logData
      });
    }

    return createResponse(true, { log_id: logData.log_id }, '日志记录成功');

  } catch (error) {
    console.error('记录操作日志失败:', error);
    
    // 即使日志记录失败，也要尝试记录这个错误
    try {
      const errorLogData = {
        log_id: generateId('error_log_'),
        operation: 'log_error',
        target: 'audit_system',
        details: `日志记录失败: ${error.message}`,
        user_openid: userInfo?.openid || 'system',
        user_role: userInfo?.role || 'system',
        user_name: userInfo?.name || '系统',
        ip_address: event.ip_address || 'unknown',
        user_agent: event.user_agent || 'unknown',
        additional_data: { original_operation: event.operation, error: error.message },
        timestamp: new Date(),
        session_id: userInfo?.sessionId || generateId('session_'),
        severity: 'high',
        status: 'error'
      };

      await db.collection('audit_logs').add({
        data: errorLogData
      });
    } catch (secondError) {
      console.error('记录错误日志也失败了:', secondError);
    }

    return createResponse(false, null, '日志记录失败: ' + error.message, 500);
  }
};

/**
 * 查询操作日志
 */
const getAuditLogs = async (event, userInfo, { db, createResponse, dbSecurity }) => {
  try {
    const {
      page = 1,
      limit = 20,
      start_date,
      end_date,
      operation,
      user_openid,
      severity,
      status
    } = event;

    // 验证权限
    if (dbSecurity) {
      const hasPermission = await dbSecurity.checkPermission('audit_logs', 'read');
      if (!hasPermission) {
        return createResponse(false, null, '无权限查看日志', 403);
      }
    }

    // 构建查询条件
    let query = {};

    if (start_date || end_date) {
      query.timestamp = {};
      if (start_date) {
        query.timestamp.$ = new Date(start_date);
      }
      if (end_date) {
        query.timestamp.$lte = new Date(end_date);
      }
    }

    if (operation) {
      query.operation = operation;
    }

    if (user_openid) {
      query.user_openid = user_openid;
    }

    if (severity) {
      query.severity = severity;
    }

    if (status) {
      query.status = status;
    }

    // 计算分页
    const skip = (page - 1) * limit;

    // 查询日志
    const result = await db.collection('audit_logs')
      .where(query)
      .orderBy('timestamp', 'desc')
      .skip(skip)
      .limit(limit)
      .get();

    // 查询总数
    const countResult = await db.collection('audit_logs')
      .where(query)
      .count();

    // 数据脱敏（根据用户角色）
    const sanitizedLogs = result.data.map(log => {
      if (userInfo.role !== 'super_admin') {
        // 非超级管理员不显示敏感信息
        delete log.user_openid;
        delete log.ip_address;
        delete log.user_agent;
      }
      return log;
    });

    return createResponse(true, {
      logs: sanitizedLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.total,
        total_pages: Math.ceil(countResult.total / limit)
      }
    }, '获取日志成功');

  } catch (error) {
    console.error('查询操作日志失败:', error);
    return createResponse(false, null, '查询日志失败: ' + error.message, 500);
  }
};

/**
 * 获取操作统计
 */
const getAuditStatistics = async (event, userInfo, { db, createResponse, dbSecurity }) => {
  try {
    // 验证权限
    if (dbSecurity) {
      const hasPermission = await dbSecurity.checkPermission('audit_logs', 'read');
      if (!hasPermission) {
        return createResponse(false, null, '无权限查看统计', 403);
      }
    }

    const { days = 7 } = event;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 按操作类型统计
    const operationStats = await db.collection('audit_logs')
      .aggregate()
      .match({
        timestamp: db.command.gte(startDate)
      })
      .group({
        _id: '$operation',
        count: db.command.sum(1)
      })
      .end();

    // 按用户统计
    const userStats = await db.collection('audit_logs')
      .aggregate()
      .match({
        timestamp: db.command.gte(startDate)
      })
      .group({
        _id: '$user_role',
        count: db.command.sum(1)
      })
      .end();

    // 按严重级别统计
    const severityStats = await db.collection('audit_logs')
      .aggregate()
      .match({
        timestamp: db.command.gte(startDate)
      })
      .group({
        _id: '$severity',
        count: db.command.sum(1)
      })
      .end();

    // 按天统计
    const dailyStats = await db.collection('audit_logs')
      .aggregate()
      .match({
        timestamp: db.command.gte(startDate)
      })
      .group({
        _id: {
          year: db.command.year('$timestamp'),
          month: db.command.month('$timestamp'),
          day: db.command.dayOfMonth('$timestamp')
        },
        count: db.command.sum(1)
      })
      .sort({
        '_id.year': 1,
        '_id.month': 1,
        '_id.day': 1
      })
      .end();

    return createResponse(true, {
      operation_stats: operationStats.list,
      user_stats: userStats.list,
      severity_stats: severityStats.list,
      daily_stats: dailyStats.list,
      period: `${days}天`
    }, '获取统计成功');

  } catch (error) {
    console.error('获取审计统计失败:', error);
    return createResponse(false, null, '获取统计失败: ' + error.message, 500);
  }
};

/**
 * 获取用户操作历史
 */
const getUserOperationHistory = async (event, userInfo, { db, createResponse, dbSecurity }) => {
  try {
    const { target_user_openid, page = 1, limit = 20 } = event;

    // 验证权限
    if (dbSecurity) {
      const hasPermission = await dbSecurity.checkPermission('audit_logs', 'read');
      if (!hasPermission) {
        return createResponse(false, null, '无权限查看用户历史', 403);
      }
    }

    // 如果没有指定用户，查看自己的历史
    const queryOpenid = target_user_openid || userInfo.openid;

    const skip = (page - 1) * limit;

    const result = await db.collection('audit_logs')
      .where({
        user_openid: queryOpenid
      })
      .orderBy('timestamp', 'desc')
      .skip(skip)
      .limit(limit)
      .get();

    const countResult = await db.collection('audit_logs')
      .where({
        user_openid: queryOpenid
      })
      .count();

    return createResponse(true, {
      history: result.data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.total,
        total_pages: Math.ceil(countResult.total / limit)
      }
    }, '获取操作历史成功');

  } catch (error) {
    console.error('获取用户操作历史失败:', error);
    return createResponse(false, null, '获取操作历史失败: ' + error.message, 500);
  }
};

/**
 * 清理过期日志
 */
const cleanupAuditLogs = async (event, userInfo, { db, createResponse, dbSecurity }) => {
  try {
    // 验证权限（只有超级管理员可以清理日志）
    if (userInfo.role !== 'super_admin') {
      return createResponse(false, null, '无权限清理日志', 403);
    }

    const { retention_days = 90 } = event;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retention_days);

    // 查询要删除的日志数量
    const countResult = await db.collection('audit_logs')
      .where({
        timestamp: db.command.lt(cutoffDate)
      })
      .count();

    if (countResult.total === 0) {
      return createResponse(true, { deleted_count: 0 }, '没有需要清理的日志');
    }

    // 分批删除
    const batchSize = 20;
    let deletedCount = 0;

    while (deletedCount < countResult.total) {
      const result = await db.collection('audit_logs')
        .where({
          timestamp: db.command.lt(cutoffDate)
        })
        .limit(batchSize)
        .remove();

      deletedCount += result.stats.removed;

      // 避免超时
      if (deletedCount % 100 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // 记录清理操作
    await logOperation({
      operation: 'cleanup_logs',
      target: 'audit_logs',
      details: `清理了 ${deletedCount} 条超过 ${retention_days} 天的日志`,
      ip_address: event.ip_address,
      user_agent: event.user_agent
    }, userInfo, { db, generateId: () => `cleanup_${Date.now()}`, createResponse, dbSecurity });

    return createResponse(true, {
      deleted_count: deletedCount,
      retention_days
    }, '日志清理完成');

  } catch (error) {
    console.error('清理审计日志失败:', error);
    return createResponse(false, null, '清理日志失败: ' + error.message, 500);
  }
};

/**
 * 获取操作严重级别
 */
function getSeverityLevel(operation) {
  const severityMap = {
    // 高风险操作
    'delete_admin': 'high',
    'delete_session': 'high',
    'delete_class': 'high',
    'cleanup_logs': 'high',
    'change_password': 'high',
    'grant_permission': 'high',
    
    // 中风险操作
    'create_admin': 'medium',
    'update_admin': 'medium',
    'create_session': 'medium',
    'execute_arrangement': 'medium',
    'publish_result': 'medium',
    'manual_adjust': 'medium',
    
    // 低风险操作
    'login': 'low',
    'logout': 'low',
    'view_data': 'low',
    'submit_wish': 'low',
    'update_profile': 'low'
  };

  return severityMap[operation] || 'medium';
}

module.exports = {
  logOperation,
  getAuditLogs,
  getAuditStatistics,
  getUserOperationHistory,
  cleanupAuditLogs
};