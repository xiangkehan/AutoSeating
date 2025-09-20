/**
 * 系统配置管理模块
 * 负责系统参数的配置和管理
 */

/**
 * 获取系统配置
 */
const getSystemConfig = async (event, userInfo, { db, createResponse, dbSecurity }) => {
  try {
    // 验证权限
    if (dbSecurity) {
      const hasPermission = await dbSecurity.checkPermission('system_config', 'read');
      if (!hasPermission) {
        return createResponse(false, null, '无权限查看系统配置', 403);
      }
    }

    const { category } = event;

    let query = {};
    if (category) {
      query.category = category;
    }

    const result = await db.collection('system_config')
      .where(query)
      .orderBy('category', 'asc')
      .orderBy('sort_order', 'asc')
      .get();

    // 按分类组织配置
    const configByCategory = {};
    result.data.forEach(config => {
      if (!configByCategory[config.category]) {
        configByCategory[config.category] = [];
      }
      configByCategory[config.category].push(config);
    });

    return createResponse(true, {
      configs: result.data,
      config_by_category: configByCategory
    }, '获取系统配置成功');

  } catch (error) {
    console.error('获取系统配置失败:', error);
    return createResponse(false, null, '获取系统配置失败: ' + error.message, 500);
  }
};

/**
 * 更新系统配置
 */
const updateSystemConfig = async (event, userInfo, { db, createResponse, dbSecurity }) => {
  try {
    // 验证权限（只有超级管理员可以修改系统配置）
    if (userInfo.role !== 'super_admin') {
      return createResponse(false, null, '只有超级管理员可以修改系统配置', 403);
    }

    const { config_id, value, description } = event;

    if (!config_id || value === undefined) {
      return createResponse(false, null, '缺少必要参数', 400);
    }

    // 获取当前配置
    const currentConfig = await db.collection('system_config')
      .where({ config_id })
      .get();

    if (currentConfig.data.length === 0) {
      return createResponse(false, null, '配置项不存在', 404);
    }

    const config = currentConfig.data[0];

    // 验证值类型
    if (!validateConfigValue(value, config.value_type)) {
      return createResponse(false, null, `配置值类型错误，期望: ${config.value_type}`, 400);
    }

    // 验证值范围
    if (!validateConfigRange(value, config.validation_rules)) {
      return createResponse(false, null, '配置值超出允许范围', 400);
    }

    const updateData = {
      value,
      updated_at: new Date(),
      updated_by: userInfo.openid
    };

    if (description) {
      updateData.description = description;
    }

    // 记录旧值用于审计
    const oldValue = config.value;

    // 使用安全方式更新
    if (dbSecurity) {
      await dbSecurity.secureUpdate('system_config', config._id, updateData);
    } else {
      await db.collection('system_config')
        .doc(config._id)
        .update({ data: updateData });
    }

    // 记录操作日志
    await logConfigChange({
      config_id,
      config_name: config.name,
      old_value: oldValue,
      new_value: value,
      user_info: userInfo
    }, { db });

    return createResponse(true, {
      config_id,
      old_value: oldValue,
      new_value: value
    }, '配置更新成功');

  } catch (error) {
    console.error('更新系统配置失败:', error);
    return createResponse(false, null, '更新系统配置失败: ' + error.message, 500);
  }
};

/**
 * 初始化默认系统配置
 */
const initSystemConfig = async (event, userInfo, { db, createResponse, generateId }) => {
  try {
    // 验证权限
    if (userInfo.role !== 'super_admin') {
      return createResponse(false, null, '只有超级管理员可以初始化系统配置', 403);
    }

    // 检查是否已经初始化
    const existingConfigs = await db.collection('system_config').limit(1).get();
    if (existingConfigs.data.length > 0) {
      return createResponse(false, null, '系统配置已经初始化', 400);
    }

    const defaultConfigs = getDefaultConfigs();
    const timestamp = new Date();

    // 批量添加配置
    const addPromises = defaultConfigs.map(config => {
      return db.collection('system_config').add({
        data: {
          ...config,
          config_id: generateId('config_'),
          created_at: timestamp,
          created_by: userInfo.openid,
          updated_at: timestamp,
          updated_by: userInfo.openid
        }
      });
    });

    await Promise.all(addPromises);

    return createResponse(true, {
      initialized_count: defaultConfigs.length
    }, '系统配置初始化成功');

  } catch (error) {
    console.error('初始化系统配置失败:', error);
    return createResponse(false, null, '初始化系统配置失败: ' + error.message, 500);
  }
};

