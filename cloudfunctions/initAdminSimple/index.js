const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

/**
 * 简化版管理员初始化云函数
 */
exports.main = async (event, context) => {
  try {
    console.log('开始初始化管理员...');

    // 检查是否已存在管理员
    const existingAdmin = await db.collection('admins')
      .where({
        username: 'admin'
      })
      .get();

    if (existingAdmin.data.length > 0) {
      return {
        success: false,
        message: '默认管理员已存在',
        data: {
          username: 'admin',
          password: 'admin123',
          note: '可以直接使用现有账号登录'
        }
      };
    }

    // 创建默认管理员 - 使用最简单的数据结构
    const adminData = {
      admin_id: 'admin_' + Date.now(),
      username: 'admin',
      password: 'admin123',
      name: '系统管理员',
      role: 'seat_manager',
      permissions: 'all',
      class_ids: '',
      is_active: true,
      create_time: new Date().toISOString()
    };

    console.log('准备插入管理员数据:', adminData);

    const result = await db.collection('admins').add({
      data: adminData
    });

    console.log('管理员创建成功:', result);

    return {
      success: true,
      message: '默认管理员创建成功',
      data: {
        username: 'admin',
        password: 'admin123',
        role: 'seat_manager',
        admin_id: adminData.admin_id,
        note: '现在可以使用这个账号登录管理后台'
      }
    };

  } catch (error) {
    console.error('初始化管理员失败:', error);
    
    return {
      success: false,
      message: '初始化失败: ' + error.message,
      data: {
        error_details: error.toString(),
        suggestion: '请检查云函数权限和数据库配置'
      }
    };
  }
};