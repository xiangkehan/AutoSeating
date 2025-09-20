// modules/result.js - 排座结果管理模块

/**
 * 获取我的座位分配
 */
const getMyAssignment = async (event, userInfo, { db, createResponse }) => {
  try {
    const { session_id } = event;
    const { student_id } = userInfo;
    
    if (!session_id || !student_id) {
      return createResponse(false, null, '缺少必要参数', 400);
    }
    
    // 验证会话状态
    const session = await db.collection('arrangement_sessions').where({
      session_id: session_id,
      status: db.command.in(['completed', 'published'])
    }).get();
    
    if (session.data.length === 0) {
      return createResponse(false, null, '排座结果尚未生成', 404);
    }
    
    // 查找我的座位分配
    const assignment = await db.collection('seat_assignments').where({
      session_id: session_id,
      student_id: student_id
    }).get();
    
    if (assignment.data.length === 0) {
      return createResponse(false, null, '未找到座位分配', 404);
    }
    
    const assignmentData = assignment.data[0];
    
    // 获取座位详细信息
    const classroom = await db.collection('classrooms').where({
      classroom_id: session.data[0].classroom_id
    }).get();
    
    let seatInfo = null;
    if (classroom.data.length > 0) {
      const seats = classroom.data[0].layout_config.seats;
      const mySeat = seats.find(seat => seat.seat_id === assignmentData.seat_id);
      
      if (mySeat) {
        seatInfo = {
          seat_id: mySeat.seat_id,
          position: mySeat.position,
          position_desc: `第${mySeat.position.row}排第${mySeat.position.col}列`
        };
      }
    }
    
    // 获取邻座信息
    const neighbors = await getNeighborsInfo(assignmentData.seat_id, session_id, classroom.data[0], db);
    
    // 构建响应数据
    const responseData = {
      assignment_id: assignmentData.assignment_id,
      student_id: assignmentData.student_id,
      seat_info: seatInfo,
      neighbors: neighbors,
      satisfaction_score: assignmentData.satisfaction_score || 0,
      assignment_reasons: assignmentData.assignment_reasons || [],
      manual_adjusted: assignmentData.manual_adjusted || false,
      assign_time: assignmentData.assign_time
    };
    
    return createResponse(true, responseData, '获取成功');
    
  } catch (error) {
    console.error('getMyAssignment error:', error);
    return createResponse(false, null, '获取座位分配失败: ' + error.message, 500);
  }
};

/**
 * 获取排座结果
 */
const getArrangementResult = async (event, userInfo, { db, createResponse }) => {
  try {
    const { session_id, format = 'simple' } = event;
    
    if (!session_id) {
      return createResponse(false, null, '缺少会话ID', 400);
    }
    
    // 权限检查：只有管理员可以查看完整结果
    if (format !== 'simple' && userInfo.role !== 'admin' && userInfo.role !== 'seat_manager') {
      return createResponse(false, null, '权限不足', 403);
    }
    
    // 验证会话状态
    const session = await db.collection('arrangement_sessions').where({
      session_id: session_id,
      status: db.command.in(['completed', 'published'])
    }).get();
    
    if (session.data.length === 0) {
      return createResponse(false, null, '排座结果尚未生成', 404);
    }
    
    const sessionData = session.data[0];
    
    // 获取所有座位分配
    const assignments = await db.collection('seat_assignments').where({
      session_id: session_id
    }).get();
    
    // 获取教室信息
    const classroom = await db.collection('classrooms').where({
      classroom_id: sessionData.classroom_id
    }).get();
    
    if (classroom.data.length === 0) {
      return createResponse(false, null, '教室信息不存在', 404);
    }
    
    const classroomData = classroom.data[0];
    
    // 构建座位图
    const seatMap = buildSeatMap(classroomData, assignments.data);
    
    let responseData = {
      session_id: session_id,
      classroom_layout: {
        dimensions: classroomData.layout_config.dimensions,
        seat_map: seatMap
      }
    };
    
    // 如果是详细格式，添加更多信息
    if (format === 'detailed') {
      // 计算统计信息
      const statistics = calculateStatistics(assignments.data);
      
      // 获取冲突解决记录
      const conflicts = await getConflictResolutions(session_id, db);
      
      responseData = {
        ...responseData,
        execution_info: sessionData.execution_info || {},
        overall_statistics: statistics,
        assignments: assignments.data.map(assignment => ({
          student_id: assignment.student_id,
          student_name: assignment.student_name,
          seat_id: assignment.seat_id,
          position: assignment.position,
          satisfaction_score: assignment.satisfaction_score,
          assignment_reasons: assignment.assignment_reasons
        })),
        conflicts: conflicts,
        generate_time: sessionData.update_time
      };
    }
    
    return createResponse(true, responseData, '获取成功');
    
  } catch (error) {
    console.error('getArrangementResult error:', error);
    return createResponse(false, null, '获取排座结果失败: ' + error.message, 500);
  }
};

