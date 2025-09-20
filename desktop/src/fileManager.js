// 文件导入导出管理器
const XLSX = require('xlsx');
const fs = require('fs-extra');
const path = require('path');

class FileManager {
  constructor(localDB) {
    this.localDB = localDB;
  }

  // 导入Excel学生数据
  async importStudentsFromExcel(filePath) {
    try {
      // 读取Excel文件
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // 转换为JSON数据
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      // 数据验证和转换
      const students = [];
      const errors = [];
      
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        const rowNum = i + 2; // Excel行号（从2开始，因为有表头）
        
        try {
          const student = this.validateStudentData(row, rowNum);
          students.push(student);
        } catch (error) {
          errors.push(`第${rowNum}行: ${error.message}`);
        }
      }
      
      if (errors.length > 0) {
        return {
          success: false,
          message: '数据验证失败',
          errors: errors
        };
      }
      
      // 批量导入到数据库
      await this.localDB.batchInsert('students', students);
      
      return {
        success: true,
        message: `成功导入 ${students.length} 条学生数据`,
        count: students.length
      };
    } catch (error) {
      console.error('导入Excel文件失败:', error);
      return {
        success: false,
        message: '文件读取失败: ' + error.message
      };
    }
  }

  // 验证学生数据
  validateStudentData(row, rowNum) {
    const requiredFields = ['姓名', '学号', '班级'];
    
    // 检查必填字段
    for (const field of requiredFields) {
      if (!row[field] || String(row[field]).trim() === '') {
        throw new Error(`缺少必填字段: ${field}`);
      }
    }
    
    // 生成学生ID
    const studentId = `student_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      student_id: studentId,
      name: String(row['姓名']).trim(),
      student_number: String(row['学号']).trim(),
      class_id: String(row['班级']).trim(),
      contact_info: row['联系方式'] ? String(row['联系方式']).trim() : '',
      special_needs: row['特殊需求'] ? String(row['特殊需求']).trim() : '',
      is_active: 1,
      create_time: new Date().toISOString(),
      sync_status: 0
    };
  }

  // 导入教室布局
  async importClassroomFromExcel(filePath) {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      const classrooms = [];
      const errors = [];
      
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        const rowNum = i + 2;
        
        try {
          const classroom = this.validateClassroomData(row, rowNum);
          classrooms.push(classroom);
        } catch (error) {
          errors.push(`第${rowNum}行: ${error.message}`);
        }
      }
      
      if (errors.length > 0) {
        return {
          success: false,
          message: '数据验证失败',
          errors: errors
        };
      }
      
      await this.localDB.batchInsert('classrooms', classrooms);
      
      return {
        success: true,
        message: `成功导入 ${classrooms.length} 个教室`,
        count: classrooms.length
      };
    } catch (error) {
      console.error('导入教室数据失败:', error);
      return {
        success: false,
        message: '文件读取失败: ' + error.message
      };
    }
  }

  // 验证教室数据
  validateClassroomData(row, rowNum) {
    const requiredFields = ['教室名称', '座位总数', '行数', '列数'];
    
    for (const field of requiredFields) {
      if (!row[field]) {
        throw new Error(`缺少必填字段: ${field}`);
      }
    }
    
    const rows = parseInt(row['行数']);
    const cols = parseInt(row['列数']);
    const totalSeats = parseInt(row['座位总数']);
    
    if (isNaN(rows) || isNaN(cols) || isNaN(totalSeats)) {
      throw new Error('数值字段格式错误');
    }
    
    // 生成座位布局
    const seats = [];
    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        seats.push({
          id: `seat_${r}_${c}`,
          row: r,
          col: c,
          position: { x: c * 60, y: r * 60 },
          is_available: true
        });
      }
    }
    
    const classroomId = `classroom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      classroom_id: classroomId,
      name: String(row['教室名称']).trim(),
      total_seats: totalSeats,
      layout_config: JSON.stringify({
        dimensions: { width: cols, height: rows },
        seats: seats,
        elements: {
          podium: { position: { x: cols * 30, y: 30 } },
          doors: [{ position: { x: 0, y: rows * 30 } }]
        }
      }),
      create_time: new Date().toISOString(),
      sync_status: 0
    };
  }

  // 导出排座结果为Excel
  async exportSeatingResultToExcel(sessionId, filePath) {
    try {
      // 获取排座结果数据
      const assignments = await this.localDB.querySQL(`
        SELECT 
          sa.student_id,
          sa.seat_id,
          sa.seat_position,
          s.name as student_name,
          s.student_number,
          s.class_id,
          sa.assignment_time
        FROM seat_assignments sa
        LEFT JOIN students s ON sa.student_id = s.student_id
        WHERE sa.session_id = ?
        ORDER BY sa.seat_id
      `, [sessionId]);
      
      if (assignments.length === 0) {
        return {
          success: false,
          message: '没有找到排座结果数据'
        };
      }
      
      // 准备Excel数据
      const excelData = assignments.map(assignment => ({
        '学生姓名': assignment.student_name,
        '学号': assignment.student_number,
        '班级': assignment.class_id,
        '座位编号': assignment.seat_id,
        '座位位置': assignment.seat_position,
        '分配时间': new Date(assignment.assignment_time).toLocaleString('zh-CN')
      }));
      
      // 创建工作簿
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      
      // 设置列宽
      worksheet['!cols'] = [
        { wch: 12 }, // 学生姓名
        { wch: 15 }, // 学号
        { wch: 15 }, // 班级
        { wch: 12 }, // 座位编号
        { wch: 15 }, // 座位位置
        { wch: 20 }  // 分配时间
      ];
      
      XLSX.utils.book_append_sheet(workbook, worksheet, '排座结果');
      
      // 写入文件
      XLSX.writeFile(workbook, filePath);
      
      return {
        success: true,
        message: `排座结果已导出到: ${filePath}`,
        filePath: filePath
      };
    } catch (error) {
      console.error('导出排座结果失败:', error);
      return {
        success: false,
        message: '导出失败: ' + error.message
      };
    }
  }

  // 导出学生数据为Excel
  async exportStudentsToExcel(filePath, classId = null) {
    try {
      let sql = 'SELECT * FROM students WHERE is_active = 1';
      let params = [];
      
      if (classId) {
        sql += ' AND class_id = ?';
        params.push(classId);
      }
      
      sql += ' ORDER BY class_id, student_number';
      
      const students = await this.localDB.querySQL(sql, params);
      
      if (students.length === 0) {
        return {
          success: false,
          message: '没有找到学生数据'
        };
      }
      
      const excelData = students.map(student => ({
        '姓名': student.name,
        '学号': student.student_number,
        '班级': student.class_id,
        '联系方式': student.contact_info || '',
        '特殊需求': student.special_needs || '',
        '创建时间': new Date(student.create_time).toLocaleString('zh-CN')
      }));
      
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      
      worksheet['!cols'] = [
        { wch: 12 }, // 姓名
        { wch: 15 }, // 学号
        { wch: 15 }, // 班级
        { wch: 20 }, // 联系方式
        { wch: 30 }, // 特殊需求
        { wch: 20 }  // 创建时间
      ];
      
      XLSX.utils.book_append_sheet(workbook, worksheet, '学生数据');
      XLSX.writeFile(workbook, filePath);
      
      return {
        success: true,
        message: `学生数据已导出到: ${filePath}`,
        count: students.length,
        filePath: filePath
      };
    } catch (error) {
      console.error('导出学生数据失败:', error);
      return {
        success: false,
        message: '导出失败: ' + error.message
      };
    }
  }

  // 生成座位图PNG
  async generateSeatingChart(sessionId, outputPath) {
    try {
      // 获取排座数据
      const assignments = await this.localDB.querySQL(`
        SELECT 
          sa.seat_id,
          sa.seat_position,
          s.name as student_name
        FROM seat_assignments sa
        LEFT JOIN students s ON sa.student_id = s.student_id
        WHERE sa.session_id = ?
      `, [sessionId]);
      
      // 获取教室布局
      const session = await this.localDB.getSQL(
        'SELECT classroom_id FROM arrangement_sessions WHERE session_id = ?',
        [sessionId]
      );
      
      if (!session) {
        throw new Error('找不到排座会话');
      }
      
      const classroom = await this.localDB.getSQL(
        'SELECT layout_config FROM classrooms WHERE classroom_id = ?',
        [session.classroom_id]
      );
      
      if (!classroom) {
        throw new Error('找不到教室信息');
      }
      
      const layoutConfig = JSON.parse(classroom.layout_config);
      
      // 生成座位图HTML
      const htmlContent = this.generateSeatingChartHTML(layoutConfig, assignments);
      
      // 写入临时HTML文件
      const tempHtmlPath = path.join(path.dirname(outputPath), 'temp_seating_chart.html');
      await fs.writeFile(tempHtmlPath, htmlContent);
      
      return {
        success: true,
        message: '座位图已生成',
        htmlPath: tempHtmlPath
      };
    } catch (error) {
      console.error('生成座位图失败:', error);
      return {
        success: false,
        message: '生成失败: ' + error.message
      };
    }
  }

  // 生成座位图HTML
  generateSeatingChartHTML(layoutConfig, assignments) {
    const { dimensions, seats } = layoutConfig;
    const assignmentMap = new Map();
    
    assignments.forEach(assignment => {
      assignmentMap.set(assignment.seat_id, assignment.student_name);
    });
    
    let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>座位图</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .classroom { 
            position: relative; 
            width: ${dimensions.width * 80}px; 
            height: ${dimensions.height * 80}px;
            border: 2px solid #333;
            margin: 20px auto;
        }
        .podium {
            position: absolute;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            width: 200px;
            height: 40px;
            background: #333;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
        }
        .seat {
            position: absolute;
            width: 60px;
            height: 60px;
            border: 1px solid #ccc;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            background: #f9f9f9;
        }
        .seat.occupied {
            background: #4CAF50;
            color: white;
        }
        .seat-id {
            font-size: 8px;
            color: #666;
        }
        .student-name {
            font-weight: bold;
            font-size: 9px;
            text-align: center;
        }
    </style>
</head>
<body>
    <h2 style="text-align: center;">班级座位图</h2>
    <div class="classroom">
        <div class="podium">讲台</div>
`;

    // 添加座位
    seats.forEach(seat => {
      const studentName = assignmentMap.get(seat.id);
      const isOccupied = !!studentName;
      
      html += `
        <div class="seat ${isOccupied ? 'occupied' : ''}" 
             style="left: ${seat.position.x}px; top: ${seat.position.y + 60}px;">
            <div class="seat-id">${seat.id}</div>
            ${isOccupied ? `<div class="student-name">${studentName}</div>` : ''}
        </div>
      `;
    });

    html += `
    </div>
    <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #666;">
        生成时间: ${new Date().toLocaleString('zh-CN')}
    </div>
</body>
</html>
`;

    return html;
  }

  // 创建数据备份
  async createBackup(backupPath) {
    try {
      const tables = [
        'students', 'classrooms', 'arrangement_sessions', 
        'wishes', 'seat_assignments', 'admins', 'classes'
      ];
      
      const backupData = {};
      
      for (const table of tables) {
        const data = await this.localDB.querySQL(`SELECT * FROM ${table}`);
        backupData[table] = data;
      }
      
      const backupContent = JSON.stringify(backupData, null, 2);
      await fs.writeFile(backupPath, backupContent);
      
      return {
        success: true,
        message: `数据备份已创建: ${backupPath}`,
        filePath: backupPath
      };
    } catch (error) {
      console.error('创建备份失败:', error);
      return {
        success: false,
        message: '备份失败: ' + error.message
      };
    }
  }

  // 恢复数据备份
  async restoreBackup(backupPath) {
    try {
      const backupContent = await fs.readFile(backupPath, 'utf8');
      const backupData = JSON.parse(backupContent);
      
      // 清空现有数据并恢复
      for (const [table, data] of Object.entries(backupData)) {
        await this.localDB.executeSQL(`DELETE FROM ${table}`);
        
        if (data.length > 0) {
          await this.localDB.batchInsert(table, data);
        }
      }
      
      return {
        success: true,
        message: '数据恢复完成'
      };
    } catch (error) {
      console.error('恢复备份失败:', error);
      return {
        success: false,
        message: '恢复失败: ' + error.message
      };
    }
  }
}

module.exports = FileManager;