/**
 * 获取配置历史记录
 */
const getConfigHistory = async (event, userInfo, { db, createResponse, dbSecurity }) => {
  try {
    // 验证权限
    if (dbSecurity) {
      const hasPermission = await dbSecurity.checkPermission('system_config', 'read');
      if (!hasPermission) {
        return createResponse(false, null, '无权限查看配置历史', 403);
      }
    }

    const { config_id, page = 1, limit = 20 } = event;

    if (!config_id) {
      return createResponse(false, null, '缺少配置ID', 400);
    }

    const skip = (page - 1) * limit;

    const result = await db.collection('config_history')
      .where({ config_id })
      .orderBy('timestamp', 'desc')
      .skip(skip)
      .limit(limit)
      .get();

    const countResult = await db.collection('config_history')
      .where({ config_id })
      .count();

    return createResponse(true, {
      history: result.data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.total,
        total_pages: Math.ceil(countResult.total / limit)
      }
    }, '获取配置历史成功');

  } catch (error) {
    console.error('获取配置历史失败:', error);
    return createResponse(false, null, '获取配置历史失败: ' + error.message, 500);
  }
};

/**
 * 导出配置
 */
const exportConfig = async (event, userInfo, { db, createResponse, dbSecurity }) => {
  try {
    // 验证权限
    if (userInfo.role !== 'super_admin') {
      return createResponse(false, null, '只有超级管理员可以导出配置', 403);
    }

    const result = await db.collection('system_config')
      .orderBy('category', 'asc')
      .orderBy('sort_order', 'asc')
      .get();

    const exportData = {
      export_time: new Date().toISOString(),
      export_by: userInfo.openid,
      configs: result.data.map(config => ({
        config_id: config.config_id,
        category: config.category,
        name: config.name,
        key: config.key,
        value: config.value,
        value_type: config.value_type,
        description: config.description,
        validation_rules: config.validation_rules
      }))
    };

    return createResponse(true, exportData, '配置导出成功');

  } catch (error) {
    console.error('导出配置失败:', error);
    return createResponse(false, null, '导出配置失败: ' + error.message, 500);
  }
};

/**
 * 记录配置变更日志
 */
const logConfigChange = async (changeData, { db }) => {
  try {
    const logData = {
      config_id: changeData.config_id,
      config_name: changeData.config_name,
      old_value: JSON.stringify(changeData.old_value),
      new_value: JSON.stringify(changeData.new_value),
      changed_by: changeData.user_info.openid,
      changed_by_name: changeData.user_info.name || '未知用户',
      timestamp: new Date()
    };

    await db.collection('config_history').add({
      data: logData
    });

  } catch (error) {
    console.error('记录配置变更日志失败:', error);
  }
};

/**
 * 验证配置值类型
 */
function validateConfigValue(value, valueType) {
  switch (valueType) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'json':
      try {
        if (typeof value === 'object') return true;
        JSON.parse(value);
        return true;
      } catch {
        return false;
      }
    case 'array':
      return Array.isArray(value);
    default:
      return true;
  }
}

/**
 * 验证配置值范围
 */
function validateConfigRange(value, validationRules) {
  if (!validationRules) return true;

  const rules = typeof validationRules === 'string' ? 
    JSON.parse(validationRules) : validationRules;

  if (rules.min !== undefined && value < rules.min) {
    return false;
  }

  if (rules.max !== undefined && value > rules.max) {
    return false;
  }

  if (rules.minLength !== undefined && 
      typeof value === 'string' && value.length < rules.minLength) {
    return false;
  }

  if (rules.maxLength !== undefined && 
      typeof value === 'string' && value.length > rules.maxLength) {
    return false;
  }

  if (rules.enum && !rules.enum.includes(value)) {
    return false;
  }

  if (rules.pattern && typeof value === 'string') {
    const regex = new RegExp(rules.pattern);
    if (!regex.test(value)) {
      return false;
    }
  }

  return true;
}

/**
 * 获取默认配置
 */
