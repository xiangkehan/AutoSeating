const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

/**
 * 初始化默认管理员账户
 */
exports.main = async (event, context) => {
  try {
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
        data: null
      };
    }

    // 创建默认管理员（根据项目记忆中的配置）
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

    const result = await db.collection('admins').add({
      data: defaultAdmin
    });

    // 同时创建一个示例班级（可选）
    const sampleClass = {
      class_id: 'class_sample_' + Date.now(),
      name: '示例班级',
      grade: '2024级',
      classroom_id: 'room_sample',
      student_count: 0,
      create_time: new Date().toISOString()
    };

    await db.collection('classes').add({
      data: sampleClass
    });

    // 创建示例教室（简化版本）
    const sampleClassroom = {
      classroom_id: 'room_sample_' + Date.now(),
      name: '示例教室',
      total_seats: 48,
      layout_config: {
        dimensions: { width: 8, height: 6 },
        seats: []
      },
      create_time: new Date().toISOString()
    };

    await db.collection('classrooms').add({
      data: sampleClassroom
    });

    return {
      success: true,
      message: '默认管理员创建成功',
      data: {
        username: defaultAdmin.username,
        password: defaultAdmin.password,
        role: defaultAdmin.role,
        admin_id: defaultAdmin.admin_id
      }
    };

  } catch (error) {
    console.error('初始化管理员失败:', error);
    return {
      success: false,
      message: '初始化失败: ' + error.message,
      data: null
    };
  }
};

/**
 * 生成座位布局
 * @param {number} rows 行数
 * @param {number} cols 列数
 * @returns {Array} 座位数组
 */
function generateSeatLayout(rows, cols) {
  const seats = [];
  for (let row = 1; row <= rows; row++) {
    for (let col = 1; col <= cols; col++) {
      seats.push({
        seat_id: `seat_${row}_${col}`,
        position: { row, col },
        coordinates: { x: col * 60, y: row * 60 },
        is_available: true,
        special_type: null
      });
    }
  }
  return seats;
}