/**
 * 获取邻座信息
 */
const getNeighborsInfo = async (seatId, sessionId, classroom, db) => {
  try {
    // 找到当前座位
    const currentSeat = classroom.layout_config.seats.find(seat => seat.seat_id === seatId);
    if (!currentSeat) return {};
    
    const { row, col } = currentSeat.position;
    
    // 计算邻座位置
    const neighborPositions = {
      front: { row: row - 1, col: col },
      back: { row: row + 1, col: col },
      left: { row: row, col: col - 1 },
      right: { row: row, col: col + 1 }
    };
    
    // 获取所有座位分配
    const assignments = await db.collection('seat_assignments').where({
      session_id: sessionId
    }).get();
    
    const assignmentMap = {};
    assignments.data.forEach(assignment => {
      assignmentMap[assignment.seat_id] = assignment;
    });
    
    const neighbors = {};
    
    // 查找每个方向的邻座
    for (const [direction, position] of Object.entries(neighborPositions)) {
      const neighborSeat = classroom.layout_config.seats.find(
        seat => seat.position.row === position.row && seat.position.col === position.col
      );
      
      if (neighborSeat && assignmentMap[neighborSeat.seat_id]) {
        const neighborAssignment = assignmentMap[neighborSeat.seat_id];
        neighbors[direction] = {
          student_id: neighborAssignment.student_id,
          student_name: neighborAssignment.student_name,
          is_preferred: false // 这里可以根据原始意愿判断
        };
      } else {
        neighbors[direction] = null;
      }
    }
    
    return neighbors;
    
  } catch (error) {
    console.error('getNeighborsInfo error:', error);
    return {};
  }
};

/**
 * 构建座位图
 */
const buildSeatMap = (classroom, assignments) => {
  const { dimensions } = classroom.layout_config;
  const { width, height } = dimensions;
  
  // 创建座位图矩阵
  const seatMap = Array(height).fill(null).map(() => Array(width).fill(null));
  
  // 创建分配映射
  const assignmentMap = {};
  assignments.forEach(assignment => {
    assignmentMap[assignment.seat_id] = assignment;
  });
  
  // 填充座位图
  classroom.layout_config.seats.forEach(seat => {
    const { row, col } = seat.position;
    if (row >= 1 && row <= height && col >= 1 && col <= width) {
      const assignment = assignmentMap[seat.seat_id];
      seatMap[row - 1][col - 1] = {
        seat_id: seat.seat_id,
        is_available: seat.is_available,
        student: assignment ? {
          student_id: assignment.student_id,
          name: assignment.student_name,
          satisfaction_score: assignment.satisfaction_score
        } : null
      };
    }
  });
  
  return seatMap;
};

/**
 * 计算统计信息
 */
const calculateStatistics = (assignments) => {
  const totalStudents = assignments.length;
  let totalSatisfaction = 0;
  let excellentCount = 0;
  let goodCount = 0;
  let fairCount = 0;
  
  assignments.forEach(assignment => {
    const score = assignment.satisfaction_score || 0;
    totalSatisfaction += score;
    
    if (score >= 0.8) excellentCount++;
    else if (score >= 0.6) goodCount++;
    else fairCount++;
  });
  
  return {
    total_students: totalStudents,
    overall_satisfaction: totalStudents > 0 ? Number((totalSatisfaction / totalStudents).toFixed(3)) : 0,
    satisfaction_distribution: {
      excellent: {
        count: excellentCount,
        percentage: totalStudents > 0 ? Number((excellentCount / totalStudents).toFixed(3)) : 0
      },
      good: {
        count: goodCount,
        percentage: totalStudents > 0 ? Number((goodCount / totalStudents).toFixed(3)) : 0
      },
      fair: {
        count: fairCount,
        percentage: totalStudents > 0 ? Number((fairCount / totalStudents).toFixed(3)) : 0
      }
    }
  };
};