function getDefaultConfigs() {
  return [
    // 排座算法配置
    {
      category: 'algorithm',
      name: '最大迭代次数',
      key: 'max_iterations',
      value: 1000,
      value_type: 'number',
      description: '排座算法的最大迭代次数',
      validation_rules: { min: 100, max: 10000 },
      sort_order: 1
    },
    {
      category: 'algorithm',
      name: '收敛阈值',
      key: 'convergence_threshold',
      value: 0.001,
      value_type: 'number',
      description: '算法收敛的满意度阈值',
      validation_rules: { min: 0.0001, max: 0.1 },
      sort_order: 2
    },
    {
      category: 'algorithm',
      name: '意愿权重',
      key: 'wish_weight',
      value: 0.4,
      value_type: 'number',
      description: '学生意愿在算法中的权重',
      validation_rules: { min: 0, max: 1 },
      sort_order: 3
    },
    {
      category: 'algorithm',
      name: '教学权重',
      key: 'teaching_weight',
      value: 0.3,
      value_type: 'number',
      description: '教学需求在算法中的权重',
      validation_rules: { min: 0, max: 1 },
      sort_order: 4
    },
    {
      category: 'algorithm',
      name: '公平性权重',
      key: 'fairness_weight',
      value: 0.2,
      value_type: 'number',
      description: '公平性在算法中的权重',
      validation_rules: { min: 0, max: 1 },
      sort_order: 5
    },
    {
      category: 'algorithm',
      name: '约束权重',
      key: 'constraint_weight',
      value: 0.1,
      value_type: 'number',
      description: '约束条件在算法中的权重',
      validation_rules: { min: 0, max: 1 },
      sort_order: 6
    },
    
    // 会话配置
    {
      category: 'session',
      name: '意愿提交截止时间提前量',
      key: 'wish_deadline_hours',
      value: 24,
      value_type: 'number',
      description: '意愿提交截止时间提前排座时间的小时数',
      validation_rules: { min: 1, max: 168 },
      sort_order: 1
    },
    {
      category: 'session',
      name: '最大座位调整次数',
      key: 'max_adjustments',
      value: 5,
      value_type: 'number',
      description: '每个会话允许的最大手动调整次数',
      validation_rules: { min: 0, max: 20 },
      sort_order: 2
    },
    
    // 安全配置
    {
      category: 'security',
      name: 'JWT过期时间',
      key: 'jwt_expires_hours',
      value: 2,
      value_type: 'number',
      description: 'JWT令牌的过期时间（小时）',
      validation_rules: { min: 1, max: 24 },
      sort_order: 1
    },
    {
      category: 'security',
      name: '最大登录失败次数',
      key: 'max_login_attempts',
      value: 5,
      value_type: 'number',
      description: '账户锁定前的最大登录失败次数',
      validation_rules: { min: 3, max: 10 },
      sort_order: 2
    },
    {
      category: 'security',
      name: '账户锁定时间',
      key: 'account_lockout_minutes',
      value: 30,
      value_type: 'number',
      description: '账户锁定的持续时间（分钟）',
      validation_rules: { min: 5, max: 1440 },
      sort_order: 3
    },
    
    // 系统配置
    {
      category: 'system',
      name: '审计日志保留天数',
      key: 'audit_log_retention_days',
      value: 90,
      value_type: 'number',
      description: '审计日志的保留天数',
      validation_rules: { min: 30, max: 365 },
      sort_order: 1
    },
    {
      category: 'system',
      name: '启用调试模式',
      key: 'debug_mode',
      value: false,
      value_type: 'boolean',
      description: '是否启用系统调试模式',
      validation_rules: null,
      sort_order: 2
    },
    {
      category: 'system',
      name: '系统维护模式',
      key: 'maintenance_mode',
      value: false,
      value_type: 'boolean',
      description: '是否启用系统维护模式',
      validation_rules: null,
      sort_order: 3
    }
  ];
}

module.exports = {
  getSystemConfig,
  updateSystemConfig,
  initSystemConfig,
  getConfigHistory,
  exportConfig
};", "file_path": "c:\\Users\\xjh20\\WeChatProjects\\miniprogram-2\\cloudfunctions\\seatArrangementFunctions\\modules\\systemConfig.js"}]