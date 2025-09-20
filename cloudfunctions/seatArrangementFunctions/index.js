const cloud = require("wx-server-sdk");
const jwt = require('jsonwebtoken');
const DatabaseSecurity = require('./utils/databaseSecurity');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;

// JWT密钥（实际项目中应该从环境变量获取）
const JWT_SECRET = 'seat-arrangement-secret-key';

// 引入各个模块
const authModule = require('./modules/auth');
const studentModule = require('./modules/student');
const sessionModule = require('./modules/session');
const wishModule = require('./modules/wish');
const resultModule = require('./modules/result');
const algorithmModule = require('./modules/algorithm');
const adminModule = require('./modules/admin');
const dataManager = require('./modules/dataManager');
const auditModule = require('./modules/audit');
const systemConfigModule = require('./modules/systemConfig');
const { checkPermission, checkCollectionPermission } = require('./modules/permission');

// 验证JWT令牌
const verifyToken = (token) => {
  try {
    if (!token) {
      throw new Error('缺少认证令牌');
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    return { success: true, data: decoded };
  } catch (error) {
    return { success: false, message: '令牌验证失败: ' + error.message };
  }
};

// 生成JWT令牌
const generateToken = (payload, expiresIn = '2h') => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

// 统一响应格式
const createResponse = (success, data = null, message = '', code = 200) => {
  return {
    success,
    code,
    message,
    data,
    timestamp: Date.now()
  };
};

// 获取微信用户信息
const getWXContext = () => {
  const wxContext = cloud.getWXContext();
  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
  };
};

