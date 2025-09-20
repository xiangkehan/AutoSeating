// modules/session.js - 排座会话管理模块

/**
 * 获取当前排座会话
 */
const getCurrentSession = async (event, userInfo, { db, createResponse }) => {
  try {
    const { class_id } = event;
    const searchClassId = class_id || userInfo.class_id;
    
    if (!searchClassId) {
      return createResponse(false, null, '未指定班级', 400);
    }
    
    // 查找当前活跃的排座会话
    const sessions = await db.collection('arrangement_sessions').where({
      class_id: searchClassId,
      status: db.command.in(['collecting', 'arranging', 'completed'])
    }).orderBy('create_time', 'desc').limit(1).get();
    
    if (sessions.data.length === 0) {
      return createResponse(false, null, '当前没有进行中的排座会话', 404);
    }
    
    const sessionData = sessions.data[0];
    
    // 获取教室信息
    const classroom = await db.collection('classrooms').where({
      classroom_id: sessionData.classroom_id
    }).get();
    
    if (classroom.data.length === 0) {
      return createResponse(false, null, '教室信息不存在', 404);
    }
    
    const classroomData = classroom.data[0];
    
    // 检查用户是否已提交意愿
    let myWishStatus = 'not_submitted';
    let canModify = false;
    
    if (userInfo.student_id) {
      const wishes = await db.collection('wishes').where({
        student_id: userInfo.student_id,
        session_id: sessionData.session_id
      }).get();
      
      if (wishes.data.length > 0) {
        myWishStatus = 'submitted';
      }
      
      // 检查是否可以修改（截止时间前且状态为collecting）
      const now = new Date();
      const deadline = new Date(sessionData.deadline);
      canModify = sessionData.status === 'collecting' && now < deadline;
    }
    
    // 构建响应数据
    const responseData = {
      session_id: sessionData.session_id,
      title: sessionData.title,
      status: sessionData.status,
      deadline: sessionData.deadline,
      classroom: classroomData,
      my_wish_status: myWishStatus,
      can_modify: canModify,
      statistics: sessionData.statistics || {}
    };
    
    return createResponse(true, responseData, '获取成功');
    
  } catch (error) {
    console.error('getCurrentSession error:', error);
    return createResponse(false, null, '获取当前会话失败: ' + error.message, 500);
  }
};

/**
 * 创建排座会话
 */
const createSession = async (event, userInfo, { db, generateId, createResponse }) => {
  try {
    const { session_data } = event;
    
    // 权限检查：只有排座负责人可以创建会话
    if (userInfo.role !== 'seat_manager') {
      return createResponse(false, null, '权限不足，只有排座负责人可以创建会话', 403);
    }
    
    // 验证必要参数
    if (!session_data || !session_data.classroom_id || !session_data.class_id || !session_data.deadline) {
      return createResponse(false, null, '缺少必要参数', 400);
    }
    
    // 验证教室存在
    const classroom = await db.collection('classrooms').where({
      classroom_id: session_data.classroom_id
    }).get();
    
    if (classroom.data.length === 0) {
      return createResponse(false, null, '指定的教室不存在', 400);
    }
    
    // 验证班级存在
    const classInfo = await db.collection('classes').where({
      class_id: session_data.class_id
    }).get();
    
    if (classInfo.data.length === 0) {
      return createResponse(false, null, '指定的班级不存在', 400);
    }
    
    // 检查是否已有进行中的会话
    const existingSessions = await db.collection('arrangement_sessions').where({
      class_id: session_data.class_id,
      status: db.command.in(['collecting', 'arranging'])
    }).get();
    
    if (existingSessions.data.length > 0) {
      return createResponse(false, null, '该班级已有进行中的排座会话', 409);
    }
    
    // 生成会话ID
    const sessionId = generateId('session_');
    const now = new Date().toISOString();
    
    // 创建新会话
    const newSession = {
      session_id: sessionId,
      admin_id: userInfo.admin_id,
      classroom_id: session_data.classroom_id,
      class_id: session_data.class_id,
      title: session_data.title || '座位安排',
      description: session_data.description || '',
      status: 'collecting',
      deadline: session_data.deadline,
      auto_start_arrangement: session_data.auto_start_arrangement || false,
      auto_publish_result: session_data.auto_publish_result || false,
      algorithm_params: session_data.algorithm_params || {
        wish_weight: 0.4,
        teaching_weight: 0.3,
        fairness_weight: 0.2,
        constraint_weight: 0.1,
        max_iterations: 1000,
        min_satisfaction: 0.7,
        enable_random_fallback: true
      },
      notification_config: session_data.notification_config || {
        send_on_create: true,
        send_reminder: true,
        reminder_times: [24, 6, 1],
        send_on_publish: true
      },
      statistics: {
        total_students: classInfo.data[0].active_students || 0,
        submitted_wishes: 0,
        completion_rate: 0,
        last_updated: now
      },
      create_time: now,
      update_time: now
    };
    
    await db.collection('arrangement_sessions').add({
      data: newSession
    });
    
    // 记录操作日志
    await db.collection('system_logs').add({
      data: {
        log_id: generateId('log_'),
        user_id: userInfo.admin_id,
        user_type: 'admin',
        action: 'create_session',
        session_id: sessionId,
        details: {
          class_id: session_data.class_id,
          classroom_id: session_data.classroom_id,
          deadline: session_data.deadline
        },
        result: 'success',
        create_time: now
      }
    });
    
    return createResponse(true, {
      session_id: sessionId,
      status: 'collecting',
      create_time: now,
      notification_sent: newSession.notification_config.send_on_create
    }, '排座会话创建成功');
    
  } catch (error) {
    console.error('createSession error:', error);
    return createResponse(false, null, '创建排座会话失败: ' + error.message, 500);
  }
};

