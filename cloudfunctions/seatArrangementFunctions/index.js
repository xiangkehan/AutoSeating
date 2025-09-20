const cloud = require("wx-server-sdk");
const jwt = require('jsonwebtoken');

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

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('Cloud function called with event:', event);
  
  try {
    const { type } = event;
    
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
    
    // 依赖注入对象
    const dependencies = {
      db,
      _,
      getWXContext,
      generateToken,
      generateId,
      createResponse,
      verifyToken,
      JWT_SECRET
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
        return await adminModule.submitAdminWish(event, userInfo, dependencies);
      
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