/**
 * 离线排座算法引擎
 * 适用于桌面端离线环境的座位分配算法
 */

class OfflineSeatArrangementEngine {
  constructor(config = {}) {
    // 算法参数配置
    this.config = {
      wishWeight: config.wishWeight || 0.4,
      teachingWeight: config.teachingWeight || 0.3,
      fairnessWeight: config.fairnessWeight || 0.2,
      constraintWeight: config.constraintWeight || 0.1,
      maxIterations: config.maxIterations || 1000,
      minSatisfaction: config.minSatisfaction || 0.7,
      enableRandomFallback: config.enableRandomFallback !== false
    };
    
    // 运行时数据
    this.students = [];
    this.classroom = null;
    this.wishes = [];
    this.currentAssignment = new Map();
    this.seatOccupancy = new Map();
    this.satisfactionScores = new Map();
    this.conflicts = [];
    this.iterations = 0;
    this.executionLog = [];
  }

  /**
   * 设置学生数据
   * @param {Array} students 学生列表
   */
  setStudents(students) {
    this.students = students.map(student => ({
      student_id: student.student_id || student.id,
      name: student.name,
      special_needs: student.special_needs || {},
      height_category: this.categorizeHeight(student.height),
      ...student
    }));
    this.log('设置学生数据', `总计 ${this.students.length} 名学生`);
  }

  /**
   * 设置教室布局
   * @param {Object} classroom 教室数据
   */
  setClassroom(classroom) {
    this.classroom = {
      classroom_id: classroom.classroom_id || classroom.id,
      name: classroom.name,
      layout: classroom.layout || {},
      seats: this.processSeats(classroom.seats || []),
      capacity: classroom.capacity || 50
    };
    this.log('设置教室布局', `教室: ${this.classroom.name}, 座位数: ${this.classroom.seats.length}`);
  }

  /**
   * 设置意愿数据
   * @param {Array} wishes 意愿列表
   */
  setWishes(wishes) {
    this.wishes = wishes.map(wish => ({
      student_id: wish.student_id,
      admin_id: wish.admin_id,
      user_type: wish.user_type || 'student',
      preferred_seats: wish.preferred_seats || [],
      avoid_seats: wish.avoid_seats || [],
      preferred_neighbors: wish.preferred_neighbors || [],
      avoid_neighbors: wish.avoid_neighbors || [],
      special_requirements: wish.special_requirements || '',
      priority: wish.priority || (wish.user_type === 'admin' ? 'high' : 'normal'),
      ...wish
    }));
    this.log('设置意愿数据', `总计 ${this.wishes.length} 条意愿记录`);
  }

  /**
   * 执行排座算法
   * @returns {Promise<Object>} 排座结果
   */
  async execute() {
    return new Promise((resolve) => {
      try {
        this.log('开始执行排座算法');
        const startTime = Date.now();
        
        // 1. 数据预处理和验证
        if (!this.validateData()) {
          throw new Error('数据验证失败');
        }
        
        // 2. 初始化座位分配
        this.initializeAssignment();
        
        // 3. 执行迭代优化
        const optimizationResult = this.optimizeAssignment();
        
        // 4. 计算满意度
        const overallSatisfaction = this.calculateOverallSatisfaction();
        
        let finalAssignment;
        let usedFallback = false;
        
        // 5. 检查是否需要兜底策略
        if (!optimizationResult.success || overallSatisfaction < this.config.minSatisfaction) {
          this.log('算法结果不满意，启用随机兜底策略');
          finalAssignment = this.applyRandomFallback();
          usedFallback = true;
        } else {
          finalAssignment = this.exportAssignment();
        }
        
        const endTime = Date.now();
        const executionTime = (endTime - startTime) / 1000;
        
        const result = {
          success: true,
          assignment: finalAssignment,
          statistics: {
            totalStudents: this.students.length,
            successfulAssignments: finalAssignment.length,
            overallSatisfaction: this.calculateOverallSatisfaction(),
            executionTime: executionTime,
            usedFallback: usedFallback,
            iterations: this.iterations
          },
          algorithmDetails: {
            config: this.config,
            iterations: this.iterations,
            conflicts: this.conflicts.length,
            convergenceAchieved: optimizationResult.success
          },
          executionLog: this.executionLog
        };
        
        this.log('排座算法执行完成', `耗时: ${executionTime}秒`);
        resolve(result);
        
      } catch (error) {
        this.log('算法执行失败', error.message);
        
        // 失败时的兜底处理
        if (this.config.enableRandomFallback) {
          const fallbackAssignment = this.applyRandomFallback();
          resolve({
            success: true,
            assignment: fallbackAssignment,
            statistics: {
              totalStudents: this.students.length,
              successfulAssignments: fallbackAssignment.length,
              overallSatisfaction: 0.5,
              executionTime: 0,
              usedFallback: true,
              iterations: 0
            },
            error: error.message
          });
        } else {
          resolve({
            success: false,
            error: error.message,
            executionLog: this.executionLog
          });
        }
      }
    });
  }

