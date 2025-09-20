// modules/wish.js - 学生意愿管理模块

/**
 * 提交学生意愿
 */
const submitWish = async (event, userInfo, { db, generateId, createResponse }) => {
  try {
    const { session_id, wish_data } = event;
    const { student_id } = userInfo;
    
    if (!session_id || !wish_data || !student_id) {
      return createResponse(false, null, '缺少必要参数', 400);
    }
    
    // 验证会话存在且状态正确
    const session = await db.collection('arrangement_sessions').where({
      session_id: session_id,
      status: 'collecting'
    }).get();
    
    if (session.data.length === 0) {
      return createResponse(false, null, '排座会话不存在或已结束意愿收集', 400);
    }
    
    const sessionData = session.data[0];
    
    // 检查截止时间
    const now = new Date();
    const deadline = new Date(sessionData.deadline);
    if (now > deadline) {
      return createResponse(false, null, '意愿提交已截止', 400);
    }
    
    // 检查是否已提交过意愿
    const existingWish = await db.collection('wishes').where({
      student_id: student_id,
      session_id: session_id
    }).get();
    
    if (existingWish.data.length > 0) {
      return createResponse(false, null, '您已提交过意愿，请使用修改功能', 409);
    }
    
    // 验证座位选择的有效性
    const classroom = await db.collection('classrooms').where({
      classroom_id: sessionData.classroom_id
    }).get();
    
    if (classroom.data.length === 0) {
      return createResponse(false, null, '教室信息不存在', 404);
    }
    
    const validationResult = await validateWishData(wish_data, classroom.data[0], sessionData.class_id, db);
    if (!validationResult.success) {
      return createResponse(false, null, validationResult.message, 400);
    }
    
    // 创建意愿记录
    const wishId = generateId('wish_');
    const now_iso = new Date().toISOString();
    
    const newWish = {
      wish_id: wishId,
      student_id: student_id,
      session_id: session_id,
      version: 1,
      status: 'submitted',
      preferred_seats: wish_data.preferred_seats || [],
      avoided_seats: wish_data.avoided_seats || [],
      preferred_neighbors: wish_data.preferred_neighbors || [],
      avoided_neighbors: wish_data.avoided_neighbors || [],
      special_requirements: wish_data.special_requirements || '',
      submit_time: now_iso,
      update_time: now_iso,
      modification_history: [{
        version: 1,
        timestamp: now_iso,
        changes: '初次提交'
      }]
    };
    
    await db.collection('wishes').add({
      data: newWish
    });
    
    // 更新会话统计
    await updateSessionStatistics(session_id, db);
    
    // 记录操作日志
    await db.collection('system_logs').add({
      data: {
        log_id: generateId('log_'),
        user_id: student_id,
        user_type: 'student',
        action: 'submit_wish',
        session_id: session_id,
        details: {
          wish_id: wishId,
          preferred_seats_count: newWish.preferred_seats.length,
          avoided_seats_count: newWish.avoided_seats.length,
          preferred_neighbors_count: newWish.preferred_neighbors.length,
          avoided_neighbors_count: newWish.avoided_neighbors.length
        },
        result: 'success',
        create_time: now_iso
      }
    });
    
    return createResponse(true, {
      wish_id: wishId,
      submit_time: now_iso,
      version: 1,
      next_modify_deadline: sessionData.deadline
    }, '意愿提交成功');
    
  } catch (error) {
    console.error('submitWish error:', error);
    return createResponse(false, null, '提交意愿失败: ' + error.message, 500);
  }
};

/**
 * 更新学生意愿
 */
