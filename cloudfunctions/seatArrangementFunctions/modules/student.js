// modules/student.js - 学生相关模块

/**
 * 获取学生档案
 */
const getProfile = async (userInfo, { db, createResponse }) => {
  try {
    const { student_id } = userInfo;
    
    if (!student_id) {
      return createResponse(false, null, '用户信息不完整', 400);
    }
    
    // 查询学生信息
    const student = await db.collection('students').where({
      student_id: student_id
    }).get();
    
    if (student.data.length === 0) {
      return createResponse(false, null, '学生信息不存在', 404);
    }
    
    const studentData = student.data[0];
    
    // 获取班级信息
    let className = '';
    if (studentData.class_id) {
      const classInfo = await db.collection('classes').where({
        class_id: studentData.class_id
      }).get();
      
      if (classInfo.data.length > 0) {
        className = classInfo.data[0].name;
      }
    }
    
    // 构建返回数据
    const profileData = {
      student_id: studentData.student_id,
      name: studentData.name,
      student_number: studentData.student_number,
      class_id: studentData.class_id,
      class_name: className,
      special_needs: studentData.special_needs,
      is_active: studentData.is_active,
      avatarUrl: studentData.personal_info?.avatarUrl || ''
    };
    
    return createResponse(true, profileData, '获取成功');
    
  } catch (error) {
    console.error('getProfile error:', error);
    return createResponse(false, null, '获取学生档案失败: ' + error.message, 500);
  }
};

/**
 * 更新学生档案
 */
const updateProfile = async (event, userInfo, { db, createResponse }) => {
  try {
    const { profile_data } = event;
    const { student_id } = userInfo;
    
    if (!student_id || !profile_data) {
      return createResponse(false, null, '参数不完整', 400);
    }
    
    // 验证学号格式
    if (profile_data.student_number && !/^\\d{9,12}$/.test(profile_data.student_number)) {
      return createResponse(false, null, '学号格式不正确', 400);
    }
    
    // 检查学号是否已被使用
    if (profile_data.student_number) {
      const existingStudent = await db.collection('students').where({
        student_number: profile_data.student_number,
        student_id: db.command.neq(student_id)
      }).get();
      
      if (existingStudent.data.length > 0) {
        return createResponse(false, null, '学号已被使用', 409);
      }
    }
    
    // 验证班级是否存在
    if (profile_data.class_id) {
      const classInfo = await db.collection('classes').where({
        class_id: profile_data.class_id
      }).get();
      
      if (classInfo.data.length === 0) {
        return createResponse(false, null, '指定的班级不存在', 400);
      }
    }
    
    // 更新学生信息
    const updateData = {
      name: profile_data.name,
      student_number: profile_data.student_number,
      class_id: profile_data.class_id,
      special_needs: profile_data.special_needs,
      update_time: new Date().toISOString()
    };
    
    await db.collection('students').where({
      student_id: student_id
    }).update({
      data: updateData
    });
    
    // 获取更新后的完整信息
    const updatedStudent = await db.collection('students').where({
      student_id: student_id
    }).get();
    
    let className = '';
    if (profile_data.class_id) {
      const classInfo = await db.collection('classes').where({
        class_id: profile_data.class_id
      }).get();
      
      if (classInfo.data.length > 0) {
        className = classInfo.data[0].name;
      }
    }
    
    const studentData = updatedStudent.data[0];
    const userProfile = {
      student_id: studentData.student_id,
      name: studentData.name,
      student_number: studentData.student_number,
      class_id: studentData.class_id,
      class_name: className,
      special_needs: studentData.special_needs,
      avatarUrl: studentData.personal_info?.avatarUrl || ''
    };
    
    return createResponse(true, { userProfile }, '更新成功');
    
  } catch (error) {
    console.error('updateProfile error:', error);
    return createResponse(false, null, '更新学生档案失败: ' + error.message, 500);
  }
};

/**
 * 获取同班同学列表
 */
