// 权限控制工具模块
// modules/permission.js

/**
 * 权限验证中间件
 * @param {Object} userInfo 用户信息（从JWT中解析）
 * @param {Array|String} requiredRoles 需要的角色，可以是数组或字符串
 * @returns {Object} 验证结果
 */
const checkPermission = (userInfo, requiredRoles) => {
  if (!userInfo || !userInfo.role) {
    return {
      success: false,
      message: '用户身份验证失败',
      code: 401
    };
  }

  // 将单个角色转换为数组
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  
  // 检查用户角色是否在允许的角色列表中
  if (!roles.includes(userInfo.role)) {
    return {
      success: false,
      message: '权限不足，仅管理员可执行此操作',
      code: 403
    };
  }

  return {
    success: true,
    message: '权限验证通过'
  };
};

/**
 * 管理员权限验证装饰器
 * @param {Function} handler 原始处理函数
 * @returns {Function} 包装后的处理函数
 */
const requireAdmin = (handler) => {
  return async (event, userInfo, dependencies) => {
    // 验证管理员权限
    const permissionCheck = checkPermission(userInfo, ['admin', 'seat_manager']);
    if (!permissionCheck.success) {
      return dependencies.createResponse(
        false, 
        null, 
        permissionCheck.message, 
        permissionCheck.code
      );
    }

    // 权限验证通过，执行原始处理函数
    return await handler(event, userInfo, dependencies);
  };
};

/**
 * 读取权限验证（所有人可读）
 * @param {Function} handler 原始处理函数
 * @returns {Function} 包装后的处理函数
 */
const allowRead = (handler) => {
  return async (event, userInfo, dependencies) => {
    // 读取操作：所有人都可以执行
    return await handler(event, userInfo, dependencies);
  };
};

/**
 * 写入权限验证（仅管理员可写）
 * @param {Function} handler 原始处理函数
 * @returns {Function} 包装后的处理函数
 */
const requireAdminWrite = (handler) => {
  return async (event, userInfo, dependencies) => {
    // 验证管理员写入权限
    const permissionCheck = checkPermission(userInfo, ['admin', 'seat_manager']);
    if (!permissionCheck.success) {
      return dependencies.createResponse(
        false, 
        null, 
        '仅管理员可执行写入操作', 
        403
      );
    }

    return await handler(event, userInfo, dependencies);
  };
};

/**
 * 角色权限配置
 */
const PERMISSIONS = {
  // 数据集合权限配置
  collections: {
    'arrangement_sessions': {
      read: ['student', 'admin', 'seat_manager'],
      write: ['admin', 'seat_manager'],
      create: ['seat_manager'],
      delete: ['seat_manager']
    },
    'students': {
      read: ['student', 'admin', 'seat_manager'],
      write: ['admin', 'seat_manager'],
      create: ['admin', 'seat_manager'],
      delete: ['seat_manager']
    },
    'classes': {
      read: ['student', 'admin', 'seat_manager'],
      write: ['admin', 'seat_manager'],
      create: ['seat_manager'],
      delete: ['seat_manager']
    },
    'classrooms': {
      read: ['student', 'admin', 'seat_manager'],
      write: ['admin', 'seat_manager'],
      create: ['seat_manager'],
      delete: ['seat_manager']
    },
    'system_logs': {
      read: ['admin', 'seat_manager'],
      write: ['admin', 'seat_manager'],
      create: ['admin', 'seat_manager'],
      delete: ['seat_manager']
    }
  },

  // 功能权限配置
  functions: {
    'createSession': ['seat_manager'],
    'executeArrangement': ['seat_manager'],
    'manualAdjustSeat': ['admin', 'seat_manager'],
    'importStudents': ['admin', 'seat_manager'],
    'viewStatistics': ['admin', 'seat_manager'],
    'manageUsers': ['seat_manager']
  }
};

/**
 * 检查数据集合权限
 * @param {String} collection 集合名称
 * @param {String} operation 操作类型 (read/write/create/delete)
 * @param {String} userRole 用户角色
 * @returns {Boolean} 是否有权限
 */
const checkCollectionPermission = (collection, operation, userRole) => {
  const collectionPerms = PERMISSIONS.collections[collection];
  if (!collectionPerms) {
    return false;
  }

  const allowedRoles = collectionPerms[operation];
  return allowedRoles && allowedRoles.includes(userRole);
};

/**
 * 检查功能权限
 * @param {String} functionName 功能名称
 * @param {String} userRole 用户角色
 * @returns {Boolean} 是否有权限
 */
const checkFunctionPermission = (functionName, userRole) => {
  const allowedRoles = PERMISSIONS.functions[functionName];
  return allowedRoles && allowedRoles.includes(userRole);
};

module.exports = {
  checkPermission,
  requireAdmin,
  allowRead,
  requireAdminWrite,
  checkCollectionPermission,
  checkFunctionPermission,
  PERMISSIONS
};