  /**
   * 验证数据完整性
   */
  validateData() {
    if (!this.students || this.students.length === 0) {
      throw new Error('学生数据不能为空');
    }
    
    if (!this.classroom || !this.classroom.seats || this.classroom.seats.length === 0) {
      throw new Error('教室座位数据不能为空');
    }
    
    if (this.students.length > this.classroom.seats.length) {
      throw new Error('学生数量超过座位数量');
    }
    
    this.log('数据验证通过');
    return true;
  }

  /**
   * 初始化座位分配
   */
  initializeAssignment() {
    this.log('开始初始化座位分配');
    
    // 清空当前分配
    this.currentAssignment.clear();
    this.seatOccupancy.clear();
    
    // 按优先级排序学生（管理员优先）
    const sortedStudents = this.students.slice().sort((a, b) => {
      const aWish = this.wishes.find(w => w.student_id === a.student_id || w.admin_id === a.student_id);
      const bWish = this.wishes.find(w => w.student_id === b.student_id || w.admin_id === b.student_id);
      
      const aPriority = aWish?.priority === 'high' ? 1 : 0;
      const bPriority = bWish?.priority === 'high' ? 1 : 0;
      
      return bPriority - aPriority;
    });
    
    // 贪心算法初始分配
    for (const student of sortedStudents) {
      const bestSeat = this.findBestSeat(student);
      if (bestSeat) {
        this.assignSeat(student.student_id, bestSeat);
      }
    }
    
    this.log('初始分配完成', `已分配 ${this.currentAssignment.size} 个座位`);
  }

  /**
   * 为学生找到最佳座位
   */
  findBestSeat(student) {
    const availableSeats = this.classroom.seats.filter(seat => !this.seatOccupancy.has(seat.seat_id));
    
    if (availableSeats.length === 0) {
      return null;
    }
    
    const studentWish = this.wishes.find(w => 
      w.student_id === student.student_id || w.admin_id === student.student_id
    );
    
    let bestSeat = availableSeats[0];
    let bestScore = this.calculateSeatScore(student, bestSeat, studentWish);
    
    for (const seat of availableSeats) {
      const score = this.calculateSeatScore(student, seat, studentWish);
      if (score > bestScore) {
        bestScore = score;
        bestSeat = seat;
      }
    }
    
    return bestSeat;
  }

  /**
   * 计算座位评分
   */
  calculateSeatScore(student, seat, wish) {
    let score = 0;
    
    // 意愿权重
    if (wish) {
      if (wish.preferred_seats.includes(seat.seat_id)) {
        score += this.config.wishWeight * 1.0;
      }
      if (wish.avoid_seats.includes(seat.seat_id)) {
        score -= this.config.wishWeight * 0.8;
      }
    }
    
    // 教学权重（前排优先）
    const teachingScore = this.calculateTeachingScore(seat);
    score += this.config.teachingWeight * teachingScore;
    
    // 特殊需求权重
    const constraintScore = this.calculateConstraintScore(student, seat);
    score += this.config.constraintWeight * constraintScore;
    
    return score;
  }

