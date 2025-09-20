const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

/**
 * 初始化数据库和基础数据
 */
exports.main = async (event, context) => {
  try {
    console.log('开始初始化数据库...');
    
    const results = {
      collections_created: [],
      admin_created: false,
      sample_data_created: false,
      errors: []
    };
    
    // 1. 创建默认管理员
    try {
      const existingAdmin = await db.collection('admins')
        .where({ username: 'admin' })
        .get();

      if (existingAdmin.data.length === 0) {
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

        await db.collection('admins').add({
          data: defaultAdmin
        });
        
        results.admin_created = true;
        console.log('默认管理员创建成功');
      }
    } catch (error) {
      console.log('创建管理员错误:', error.message);
      results.errors.push('创建管理员失败: ' + error.message);
    }
    
    // 2. 创建示例班级
    try {
      const existingClass = await db.collection('classes')
        .where({ name: '示例班级' })
        .get();
        
      if (existingClass.data.length === 0) {
        const sampleClass = {
          class_id: 'class_sample_' + Date.now(),
          name: '示例班级',
          grade: '2024级',
          classroom_id: 'room_sample',
          student_count: 0,
          active_students: 0,
          is_active: true,
          create_time: new Date().toISOString()
        };

        await db.collection('classes').add({
          data: sampleClass
        });
        
        results.sample_data_created = true;
        console.log('示例班级创建成功');
      }
    } catch (error) {
      console.log('创建示例班级错误:', error.message);
      results.errors.push('创建示例班级失败: ' + error.message);
    }
    
    // 3. 创建示例教室
    try {
      const existingClassroom = await db.collection('classrooms')
        .where({ name: '示例教室' })
        .get();
        
      if (existingClassroom.data.length === 0) {
        const sampleClassroom = {
          classroom_id: 'room_sample_' + Date.now(),
          name: '示例教室',
          total_seats: 48,
          layout_config: {
            dimensions: { width: 8, height: 6 },
            seats: generateSeatLayout(6, 8)
          },
          is_active: true,
          create_time: new Date().toISOString()
        };

        await db.collection('classrooms').add({
          data: sampleClassroom
        });
        
        console.log('示例教室创建成功');
      }
    } catch (error) {
      console.log('创建示例教室错误:', error.message);
      results.errors.push('创建示例教室失败: ' + error.message);
    }

    return {
      success: true,
      message: '数据库初始化完成',
      data: results
    };

  } catch (error) {
    console.error('数据库初始化失败:', error);
    return {
      success: false,
      message: '数据库初始化失败: ' + error.message,
      data: null
    };
  }
};

/**
 * 生成座位布局
 */
function generateSeatLayout(rows, cols) {
  const seats = [];
  let seatId = 1;
  
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      seats.push({
        id: `seat_${seatId}`,
        row: row,
        col: col,
        x: col,
        y: row,
        is_available: true,
        special_type: null // 'podium', 'aisle', etc.
      });
      seatId++;
    }
  }
  
  return seats;
}