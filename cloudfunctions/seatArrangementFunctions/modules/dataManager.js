// modules/dataManager.js - 数据管理模块
// 演示"仅管理端可写，所有人可读"的权限控制实现

const { checkPermission, allowRead, requireAdminWrite } = require('./permission');

/**
 * 数据读取操作 - 所有人可读
 */

// 获取班级列表（所有人可读）
const getClassList = allowRead(async (event, userInfo, { db, createResponse }) => {
  try {
    const classes = await db.collection('classes').where({
      is_active: true
    }).field({
      class_id: true,
      name: true,
      grade: true,
      student_count: true
    }).get();

    return createResponse(true, {
      classes: classes.data
    }, '获取班级列表成功');
    
  } catch (error) {
    console.error('getClassList error:', error);
    return createResponse(false, null, '获取班级列表失败: ' + error.message, 500);
  }
});

// 获取教室信息（所有人可读）
const getClassroomList = allowRead(async (event, userInfo, { db, createResponse }) => {
  try {
    const classrooms = await db.collection('classrooms').where({
      is_available: true
    }).field({
      classroom_id: true,
      name: true,
      capacity: true,
      layout: true
    }).get();

    return createResponse(true, {
      classrooms: classrooms.data
    }, '获取教室列表成功');
    
  } catch (error) {
    console.error('getClassroomList error:', error);
    return createResponse(false, null, '获取教室列表失败: ' + error.message, 500);
  }
});

// 获取学生信息（所有人可读，但根据角色过滤敏感信息）
const getStudentInfo = allowRead(async (event, userInfo, { db, createResponse }) => {
  try {
    const { student_id } = event;
    
    if (!student_id) {
      return createResponse(false, null, '缺少学生ID', 400);
    }

    const student = await db.collection('students').where({
      student_id: student_id
    }).get();

    if (student.data.length === 0) {
      return createResponse(false, null, '学生信息不存在', 404);
    }

    const studentData = student.data[0];
    
    // 根据用户角色过滤返回的信息
    let responseData;
    if (userInfo.role === 'admin' || userInfo.role === 'seat_manager') {
      // 管理员可查看完整信息
      responseData = studentData;
    } else {
      // 普通学生只能查看基础信息
      responseData = {
        student_id: studentData.student_id,
        name: studentData.name,
        class_id: studentData.class_id,
        // 隐藏敏感信息如联系方式、特殊需求等
      };
    }

    return createResponse(true, responseData, '获取学生信息成功');
    
  } catch (error) {
    console.error('getStudentInfo error:', error);
    return createResponse(false, null, '获取学生信息失败: ' + error.message, 500);
  }
});

/**
 * 数据写入操作 - 仅管理员可写
 */

// 创建班级（仅管理员可写）
const createClass = requireAdminWrite(async (event, userInfo, { db, generateId, createResponse }) => {
  try {
    const { class_data } = event;
    
    if (!class_data || !class_data.name || !class_data.grade) {
      return createResponse(false, null, '班级信息不完整', 400);
    }

    // 检查班级名称是否已存在
    const existingClass = await db.collection('classes').where({
      name: class_data.name,
      grade: class_data.grade
    }).get();

    if (existingClass.data.length > 0) {
      return createResponse(false, null, '班级名称已存在', 409);
    }

    const classId = generateId('class_');
    const now = new Date().toISOString();

    const newClass = {
      class_id: classId,
      name: class_data.name,
      grade: class_data.grade,
      description: class_data.description || '',
      student_count: 0,
      active_students: 0,
      is_active: true,
      created_by: userInfo.admin_id,
      create_time: now,
      update_time: now
    };

    await db.collection('classes').add({
      data: newClass
    });

    // 记录操作日志
    await db.collection('system_logs').add({
      data: {
        log_id: generateId('log_'),
        operator_id: userInfo.admin_id,
        operator_type: 'admin',
        action: 'create_class',
        target_type: 'class',
        target_id: classId,
        description: `创建班级: ${class_data.name}`,
        timestamp: now
      }
    });

    return createResponse(true, {
      class_id: classId,
      message: '班级创建成功'
    }, '班级创建成功');
    
  } catch (error) {
    console.error('createClass error:', error);
    return createResponse(false, null, '创建班级失败: ' + error.message, 500);
  }
});

// 更新班级信息（仅管理员可写）
const updateClass = requireAdminWrite(async (event, userInfo, { db, createResponse }) => {
  try {
    const { class_id, class_data } = event;
    
    if (!class_id || !class_data) {
      return createResponse(false, null, '缺少必要参数', 400);
    }

    // 验证班级存在
    const existingClass = await db.collection('classes').where({
      class_id: class_id
    }).get();

    if (existingClass.data.length === 0) {
      return createResponse(false, null, '班级不存在', 404);
    }

    const updateData = {
      ...class_data,
      update_time: new Date().toISOString(),
      updated_by: userInfo.admin_id
    };

    // 移除不允许更新的字段
    delete updateData.class_id;
    delete updateData.create_time;
    delete updateData.created_by;

    await db.collection('classes').where({
      class_id: class_id
    }).update({
      data: updateData
    });

    // 记录操作日志
    await db.collection('system_logs').add({
      data: {
        log_id: generateId('log_'),
        operator_id: userInfo.admin_id,
        operator_type: 'admin',
        action: 'update_class',
        target_type: 'class',
        target_id: class_id,
        description: `更新班级信息: ${class_id}`,
        details: updateData,
        timestamp: new Date().toISOString()
      }
    });

    return createResponse(true, {
      class_id: class_id,
      updated_fields: Object.keys(updateData)
    }, '班级信息更新成功');
    
  } catch (error) {
    console.error('updateClass error:', error);
    return createResponse(false, null, '更新班级失败: ' + error.message, 500);
  }
});