  /**
   * 计算教学评分（前排优先）
   */
  calculateTeachingScore(seat) {
    const maxRow = Math.max(...this.classroom.seats.map(s => s.row));
    return (maxRow - seat.row + 1) / maxRow;
  }

  /**
   * 计算约束评分（特殊需求）
   */
  calculateConstraintScore(student, seat) {
    let score = 0.5; // 基础分
    
    // 视力不好的学生优先前排
    if (student.special_needs?.vision_impaired && seat.row <= 3) {
      score += 0.3;
    }
    
    // 听力不好的学生避免后排
    if (student.special_needs?.hearing_impaired && seat.row > 5) {
      score -= 0.2;
    }
    
    // 身高较高的学生避免前排
    if (student.height_category === 'tall' && seat.row <= 2) {
      score -= 0.2;
    }
    
    return score;
  }

  /**
   * 分配座位
   */
  assignSeat(studentId, seat) {
    this.currentAssignment.set(studentId, seat);
    this.seatOccupancy.set(seat.seat_id, studentId);
  }

  /**
   * 迭代优化算法
   */
  optimizeAssignment() {
    this.log('开始迭代优化');
    
    let improved = true;
    this.iterations = 0;
    
    while (improved && this.iterations < this.config.maxIterations) {
      improved = false;
      this.iterations++;
      
      // 尝试交换座位来提高整体满意度
      const students = Array.from(this.currentAssignment.keys());
      
      for (let i = 0; i < students.length - 1; i++) {
        for (let j = i + 1; j < students.length; j++) {
          if (this.shouldSwapSeats(students[i], students[j])) {
            this.swapSeats(students[i], students[j]);
            improved = true;
          }
        }
      }
      
      if (this.iterations % 100 === 0) {
        const satisfaction = this.calculateOverallSatisfaction();
        this.log(`迭代 ${this.iterations}`, `当前满意度: ${(satisfaction * 100).toFixed(1)}%`);
      }
    }
    
    const finalSatisfaction = this.calculateOverallSatisfaction();
    const success = finalSatisfaction >= this.config.minSatisfaction;
    
    this.log('优化完成', `最终满意度: ${(finalSatisfaction * 100).toFixed(1)}%, 迭代次数: ${this.iterations}`);
    
    return { success, satisfaction: finalSatisfaction };
  }

  /**
   * 判断是否应该交换两个学生的座位
   */
  shouldSwapSeats(studentId1, studentId2) {
    const currentSatisfaction = this.calculateSwapSatisfaction(studentId1, studentId2, false);
    const swappedSatisfaction = this.calculateSwapSatisfaction(studentId1, studentId2, true);
    
    return swappedSatisfaction > currentSatisfaction + 0.01; // 避免微小改进
  }

  /**
   * 计算交换座位的满意度
   */
  calculateSwapSatisfaction(studentId1, studentId2, swapped) {
    const seat1 = this.currentAssignment.get(studentId1);
    const seat2 = this.currentAssignment.get(studentId2);
    
    const student1 = this.students.find(s => s.student_id === studentId1);
    const student2 = this.students.find(s => s.student_id === studentId2);
    
    const wish1 = this.wishes.find(w => w.student_id === studentId1 || w.admin_id === studentId1);
    const wish2 = this.wishes.find(w => w.student_id === studentId2 || w.admin_id === studentId2);
    
    if (swapped) {
      return this.calculateSeatScore(student1, seat2, wish1) + 
             this.calculateSeatScore(student2, seat1, wish2);
    } else {
      return this.calculateSeatScore(student1, seat1, wish1) + 
             this.calculateSeatScore(student2, seat2, wish2);
    }
  }