// 生成唯一ID
const generateId = (prefix = '') => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}${timestamp}_${random}`;
};

// 初始化默认管理员（如果不存在）
const initDefaultAdmin = async () => {
  try {
    console.log('开始初始化默认管理员...');
    
    // 确保数据库连接正常
    if (!db) {
      console.error('数据库实例未初始化');
      return;
    }
    
    // 检查 admins 集合是否存在数据
    const existingAdmins = await db.collection('admins').limit(1).get();
    
    if (existingAdmins.data.length === 0) {
      console.log('正在创建默认管理员...');
      
      // 创建默认管理员
      const defaultAdmin = {
        admin_id: 'admin_default_' + Date.now(),
        username: 'admin',
        password: 'admin123', // 实际项目中应该加密
        name: '系统管理员',
        role: 'seat_manager',
        permissions: [
          'create_session',
          'manage_students', 
          'execute_arrangement',
          'manual_adjust',
          'publish_result',
          'view_statistics',
          'manage_users'
        ],
        class_ids: [],
        is_active: true,
        create_time: new Date().toISOString()
      };

      await db.collection('admins').add({
        data: defaultAdmin
      });
      
      console.log('默认管理员创建成功:', defaultAdmin.username);
    } else {
      console.log('默认管理员已存在，跳过创建');
    }
  } catch (error) {
    console.error('初始化管理员时出错:', error);
    // 如果是集合不存在的错误，尝试创建
    if (error.errCode === -502005 || error.message.includes('collection')) {
      try {
        console.log('尝试创建 admins 集合并添加默认管理员...');
        const defaultAdmin = {
          admin_id: 'admin_default_' + Date.now(),
          username: 'admin',
          password: 'admin123',
          name: '系统管理员',
          role: 'seat_manager',
          permissions: [
            'create_session',
            'manage_students', 
            'execute_arrangement',
            'manual_adjust',
            'publish_result',
            'view_statistics',
            'manage_users'
          ],
          class_ids: [],
          is_active: true,
          create_time: new Date().toISOString()
        };

        await db.collection('admins').add({
          data: defaultAdmin
        });
        
        console.log('默认管理员创建成功:', defaultAdmin.username);
      } catch (createError) {
        console.error('创建默认管理员失败:', createError);
      }
    }
  }
};

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('Cloud function called with event:', JSON.stringify(event, null, 2));
  
  try {
    // 初始化默认管理员（仅在首次运行或 admins 集合为空时）
    await initDefaultAdmin();
    
    const { type } = event;
    
    if (!type) {
      return createResponse(false, null, '缺少请求类型参数', 400);
    }
    
    // 不需要认证的接口
    const publicEndpoints = ['wxLogin', 'adminLogin', 'refreshToken'];
    
    let userInfo = null;
    
    // 验证令牌（公开接口除外）
    if (!publicEndpoints.includes(type)) {
      const tokenResult = verifyToken(event.token);
      if (!tokenResult.success) {
        return createResponse(false, null, tokenResult.message, 401);
      }
      userInfo = tokenResult.data;
    }
    
    // 创建数据库安全实例
    const dbSecurity = userInfo ? new DatabaseSecurity(db, {
      ...userInfo,
      ...getWXContext()
    }) : null;
    
    // 依赖注入对象
    const dependencies = {
      db,
      _,
      getWXContext,
      generateToken,
      generateId,
      createResponse,
      verifyToken,
      JWT_SECRET,
      dbSecurity
    };
    
    // 路由处理
    switch (type) {
      // ============ 认证相关 ============
      case 'wxLogin':
        return await authModule.wxLogin(event, dependencies);
      
      case 'adminLogin':
        return await authModule.adminLogin(event, dependencies);
      
      case 'refreshToken':
        return await authModule.refreshToken(event, dependencies);
      
      // ============ 学生相关 ============
      case 'getStudentProfile':
        return await studentModule.getProfile(userInfo, dependencies);
      
      case 'updateStudentProfile':
        return await studentModule.updateProfile(event, userInfo, dependencies);
      
      case 'getClassmates':
        return await studentModule.getClassmates(userInfo, dependencies);
      
      case 'getClassList':
        return await studentModule.getClassList(dependencies);
      
      // ============ 会话相关 ============
      case 'getCurrentSession':
        return await sessionModule.getCurrentSession(event, userInfo, dependencies);
      
      case 'createSession':
        return await sessionModule.createSession(event, userInfo, dependencies);
      
      case 'getSessionStatistics':
        return await sessionModule.getStatistics(event, userInfo, dependencies);
      
      // ============ 算法相关 ============
      case 'executeArrangement':
        return await algorithmModule.executeArrangement(event, userInfo, dependencies);
      
      // ============ 意愿相关 ============
      case 'submitWish':
        return await wishModule.submitWish(event, userInfo, dependencies);
      
      case 'updateWish':
        return await wishModule.updateWish(event, userInfo, dependencies);
      
      case 'getMyWish':
        return await wishModule.getMyWish(event, userInfo, dependencies);
      
      // ============ 管理员相关 ============
      case 'getDashboardStats':
        return await adminModule.getDashboardStats(event, userInfo, dependencies);
      
      case 'getColleagueList':
        return await adminModule.getColleagueList(event, userInfo, dependencies);
      
      case 'submitAdminWish':
        return await wishModule.submitAdminWish(event, userInfo, dependencies);
      
      case 'createArrangementSession':
        return await adminModule.createSession(event, userInfo, dependencies);
      
      case 'executeAdminArrangement':
        return await adminModule.executeArrangement(event, userInfo, dependencies);
      
      // ============ 结果相关 ============
      case 'getMyAssignment':
        return await resultModule.getMyAssignment(event, userInfo, dependencies);
      
      case 'getArrangementResult':
        return await resultModule.getArrangementResult(event, userInfo, dependencies);
      
      // ============ 数据管理（所有人可读，管理员可写） ============
      case 'getClassList':
        return await dataManager.getClassList(event, userInfo, dependencies);
      
      case 'getClassroomList':
        return await dataManager.getClassroomList(event, userInfo, dependencies);
      
      case 'getStudentInfo':
        return await dataManager.getStudentInfo(event, userInfo, dependencies);
      
      case 'genericRead':
        return await dataManager.genericRead(event, userInfo, dependencies);
      
      // 仅管理员可写操作
      case 'createClass':
        return await dataManager.createClass(event, userInfo, dependencies);
      
      case 'updateClass':
        return await dataManager.updateClass(event, userInfo, dependencies);
      
      case 'deleteClass':
        return await dataManager.deleteClass(event, userInfo, dependencies);
      
      case 'genericWrite':
        return await dataManager.genericWrite(event, userInfo, dependencies);
      
      // ============ 审计日志相关 ============
      case 'logOperation':
        return await auditModule.logOperation(event, userInfo, dependencies);
      
      case 'getAuditLogs':
        return await auditModule.getAuditLogs(event, userInfo, dependencies);
      
      case 'getAuditStatistics':
        return await auditModule.getAuditStatistics(event, userInfo, dependencies);
      
      case 'getUserOperationHistory':
        return await auditModule.getUserOperationHistory(event, userInfo, dependencies);
      
      case 'cleanupAuditLogs':
        return await auditModule.cleanupAuditLogs(event, userInfo, dependencies);
      
      // ============ 系统配置相关 ============
      case 'getSystemConfig':
        return await systemConfigModule.getSystemConfig(event, userInfo, dependencies);
      
      case 'updateSystemConfig':
        return await systemConfigModule.updateSystemConfig(event, userInfo, dependencies);
      
      case 'initSystemConfig':
        return await systemConfigModule.initSystemConfig(event, userInfo, dependencies);
      
      case 'getConfigHistory':
        return await systemConfigModule.getConfigHistory(event, userInfo, dependencies);
      
      case 'exportConfig':
        return await systemConfigModule.exportConfig(event, userInfo, dependencies);
      
      // ============ 原有功能保持兼容 ============
      case 'getOpenId':
        return createResponse(true, getWXContext(), '获取成功');
      
      default:
        return createResponse(false, null, `未知的接口类型: ${type}`, 400);
    }
    
  } catch (error) {
    console.error('Cloud function error:', error);
    return createResponse(false, null, '服务器内部错误: ' + error.message, 500);
  }
};