const getClassmates = async (userInfo, { db, createResponse }) => {
  try {
    const { class_id } = userInfo;
    
    if (!class_id) {
      return createResponse(false, null, '未绑定班级', 400);
    }
    
    // 查询同班同学
    const classmates = await db.collection('students').where({
      class_id: class_id,
      is_active: true
    }).field({
      student_id: true,
      name: true,
      student_number: true
    }).get();
    
    const classmatesData = classmates.data.map(student => ({
      student_id: student.student_id,
      name: student.name,
      student_number: student.student_number
    }));
    
    return createResponse(true, { classmates: classmatesData }, '获取成功');
    
  } catch (error) {
    console.error('getClassmates error:', error);
    return createResponse(false, null, '获取同学列表失败: ' + error.message, 500);
  }
};

/**
 * 获取班级列表
 */
const getClassList = async ({ db, createResponse }) => {
  try {
    // 查询所有活跃班级
    const classes = await db.collection('classes').where({
      active_students: db.command.gt(0)
    }).field({
      class_id: true,
      name: true,
      grade: true,
      major: true
    }).orderBy('grade', 'desc').orderBy('name', 'asc').get();
    
    const classData = classes.data.map(cls => ({
      class_id: cls.class_id,
      name: cls.name,
      grade: cls.grade,
      major: cls.major
    }));
    
    return createResponse(true, { classes: classData }, '获取成功');
    
  } catch (error) {
    console.error('getClassList error:', error);
    return createResponse(false, null, '获取班级列表失败: ' + error.message, 500);
  }
};

/**
 * 批量导入学生
 */
const importStudents = async (event, userInfo, { db, generateId, createResponse }) => {
  try {
    const { students_data, class_id } = event;
    
    // 权限检查：只有管理员可以导入
    if (userInfo.role !== 'admin' && userInfo.role !== 'seat_manager') {
      return createResponse(false, null, '权限不足', 403);
    }
    
    if (!students_data || !Array.isArray(students_data)) {
      return createResponse(false, null, '学生数据格式错误', 400);
    }
    
    // 验证班级存在
    if (class_id) {
      const classInfo = await db.collection('classes').where({
        class_id: class_id
      }).get();
      
      if (classInfo.data.length === 0) {
        return createResponse(false, null, '指定的班级不存在', 400);
      }
    }
    
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };
    
    // 批量处理学生数据
    for (const studentData of students_data) {
      try {
        // 验证必要字段
        if (!studentData.name || !studentData.student_number) {
          results.failed++;
          results.errors.push({
            student: studentData,
            error: '姓名和学号不能为空'
          });
          continue;
        }
        
        // 检查学号是否已存在
        const existingStudent = await db.collection('students').where({
          student_number: studentData.student_number
        }).get();
        
        if (existingStudent.data.length > 0) {
          results.failed++;
          results.errors.push({
            student: studentData,
            error: '学号已存在'
          });
          continue;
        }
        
        // 创建学生记录
        const newStudent = {
          student_id: generateId('stu_'),
          name: studentData.name,
          student_number: studentData.student_number,
          class_id: class_id,
          wx_openid: '',
          is_active: true,
          special_needs: {
            vision_impaired: false,
            hearing_impaired: false,
            height_tall: false,
            other_requirements: studentData.special_needs || ''
          },
          personal_info: {
            gender: studentData.gender || 0
          },
          create_time: new Date().toISOString(),
          update_time: new Date().toISOString()
        };
        
        await db.collection('students').add({
          data: newStudent
        });
        
        results.success++;
        
      } catch (error) {
        results.failed++;
        results.errors.push({
          student: studentData,
          error: error.message
        });
      }
    }
    
    return createResponse(true, results, `导入完成：成功${results.success}条，失败${results.failed}条`);
    
  } catch (error) {
    console.error('importStudents error:', error);
    return createResponse(false, null, '批量导入失败: ' + error.message, 500);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getClassmates,
  getClassList,
  importStudents
};