/**
 * 获取冲突解决记录
 */
const getConflictResolutions = async (sessionId, db) => {
  try {
    // 查找冲突解决日志
    const logs = await db.collection('system_logs').where({
      session_id: sessionId,
      action: db.command.in(['resolve_conflict', 'random_assignment'])
    }).get();
    
    return logs.data.map(log => ({
      type: log.action,
      description: log.details.description || '',
      resolution_method: log.details.method || '',
      timestamp: log.create_time
    }));
    
  } catch (error) {
    console.error('getConflictResolutions error:', error);
    return [];
  }
};

/**
 * 手动调整座位
 */
const manualAdjustSeat = async (event, userInfo, { db, createResponse }) => {
  try {
    const { session_id, adjustments } = event;
    
    if (!session_id || !adjustments || !Array.isArray(adjustments)) {
      return createResponse(false, null, '缺少必要参数', 400);
    }
    
    // 权限检查
    if (userInfo.role !== 'seat_manager') {
      return createResponse(false, null, '权限不足', 403);
    }
    
    const results = {
      adjusted_count: 0,
      new_satisfaction_scores: {},
      errors: []
    };
    
    // 处理每个调整
    for (const adjustment of adjustments) {
      try {
        const { student_id, from_seat, to_seat, reason } = adjustment;
        
        // 验证调整的有效性
        const validation = await validateSeatAdjustment(session_id, student_id, from_seat, to_seat, db);
        if (!validation.success) {
          results.errors.push({
            student_id: student_id,
            error: validation.message
          });
          continue;
        }
        
        // 执行座位调整
        await db.collection('seat_assignments').where({
          session_id: session_id,
          student_id: student_id
        }).update({
          data: {
            seat_id: to_seat,
            manual_adjusted: true,
            'adjust_history': db.command.push([{
              from_seat: from_seat,
              to_seat: to_seat,
              reason: reason || '管理员手动调整',
              adjust_time: new Date().toISOString()
            }]),
            update_time: new Date().toISOString()
          }
        });
        
        results.adjusted_count++;
        
        // 这里可以重新计算满意度分数
        // results.new_satisfaction_scores[student_id] = calculateNewSatisfactionScore(...);
        
      } catch (error) {
        results.errors.push({
          student_id: adjustment.student_id,
          error: error.message
        });
      }
    }
    
    // 记录操作日志
    await db.collection('system_logs').add({
      data: {
        log_id: `log_${Date.now()}`,
        user_id: userInfo.admin_id,
        user_type: 'admin',
        action: 'manual_adjust_seat',
        session_id: session_id,
        details: {
          adjustments: adjustments,
          results: results
        },
        result: 'success',
        create_time: new Date().toISOString()
      }
    });
    
    return createResponse(true, {
      ...results,
      adjust_time: new Date().toISOString()
    }, '座位调整完成');
    
  } catch (error) {
    console.error('manualAdjustSeat error:', error);
    return createResponse(false, null, '手动调整座位失败: ' + error.message, 500);
  }
};

/**
 * 验证座位调整
 */
const validateSeatAdjustment = async (sessionId, studentId, fromSeat, toSeat, db) => {
  try {
    // 检查学生是否有座位分配
    const assignment = await db.collection('seat_assignments').where({
      session_id: sessionId,
      student_id: studentId,
      seat_id: fromSeat
    }).get();
    
    if (assignment.data.length === 0) {
      return { success: false, message: '未找到学生的座位分配' };
    }
    
    // 检查目标座位是否被占用
    const targetAssignment = await db.collection('seat_assignments').where({
      session_id: sessionId,
      seat_id: toSeat
    }).get();
    
    if (targetAssignment.data.length > 0 && targetAssignment.data[0].student_id !== studentId) {
      return { success: false, message: '目标座位已被占用' };
    }
    
    return { success: true };
    
  } catch (error) {
    return { success: false, message: '验证失败: ' + error.message };
  }
};

module.exports = {
  getMyAssignment,
  getArrangementResult,
  manualAdjustSeat
};