/**
 * 获取会话统计信息
 */
const getStatistics = async (event, userInfo, { db, createResponse }) => {
  try {
    const { session_id } = event;
    
    if (!session_id) {
      return createResponse(false, null, '缺少会话ID', 400);
    }
    
    // 权限检查：只有管理员可以查看统计
    if (userInfo.role !== 'admin' && userInfo.role !== 'seat_manager') {
      return createResponse(false, null, '权限不足', 403);
    }
    
    // 获取会话信息
    const session = await db.collection('arrangement_sessions').where({
      session_id: session_id
    }).get();
    
    if (session.data.length === 0) {
      return createResponse(false, null, '会话不存在', 404);
    }
    
    const sessionData = session.data[0];
    
    // 获取班级学生总数
    const students = await db.collection('students').where({
      class_id: sessionData.class_id,
      is_active: true
    }).count();
    
    // 获取已提交意愿数
    const wishes = await db.collection('wishes').where({
      session_id: session_id
    }).count();
    
    // 获取未提交意愿的学生
    const allStudents = await db.collection('students').where({
      class_id: sessionData.class_id,
      is_active: true
    }).field({
      student_id: true,
      name: true
    }).get();
    
    const submittedWishes = await db.collection('wishes').where({
      session_id: session_id
    }).field({
      student_id: true
    }).get();
    
    const submittedStudentIds = submittedWishes.data.map(wish => wish.student_id);
    const pendingStudents = allStudents.data.filter(student => 
      !submittedStudentIds.includes(student.student_id)
    );
    
    // 计算完成率
    const totalStudents = students.total;
    const submittedWishesCount = wishes.total;
    const completionRate = totalStudents > 0 ? submittedWishesCount / totalStudents : 0;
    
    // 构建统计数据
    const statistics = {
      total_students: totalStudents,
      submitted_wishes: submittedWishesCount,
      completion_rate: Number(completionRate.toFixed(3)),
      pending_students: pendingStudents.map(student => ({
        student_id: student.student_id,
        name: student.name
      }))
    };
    
    // 更新会话统计信息
    await db.collection('arrangement_sessions').where({
      session_id: session_id
    }).update({
      data: {
        'statistics.total_students': totalStudents,
        'statistics.submitted_wishes': submittedWishesCount,
        'statistics.completion_rate': completionRate,
        'statistics.last_updated': new Date().toISOString()
      }
    });
    
    // 获取操作时间线
    const logs = await db.collection('system_logs').where({
      session_id: session_id
    }).orderBy('create_time', 'asc').limit(10).get();
    
    const timeline = logs.data.map(log => ({
      time: log.create_time,
      event: log.action,
      description: getActionDescription(log.action),
      user: log.user_id
    }));
    
    const responseData = {
      session_info: {
        session_id: sessionData.session_id,
        title: sessionData.title,
        status: sessionData.status,
        deadline: sessionData.deadline
      },
      statistics: statistics,
      timeline: timeline
    };
    
    return createResponse(true, responseData, '获取成功');
    
  } catch (error) {
    console.error('getStatistics error:', error);
    return createResponse(false, null, '获取统计信息失败: ' + error.message, 500);
  }
};

/**
 * 更新会话状态
 */
const updateSessionStatus = async (event, userInfo, { db, createResponse }) => {
  try {
    const { session_id, status, reason } = event;
    
    if (!session_id || !status) {
      return createResponse(false, null, '缺少必要参数', 400);
    }
    
    // 权限检查
    if (userInfo.role !== 'seat_manager') {
      return createResponse(false, null, '权限不足', 403);
    }
    
    // 验证状态转换合理性
    const validTransitions = {
      'collecting': ['arranging', 'cancelled'],
      'arranging': ['completed', 'failed'],
      'completed': ['published'],
      'published': []
    };
    
    const session = await db.collection('arrangement_sessions').where({
      session_id: session_id
    }).get();
    
    if (session.data.length === 0) {
      return createResponse(false, null, '会话不存在', 404);
    }
    
    const currentStatus = session.data[0].status;
    if (!validTransitions[currentStatus] || !validTransitions[currentStatus].includes(status)) {
      return createResponse(false, null, `无法从状态 ${currentStatus} 转换到 ${status}`, 400);
    }
    
    // 更新会话状态
    await db.collection('arrangement_sessions').where({
      session_id: session_id
    }).update({
      data: {
        status: status,
        update_time: new Date().toISOString()
      }
    });
    
    // 记录状态变更日志
    await db.collection('system_logs').add({
      data: {
        log_id: `log_${Date.now()}`,
        user_id: userInfo.admin_id,
        user_type: 'admin',
        action: 'update_session_status',
        session_id: session_id,
        details: {
          old_status: currentStatus,
          new_status: status,
          reason: reason || ''
        },
        result: 'success',
        create_time: new Date().toISOString()
      }
    });
    
    return createResponse(true, {
      session_id: session_id,
      old_status: currentStatus,
      new_status: status,
      update_time: new Date().toISOString()
    }, '状态更新成功');
    
  } catch (error) {
    console.error('updateSessionStatus error:', error);
    return createResponse(false, null, '更新会话状态失败: ' + error.message, 500);
  }
};

/**
 * 获取操作描述
 */
const getActionDescription = (action) => {
  const descriptions = {
    'create_session': '排座会话创建',
    'submit_wish': '学生提交意愿',
    'update_wish': '学生修改意愿',
    'start_arrangement': '开始自动排座',
    'complete_arrangement': '排座完成',
    'publish_result': '发布排座结果',
    'update_session_status': '会话状态更新'
  };
  
  return descriptions[action] || action;
};

module.exports = {
  getCurrentSession,
  createSession,
  getStatistics,
  updateSessionStatus
};