// 删除班级（仅管理员可写）
const deleteClass = requireAdminWrite(async (event, userInfo, { db, createResponse }) => {
  try {
    const { class_id } = event;
    
    if (!class_id) {
      return createResponse(false, null, '缺少班级ID', 400);
    }

    // 检查班级是否存在活跃的排座会话
    const activeSessions = await db.collection('arrangement_sessions').where({
      class_id: class_id,
      status: db.command.in(['collecting', 'arranging'])
    }).count();

    if (activeSessions.total > 0) {
      return createResponse(false, null, '该班级有进行中的排座会话，无法删除', 409);
    }

    // 软删除：标记为不活跃而不是物理删除
    await db.collection('classes').where({
      class_id: class_id
    }).update({
      data: {
        is_active: false,
        deleted_by: userInfo.admin_id,
        delete_time: new Date().toISOString()
      }
    });

    // 记录操作日志
    await db.collection('system_logs').add({
      data: {
        log_id: generateId('log_'),
        operator_id: userInfo.admin_id,
        operator_type: 'admin',
        action: 'delete_class',
        target_type: 'class',
        target_id: class_id,
        description: `删除班级: ${class_id}`,
        timestamp: new Date().toISOString()
      }
    });

    return createResponse(true, {
      class_id: class_id
    }, '班级删除成功');
    
  } catch (error) {
    console.error('deleteClass error:', error);
    return createResponse(false, null, '删除班级失败: ' + error.message, 500);
  }
});

/**
 * 通用数据库操作函数
 */

// 通用读取函数（所有人可读）
const genericRead = allowRead(async (event, userInfo, { db, createResponse }) => {
  try {
    const { collection, query = {}, fields = {}, limit = 50, skip = 0 } = event;
    
    if (!collection) {
      return createResponse(false, null, '缺少集合名称', 400);
    }

    let dbQuery = db.collection(collection);
    
    // 应用查询条件
    if (Object.keys(query).length > 0) {
      dbQuery = dbQuery.where(query);
    }
    
    // 应用字段过滤
    if (Object.keys(fields).length > 0) {
      dbQuery = dbQuery.field(fields);
    }
    
    // 应用分页
    if (skip > 0) {
      dbQuery = dbQuery.skip(skip);
    }
    
    if (limit > 0) {
      dbQuery = dbQuery.limit(Math.min(limit, 100)); // 最多100条
    }

    const result = await dbQuery.get();

    return createResponse(true, {
      data: result.data,
      count: result.data.length
    }, '查询成功');
    
  } catch (error) {
    console.error('genericRead error:', error);
    return createResponse(false, null, '查询失败: ' + error.message, 500);
  }
});

// 通用写入函数（仅管理员可写）
const genericWrite = requireAdminWrite(async (event, userInfo, { db, createResponse }) => {
  try {
    const { collection, operation, data, query = {} } = event;
    
    if (!collection || !operation || !data) {
      return createResponse(false, null, '缺少必要参数', 400);
    }

    let result;
    const now = new Date().toISOString();
    
    // 添加操作者信息
    data.updated_by = userInfo.admin_id;
    data.update_time = now;

    switch (operation) {
      case 'add':
        data.created_by = userInfo.admin_id;
        data.create_time = now;
        result = await db.collection(collection).add({ data });
        break;
        
      case 'update':
        result = await db.collection(collection).where(query).update({ data });
        break;
        
      case 'delete':
        // 软删除
        result = await db.collection(collection).where(query).update({
          data: {
            is_active: false,
            deleted_by: userInfo.admin_id,
            delete_time: now
          }
        });
        break;
        
      default:
        return createResponse(false, null, '不支持的操作类型', 400);
    }

    // 记录操作日志
    await db.collection('system_logs').add({
      data: {
        log_id: generateId('log_'),
        operator_id: userInfo.admin_id,
        operator_type: 'admin',
        action: `${operation}_${collection}`,
        target_type: collection,
        description: `${operation} operation on ${collection}`,
        details: { query, data },
        timestamp: now
      }
    });

    return createResponse(true, result, `${operation}操作成功`);
    
  } catch (error) {
    console.error('genericWrite error:', error);
    return createResponse(false, null, `${operation}操作失败: ` + error.message, 500);
  }
});

module.exports = {
  // 读取操作（所有人可读）
  getClassList,
  getClassroomList,
  getStudentInfo,
  genericRead,
  
  // 写入操作（仅管理员可写）
  createClass,
  updateClass,
  deleteClass,
  genericWrite
};