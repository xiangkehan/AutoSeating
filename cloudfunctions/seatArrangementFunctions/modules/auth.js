// modules/auth.js - 认证授权模块

/**
 * 微信授权登录
 */
const wxLogin = async (event, { db, getWXContext, generateToken, generateId, createResponse }) => {
  try {
    const { code, userInfo } = event;
    
    if (!code) {
      return createResponse(false, null, '缺少微信授权码', 400);
    }
    
    // 获取微信用户信息
    const wxContext = getWXContext();
    const { openid } = wxContext;
    
    if (!openid) {
      return createResponse(false, null, '获取微信用户信息失败', 400);
    }
    
    // 查找或创建学生记录
    let student = await db.collection('students').where({
      wx_openid: openid
    }).get();
    
    let studentData;
    
    if (student.data.length === 0) {
      // 新用户，创建学生记录
      const studentId = generateId('stu_');
      const newStudent = {
        student_id: studentId,
        name: userInfo?.nickName || '',
        student_number: '',
        class_id: '',
        wx_openid: openid,
        is_active: true,
        special_needs: {
          vision_impaired: false,
          hearing_impaired: false,
          height_tall: false,
          other_requirements: ''
        },
        personal_info: {
          nickName: userInfo?.nickName || '',
          avatarUrl: userInfo?.avatarUrl || '',
          gender: userInfo?.gender || 0
        },
        create_time: new Date().toISOString(),
        update_time: new Date().toISOString()
      };
      
      await db.collection('students').add({
        data: newStudent
      });
      
      studentData = newStudent;
    } else {
      // 已存在用户，更新微信信息
      studentData = student.data[0];
      
      // 更新微信用户信息
      await db.collection('students').doc(student.data[0]._id).update({
        data: {
          'personal_info.nickName': userInfo?.nickName || studentData.personal_info?.nickName || '',
          'personal_info.avatarUrl': userInfo?.avatarUrl || studentData.personal_info?.avatarUrl || '',
          'personal_info.gender': userInfo?.gender || studentData.personal_info?.gender || 0,
          update_time: new Date().toISOString()
        }
      });
    }
    
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
    
    // 生成JWT令牌
    const tokenPayload = {
      student_id: studentData.student_id,
      openid: openid,
      role: 'student',
      class_id: studentData.class_id
    };
    
    const token = generateToken(tokenPayload, '7d'); // 7天有效期
    
    // 构建用户档案
    const userProfile = {
      openid: openid,
      student_id: studentData.student_id,
      name: studentData.name,
      student_number: studentData.student_number,
      role: 'student',
      class_id: studentData.class_id,
      class_name: className,
      avatarUrl: studentData.personal_info?.avatarUrl || '',
      special_needs: studentData.special_needs
    };
    
    return createResponse(true, {
      token: token,
      userProfile: userProfile,
      expiresIn: 7 * 24 * 60 * 60 // 7天，秒为单位
    }, '登录成功');
    
  } catch (error) {
    console.error('wxLogin error:', error);
    return createResponse(false, null, '登录失败: ' + error.message, 500);
  }
};

/**
 * 管理员登录
 */
const adminLogin = async (event, { db, generateToken, createResponse }) => {
  try {
    const { username, password, loginType } = event;
    
    if (!username || !password) {
      return createResponse(false, null, '用户名和密码不能为空', 400);
    }
    
    // 查找管理员
    const admin = await db.collection('admins').where({
      username: username,
      is_active: true
    }).get();
    
    if (admin.data.length === 0) {
      return createResponse(false, null, '用户名或密码错误', 401);
    }
    
    const adminData = admin.data[0];
    
    // 验证密码 (这里简化处理，实际应该使用加密密码)
    if (adminData.password !== password) {
      return createResponse(false, null, '用户名或密码错误', 401);
    }
    
    // 获取管理的班级信息
    const classIds = adminData.class_ids || [];
    let classNames = [];
    
    if (classIds.length > 0) {
      const classes = await db.collection('classes').where({
        class_id: db.command.in(classIds)
      }).get();
      
      classNames = classes.data.map(cls => cls.name);
    }
    
    // 生成JWT令牌
    const tokenPayload = {
      admin_id: adminData.admin_id,
      username: adminData.username,
      role: adminData.role,
      class_ids: classIds
    };
    
    const token = generateToken(tokenPayload, '8h'); // 8小时有效期
    
    // 构建管理员档案
    const adminProfile = {
      admin_id: adminData.admin_id,
      name: adminData.name,
      username: adminData.username,
      role: adminData.role,
      permissions: adminData.permissions || [],
      class_ids: classIds,
      class_names: classNames
    };
    
    // 记录登录日志
    await db.collection('system_logs').add({
      data: {
        log_id: `log_${Date.now()}`,
        user_id: adminData.admin_id,
        user_type: 'admin',
        action: 'admin_login',
        details: {
          username: username,
          login_type: loginType
        },
        result: 'success',
        create_time: new Date().toISOString()
      }
    });
    
    return createResponse(true, {
      token: token,
      adminProfile: adminProfile,
      expiresIn: 8 * 60 * 60 // 8小时，秒为单位
    }, '登录成功');
    
  } catch (error) {
    console.error('adminLogin error:', error);
    return createResponse(false, null, '登录失败: ' + error.message, 500);
  }
};

/**
 * 刷新令牌
 */
const refreshToken = async (event, { verifyToken, generateToken, createResponse }) => {
  try {
    const { refreshToken } = event;
    
    if (!refreshToken) {
      return createResponse(false, null, '缺少刷新令牌', 400);
    }
    
    // 验证刷新令牌
    const tokenResult = verifyToken(refreshToken);
    if (!tokenResult.success) {
      return createResponse(false, null, '刷新令牌无效', 401);
    }
    
    // 生成新的访问令牌
    const newToken = generateToken(tokenResult.data, '2h');
    
    return createResponse(true, {
      token: newToken,
      expiresIn: 2 * 60 * 60 // 2小时
    }, '令牌刷新成功');
    
  } catch (error) {
    console.error('refreshToken error:', error);
    return createResponse(false, null, '刷新令牌失败: ' + error.message, 500);
  }
};

module.exports = {
  wxLogin,
  adminLogin,
  refreshToken
};