const updateWish = async (event, userInfo, { db, createResponse }) => {
  try {
    const { session_id, wish_data } = event;
    const { student_id } = userInfo;
    
    if (!session_id || !wish_data || !student_id) {
      return createResponse(false, null, '缺少必要参数', 400);
    }
    
    // 验证会话状态
    const session = await db.collection('arrangement_sessions').where({
      session_id: session_id,
      status: 'collecting'
    }).get();
    
    if (session.data.length === 0) {
      return createResponse(false, null, '排座会话不存在或已结束意愿收集', 400);
    }
    
    const sessionData = session.data[0];
    
    // 检查截止时间
    const now = new Date();
    const deadline = new Date(sessionData.deadline);
    if (now > deadline) {
      return createResponse(false, null, '意愿修改已截止', 400);
    }
    
    // 查找现有意愿
    const existingWish = await db.collection('wishes').where({
      student_id: student_id,
      session_id: session_id
    }).get();
    
    if (existingWish.data.length === 0) {
      return createResponse(false, null, '未找到已提交的意愿', 404);
    }
    
    const currentWish = existingWish.data[0];
    
    // 验证新的意愿数据
    const classroom = await db.collection('classrooms').where({
      classroom_id: sessionData.classroom_id
    }).get();
    
    const validationResult = await validateWishData(wish_data, classroom.data[0], sessionData.class_id, db);
    if (!validationResult.success) {
      return createResponse(false, null, validationResult.message, 400);
    }
    
    // 计算变更内容
    const changes = calculateChanges(currentWish, wish_data);
    
    // 更新意愿
    const now_iso = new Date().toISOString();
    const newVersion = currentWish.version + 1;
    
    const updateData = {
      version: newVersion,
      preferred_seats: wish_data.preferred_seats || [],
      avoided_seats: wish_data.avoided_seats || [],
      preferred_neighbors: wish_data.preferred_neighbors || [],
      avoided_neighbors: wish_data.avoided_neighbors || [],
      special_requirements: wish_data.special_requirements || '',
      update_time: now_iso,
      'modification_history': [...(currentWish.modification_history || []), {
        version: newVersion,
        timestamp: now_iso,
        changes: changes.join(', ')
      }]
    };
    
    await db.collection('wishes').doc(existingWish.data[0]._id).update({
      data: updateData
    });
    
    // 记录操作日志
    await db.collection('system_logs').add({
      data: {
        log_id: `log_${Date.now()}`,
        user_id: student_id,
        user_type: 'student',
        action: 'update_wish',
        session_id: session_id,
        details: {
          wish_id: currentWish.wish_id,
          old_version: currentWish.version,
          new_version: newVersion,
          changes: changes
        },
        result: 'success',
        create_time: now_iso
      }
    });
    
    return createResponse(true, {
      wish_id: currentWish.wish_id,
      update_time: now_iso,
      version: newVersion
    }, '意愿更新成功');
    
  } catch (error) {
    console.error('updateWish error:', error);
    return createResponse(false, null, '更新意愿失败: ' + error.message, 500);
  }
};

/**
 * 获取我的意愿
 */
const getMyWish = async (event, userInfo, { db, createResponse }) => {
  try {
    const { session_id } = event;
    const { student_id } = userInfo;
    
    if (!session_id || !student_id) {
      return createResponse(false, null, '缺少必要参数', 400);
    }
    
    // 查找意愿记录
    const wish = await db.collection('wishes').where({
      student_id: student_id,
      session_id: session_id
    }).get();
    
    if (wish.data.length === 0) {
      return createResponse(false, null, '未找到意愿记录', 404);
    }
    
    const wishData = wish.data[0];
    
    // 检查是否可以修改
    const session = await db.collection('arrangement_sessions').where({
      session_id: session_id
    }).get();
    
    let canModify = false;
    if (session.data.length > 0) {
      const sessionData = session.data[0];
      const now = new Date();
      const deadline = new Date(sessionData.deadline);
      canModify = sessionData.status === 'collecting' && now < deadline;
    }
    
    // 构建返回数据
    const responseData = {
      wish_id: wishData.wish_id,
      wish_data: {
        preferred_seats: wishData.preferred_seats,
        avoided_seats: wishData.avoided_seats,
        preferred_neighbors: wishData.preferred_neighbors,
        avoided_neighbors: wishData.avoided_neighbors,
        special_requirements: wishData.special_requirements
      },
      submit_time: wishData.submit_time,
      update_time: wishData.update_time,
      version: wishData.version,
      can_modify: canModify,
      modification_history: wishData.modification_history || []
    };
    
    return createResponse(true, responseData, '获取成功');
    
  } catch (error) {
    console.error('getMyWish error:', error);
    return createResponse(false, null, '获取意愿失败: ' + error.message, 500);
  }
};

/**
 * 验证意愿数据
 */
