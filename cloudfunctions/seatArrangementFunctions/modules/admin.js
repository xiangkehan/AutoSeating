// 管理员模块 - 处理管理员相关功能

// 管理员登录
const adminLogin = async (event, dependencies) => {
  const { db, generateToken, createResponse } = dependencies;
  
  try {
    const { username, password } = event;

    // 查找管理员
    const adminResult = await db.collection('admins')
      .where({
        username: username,
        is_active: true
      })
      .get();

    if (adminResult.data.length === 0) {
      return createResponse(false, null, '用户名或密码错误', 401);
    }

    const admin = adminResult.data[0];

    // 验证密码（实际项目中应使用加密密码）
    if (admin.password !== password) {
      return createResponse(false, null, '用户名或密码错误', 401);
    }

    // 生成JWT令牌
    const token = generateToken({
      admin_id: admin.admin_id,
      username: admin.username,
      role: admin.role,
      user_type: 'admin'
    }, '24h');

    // 记录登录日志
    await db.collection('system_logs').add({
      data: {
        log_id: `log_${Date.now()}`,
        operator_id: admin.admin_id,
        operator_type: 'admin',
        action: 'login',
        description: `管理员 ${admin.name} 登录系统`,
        timestamp: new Date().toISOString()
      }
    });

    return createResponse(true, {
      token,
      admin: {
        admin_id: admin.admin_id,
        name: admin.name,
        role: admin.role,
        permissions: admin.permissions
      }
    }, '登录成功');
  } catch (error) {
    console.error('管理员登录失败:', error);
    return createResponse(false, null, '登录失败，请重试', 500);
  }
};

// 获取仪表盘统计数据
const getDashboardStats = async (event, userInfo, dependencies) => {
  const { db, createResponse } = dependencies;
  
  try {
    // 获取统计数据
    const [
      sessionsResult,
      studentsResult,
      arrangementsResult,
      wishesResult,
      logsResult
    ] = await Promise.all([
      db.collection('arrangement_sessions').where({ status: 'active' }).count(),
      db.collection('students').count(),
      db.collection('arrangement_sessions').where({ status: 'completed' }).count(),
      db.collection('wishes').count(),
      db.collection('system_logs')
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get()
    ]);

    const stats = {
      activeSession: sessionsResult.total,
      totalStudents: studentsResult.total,
      completedArrangements: arrangementsResult.total,
      totalWishes: wishesResult.total
    };

    const activities = logsResult.data.map(log => ({
      id: log._id,
      time: new Date(log.timestamp).toLocaleString('zh-CN'),
      content: log.description
    }));

    return createResponse(true, {
      stats,
      activities
    }, '获取成功');
  } catch (error) {
    console.error('获取仪表盘数据失败:', error);
    return createResponse(false, null, '获取数据失败', 500);
  }
};

// 获取同事列表（其他管理员）
const getColleagueList = async (event, userInfo, dependencies) => {
  const { db, createResponse } = dependencies;
  
  try {
    // 获取其他管理员列表
    const result = await db.collection('admins')
      .where({
        admin_id: db.command.neq(userInfo.admin_id),
        is_active: true
      })
      .field({
        admin_id: true,
        name: true,
        role: true
      })
      .get();

    const colleagues = result.data.map(admin => ({
      id: admin.admin_id,
      name: admin.name,
      role: admin.role
    }));

    return createResponse(true, colleagues, '获取成功');
  } catch (error) {
    console.error('获取同事列表失败:', error);
    return createResponse(false, null, '获取同事列表失败', 500);
  }
};

// 提交管理员意愿
const submitAdminWish = async (event, userInfo, dependencies) => {
  const { db, generateId, createResponse } = dependencies;
  
  try {
    const { class_id, wish_data } = event;
    const wishId = generateId('wish_admin_');

    // 检查是否已存在意愿
    const existingResult = await db.collection('wishes')
      .where({
        student_id: userInfo.admin_id,
        class_id: class_id,
        user_type: 'admin'
      })
      .get();

    const wishDocument = {
      wish_id: wishId,
      student_id: userInfo.admin_id,
      student_name: userInfo.username,
      class_id: class_id,
      user_type: 'admin',
      preferred_seats: wish_data.preferred_seats,
      avoid_seats: wish_data.avoid_seats,
      preferred_neighbors: wish_data.preferred_neighbors,
      avoid_neighbors: wish_data.avoid_neighbors,
      special_requirements: wish_data.special_requirements,
      submit_time: new Date().toISOString(),
      is_active: true
    };

    if (existingResult.data.length > 0) {
      // 更新现有意愿
      await db.collection('wishes')
        .doc(existingResult.data[0]._id)
        .update({
          data: {
            ...wishDocument,
            update_time: new Date().toISOString()
          }
        });
    } else {
      // 创建新意愿
      await db.collection('wishes').add({
        data: wishDocument
      });
    }

    // 记录操作日志
    await db.collection('system_logs').add({
      data: {
        log_id: generateId('log_'),
        operator_id: userInfo.admin_id,
        operator_type: 'admin',
        action: 'submit_wish',
        description: `管理员 ${userInfo.username} 提交了排座意愿`,
        timestamp: new Date().toISOString()
      }
    });

    return createResponse(true, null, '意愿提交成功');
  } catch (error) {
    console.error('提交管理员意愿失败:', error);
    return createResponse(false, null, '提交意愿失败', 500);
  }
};

module.exports = {
  adminLogin,
  getDashboardStats,
  getColleagueList,
  submitAdminWish
};