  /**
   * 交换两个学生的座位
   */
  swapSeats(studentId1, studentId2) {
    const seat1 = this.currentAssignment.get(studentId1);
    const seat2 = this.currentAssignment.get(studentId2);
    
    // 更新分配
    this.currentAssignment.set(studentId1, seat2);
    this.currentAssignment.set(studentId2, seat1);
    
    // 更新占用状态
    this.seatOccupancy.set(seat1.seat_id, studentId2);
    this.seatOccupancy.set(seat2.seat_id, studentId1);
  }

  /**
   * 计算整体满意度
   */
  calculateOverallSatisfaction() {
    if (this.currentAssignment.size === 0) {
      return 0;
    }
    
    let totalScore = 0;
    let maxPossibleScore = 0;
    
    for (const [studentId, seat] of this.currentAssignment) {
      const student = this.students.find(s => s.student_id === studentId);
      const wish = this.wishes.find(w => w.student_id === studentId || w.admin_id === studentId);
      
      const score = this.calculateSeatScore(student, seat, wish);
      totalScore += Math.max(0, score); // 确保不是负分
      maxPossibleScore += 1.0; // 假设满分是1.0
    }
    
    return maxPossibleScore > 0 ? totalScore / maxPossibleScore : 0;
  }

  /**
   * 随机兜底策略
   */
  applyRandomFallback() {
    this.log('应用随机兜底策略');
    
    const availableSeats = [...this.classroom.seats];
    const assignment = [];
    
    // 随机打乱座位列表
    for (let i = availableSeats.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availableSeats[i], availableSeats[j]] = [availableSeats[j], availableSeats[i]];
    }
    
    // 随机分配
    for (let i = 0; i < Math.min(this.students.length, availableSeats.length); i++) {
      assignment.push({
        student_id: this.students[i].student_id,
        student_name: this.students[i].name,
        seat_id: availableSeats[i].seat_id,
        seat_position: `${availableSeats[i].row}排${availableSeats[i].col}座`,
        assignment_method: 'random_fallback'
      });
    }
    
    this.log('随机分配完成', `分配了 ${assignment.length} 个座位`);
    return assignment;
  }

  /**
   * 导出座位分配结果
   */
  exportAssignment() {
    const assignment = [];
    
    for (const [studentId, seat] of this.currentAssignment) {
      const student = this.students.find(s => s.student_id === studentId);
      
      assignment.push({
        student_id: studentId,
        student_name: student.name,
        seat_id: seat.seat_id,
        seat_position: `${seat.row}排${seat.col}座`,
        assignment_method: 'algorithm',
        satisfaction_score: this.calculateIndividualSatisfaction(studentId)
      });
    }
    
    return assignment;
  }

  /**
   * 计算个人满意度
   */
  calculateIndividualSatisfaction(studentId) {
    const seat = this.currentAssignment.get(studentId);
    const student = this.students.find(s => s.student_id === studentId);
    const wish = this.wishes.find(w => w.student_id === studentId || w.admin_id === studentId);
    
    const score = this.calculateSeatScore(student, seat, wish);
    return Math.max(0, Math.min(1, score)); // 限制在0-1之间
  }

  /**
   * 处理座位数据
   */
  processSeats(seats) {
    return seats.map(seat => ({
      seat_id: seat.seat_id || seat.id,
      row: seat.row,
      col: seat.col,
      position: seat.position || `${seat.row}排${seat.col}座`,
      is_available: seat.is_available !== false,
      ...seat
    })).filter(seat => seat.is_available);
  }

  /**
   * 身高分类
   */
  categorizeHeight(height) {
    if (!height) return 'normal';
    if (height > 175) return 'tall';
    if (height < 155) return 'short';
    return 'normal';
  }

  /**
   * 记录执行日志
   */
  log(action, details = '') {
    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      details
    };
    this.executionLog.push(logEntry);
    console.log(`[排座算法] ${action}: ${details}`);
  }

  /**
   * 获取算法配置
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * 更新算法配置
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.log('更新算法配置', JSON.stringify(newConfig));
  }
}

module.exports = {
  OfflineSeatArrangementEngine
};