const validateWishData = async (wishData, classroom, classId, db) => {
  try {
    // 验证座位选择
    const availableSeats = classroom.layout_config.seats.filter(seat => seat.is_available);
    const availableSeatIds = availableSeats.map(seat => seat.seat_id);
    
    // 检查偏好座位是否有效
    if (wishData.preferred_seats) {
      for (const preferredSeat of wishData.preferred_seats) {
        if (!availableSeatIds.includes(preferredSeat.seat_id)) {
          return { success: false, message: `座位 ${preferredSeat.seat_id} 不可选择` };
        }
      }
      
      // 检查偏好座位数量限制
      if (wishData.preferred_seats.length > 5) {
        return { success: false, message: '最多只能选择5个偏好座位' };
      }
    }
    
    // 检查避免座位是否有效
    if (wishData.avoided_seats) {
      for (const avoidedSeat of wishData.avoided_seats) {
        if (!availableSeatIds.includes(avoidedSeat.seat_id)) {
          return { success: false, message: `座位 ${avoidedSeat.seat_id} 不可选择` };
        }
      }
      
      // 检查避免座位数量限制
      if (wishData.avoided_seats.length > 5) {
        return { success: false, message: '最多只能选择5个避免座位' };
      }
    }
    
    // 验证邻座选择
    const classmates = await db.collection('students').where({
      class_id: classId,
      is_active: true
    }).field({
      student_id: true
    }).get();
    
    const validStudentIds = classmates.data.map(student => student.student_id);
    
    // 检查偏好邻座
    if (wishData.preferred_neighbors) {
      for (const neighbor of wishData.preferred_neighbors) {
        if (!validStudentIds.includes(neighbor.student_id)) {
          return { success: false, message: `学生 ${neighbor.student_id} 不在同班` };
        }
      }
      
      if (wishData.preferred_neighbors.length > 3) {
        return { success: false, message: '最多只能选择3个偏好邻座' };
      }
    }
    
    // 检查避免邻座
    if (wishData.avoided_neighbors) {
      for (const neighbor of wishData.avoided_neighbors) {
        if (!validStudentIds.includes(neighbor.student_id)) {
          return { success: false, message: `学生 ${neighbor.student_id} 不在同班` };
        }
      }
      
      if (wishData.avoided_neighbors.length > 3) {
        return { success: false, message: '最多只能选择3个避免邻座' };
      }
    }
    
    return { success: true };
    
  } catch (error) {
    return { success: false, message: '验证意愿数据失败: ' + error.message };
  }
};

/**
 * 计算变更内容
 */
const calculateChanges = (oldWish, newWishData) => {
  const changes = [];
  
  // 比较偏好座位
  if (JSON.stringify(oldWish.preferred_seats) !== JSON.stringify(newWishData.preferred_seats)) {
    changes.push('修改了偏好座位');
  }
  
  // 比较避免座位
  if (JSON.stringify(oldWish.avoided_seats) !== JSON.stringify(newWishData.avoided_seats)) {
    changes.push('修改了避免座位');
  }
  
  // 比较偏好邻座
  if (JSON.stringify(oldWish.preferred_neighbors) !== JSON.stringify(newWishData.preferred_neighbors)) {
    changes.push('修改了偏好邻座');
  }
  
  // 比较避免邻座
  if (JSON.stringify(oldWish.avoided_neighbors) !== JSON.stringify(newWishData.avoided_neighbors)) {
    changes.push('修改了避免邻座');
  }
  
  // 比较特殊需求
  if (oldWish.special_requirements !== newWishData.special_requirements) {
    changes.push('修改了特殊需求');
  }
  
  return changes.length > 0 ? changes : ['无实质性变更'];
};

/**
 * 更新会话统计信息
 */
const updateSessionStatistics = async (sessionId, db) => {
  try {
    // 获取总学生数和已提交意愿数
    const session = await db.collection('arrangement_sessions').where({
      session_id: sessionId
    }).get();
    
    if (session.data.length === 0) return;
    
    const sessionData = session.data[0];
    
    const totalStudents = await db.collection('students').where({
      class_id: sessionData.class_id,
      is_active: true
    }).count();
    
    const submittedWishes = await db.collection('wishes').where({
      session_id: sessionId
    }).count();
    
    const completionRate = totalStudents.total > 0 ? submittedWishes.total / totalStudents.total : 0;
    
    // 更新统计信息
    await db.collection('arrangement_sessions').where({
      session_id: sessionId
    }).update({
      data: {
        'statistics.total_students': totalStudents.total,
        'statistics.submitted_wishes': submittedWishes.total,
        'statistics.completion_rate': Number(completionRate.toFixed(3)),
        'statistics.last_updated': new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('updateSessionStatistics error:', error);
  }
};

module.exports = {
  submitWish,
  updateWish,
  getMyWish
};