# 自动排座位系统数据库设计

## 概述

本文档定义了自动排座位系统的数据库结构，基于微信云开发的NoSQL数据库设计。

## 数据库集合（Collections）

### 1. students (学生信息集合)

**集合名称**: `students`

**字段结构**:
```javascript
{
  _id: "auto_generated_id",              // 系统自动生成
  student_id: "stu_20240001",            // 学生唯一标识
  name: "张三",                          // 学生姓名
  student_number: "202401001",           // 学号
  class_id: "cs2024_1",                  // 班级标识
  wx_openid: "wx_openid_string",         // 微信OpenID
  is_active: true,                       // 是否在校
  special_needs: {                       // 特殊需求（JSON对象）
    vision_impaired: false,              // 视力障碍
    hearing_impaired: false,             // 听力障碍
    height_tall: false,                  // 身高较高
    other_requirements: "需要靠近讲台"    // 其他需求
  },
  create_time: "2024-12-01T10:00:00Z",   // 创建时间
  update_time: "2024-12-01T10:00:00Z"    // 更新时间
}
```

**索引**:
- `student_id` (唯一索引)
- `wx_openid` (唯一索引)
- `class_id` (普通索引)
- `student_number` (唯一索引)

### 2. classrooms (教室信息集合)

**集合名称**: `classrooms`

**字段结构**:
```javascript
{
  _id: "auto_generated_id",
  classroom_id: "room_001",              // 教室唯一标识
  name: "A101教室",                      // 教室名称
  total_seats: 48,                       // 总座位数
  layout_config: {                       // 教室布局配置
    dimensions: {
      width: 12,                         // 宽度（座位数）
      height: 8                          // 高度（排数）
    },
    seats: [                             // 座位数组
      {
        seat_id: "seat_1_1",
        position: { row: 1, col: 1 },
        is_available: true,
        is_fixed: false,
        fixed_student_id: null
      }
      // ... 更多座位
    ],
    elements: {                          // 教室元素
      podium: { x: 6, y: 0, width: 4, height: 1 },
      door: { x: 0, y: 4 },
      aisles: [
        { start: { row: 0, col: 6 }, end: { row: 8, col: 6 } }
      ]
    }
  },
  create_time: "2024-12-01T10:00:00Z",
  update_time: "2024-12-01T10:00:00Z"
}
```

**索引**:
- `classroom_id` (唯一索引)

### 3. arrangement_sessions (排座会话集合)

**集合名称**: `arrangement_sessions`

**字段结构**:
```javascript
{
  _id: "auto_generated_id",
  session_id: "session_20241201_001",    // 会话唯一标识
  admin_id: "admin_001",                 // 创建管理员ID
  classroom_id: "room_001",              // 教室ID
  class_id: "cs2024_1",                  // 班级ID
  title: "2024年12月期末排座",            // 排座标题
  deadline: "2024-12-05T18:00:00Z",      // 意愿收集截止时间
  status: "collecting",                   // 状态：collecting/arranging/completed/published
  algorithm_params: {                     // 算法参数
    wish_weight: 0.4,                    // 学生意愿权重
    teaching_weight: 0.3,                // 教学需求权重
    fairness_weight: 0.2,                // 公平性权重
    constraint_weight: 0.1,              // 约束条件权重
    max_iterations: 1000,                // 最大迭代次数
    min_satisfaction: 0.7,               // 最低满意度阈值
    enable_random_fallback: true         // 启用随机兜底
  },
  statistics: {                          // 统计信息
    total_students: 45,
    submitted_wishes: 42,
    completion_rate: 0.93
  },
  create_time: "2024-12-01T10:00:00Z",
  update_time: "2024-12-01T15:30:00Z"
}
```

**索引**:
- `session_id` (唯一索引)
- `class_id` (普通索引)
- `status` (普通索引)

### 4. wishes (意愿信息集合)

**集合名称**: `wishes`

**字段结构**:
```javascript
{
  _id: "auto_generated_id",
  wish_id: "wish_20241201_001",          // 意愿唯一标识
  student_id: "stu_20240001",            // 学生ID
  session_id: "session_20241201_001",    // 排座会话ID
  preferred_seats: [                      // 期望座位列表
    { seat_id: "seat_1_1", priority: 1 },
    { seat_id: "seat_1_2", priority: 2 }
  ],
  avoided_seats: [                        // 不期望座位列表
    { seat_id: "seat_5_1" },
    { seat_id: "seat_5_2" }
  ],
  preferred_neighbors: [                  // 期望邻座列表
    { 
      student_id: "stu_20240002", 
      name: "李四",
      relationship: "study_partner"        // 关系类型：friend/study_partner/roommate
    }
  ],
  avoided_neighbors: [                    // 不期望邻座列表
    { 
      student_id: "stu_20240003", 
      name: "王五",
      reason: "personality_conflict"       // 原因
    }
  ],
  special_requirements: "需要靠近讲台，视力较差", // 特殊需求描述
  submit_time: "2024-12-01T10:30:00Z",    // 提交时间
  update_time: "2024-12-01T15:45:00Z",    // 更新时间
  version: 2                              // 版本号（修改次数）
}
```

**索引**:
- `wish_id` (唯一索引)
- `student_id, session_id` (复合唯一索引)
- `session_id` (普通索引)

### 5. seat_assignments (座位分配结果集合)

**集合名称**: `seat_assignments`

**字段结构**:
```javascript
{
  _id: "auto_generated_id",
  assignment_id: "assign_20241201_001",  // 分配唯一标识
  session_id: "session_20241201_001",    // 排座会话ID
  student_id: "stu_20240001",            // 学生ID
  seat_id: "seat_1_1",                   // 座位ID
  position: { row: 1, col: 1 },          // 座位位置
  satisfaction_score: 0.85,              // 满意度得分
  assignment_reasons: [                   // 分配原因
    "preferred_seat_matched",
    "preferred_neighbor_nearby"
  ],
  manual_adjusted: false,                 // 是否手动调整过
  adjust_history: [                       // 调整历史
    {
      from_seat: "seat_1_2",
      to_seat: "seat_1_1",
      reason: "管理员手动调整",
      adjust_time: "2024-12-01T16:30:00Z"
    }
  ],
  assign_time: "2024-12-01T16:00:00Z",    // 分配时间
  update_time: "2024-12-01T16:00:00Z"     // 更新时间
}
```

**索引**:
- `assignment_id` (唯一索引)
- `session_id, student_id` (复合唯一索引)
- `session_id` (普通索引)

### 6. admins (管理员信息集合)

**集合名称**: `admins`

**字段结构**:
```javascript
{
  _id: "auto_generated_id",
  admin_id: "admin_001",                 // 管理员唯一标识
  username: "teacher_zhang",             // 用户名
  name: "张老师",                        // 姓名
  wx_openid: "wx_admin_openid",          // 微信OpenID
  role: "seat_manager",                  // 角色：seat_manager/admin
  permissions: [                         // 权限列表
    "create_session",
    "manage_students",
    "execute_arrangement",
    "manual_adjust"
  ],
  class_ids: ["cs2024_1", "cs2024_2"],   // 管理的班级列表
  is_active: true,                       // 是否启用
  create_time: "2024-12-01T10:00:00Z",
  update_time: "2024-12-01T10:00:00Z"
}
```

**索引**:
- `admin_id` (唯一索引)
- `username` (唯一索引)
- `wx_openid` (唯一索引)

### 7. classes (班级信息集合)

**集合名称**: `classes`

**字段结构**:
```javascript
{
  _id: "auto_generated_id",
  class_id: "cs2024_1",                  // 班级唯一标识
  name: "计算机科学与技术2024级1班",       // 班级名称
  grade: "2024",                         // 年级
  major: "计算机科学与技术",              // 专业
  total_students: 45,                    // 学生总数
  active_students: 43,                   // 在校学生数
  default_classroom: "room_001",         // 默认教室
  head_teacher: "admin_001",             // 班主任ID
  create_time: "2024-09-01T10:00:00Z",
  update_time: "2024-12-01T10:00:00Z"
}
```

**索引**:
- `class_id` (唯一索引)

### 8. system_logs (系统日志集合)

**集合名称**: `system_logs`

**字段结构**:
```javascript
{
  _id: "auto_generated_id",
  log_id: "log_20241201_001",            // 日志唯一标识
  user_id: "stu_20240001",               // 操作用户ID
  user_type: "student",                  // 用户类型：student/admin
  action: "submit_wish",                 // 操作类型
  session_id: "session_20241201_001",    // 相关会话ID（可选）
  details: {                             // 操作详情
    old_data: {},
    new_data: {},
    ip_address: "192.168.1.100"
  },
  result: "success",                     // 操作结果：success/failed/error
  error_message: null,                   // 错误信息
  create_time: "2024-12-01T10:30:00Z"
}
```

**索引**:
- `user_id` (普通索引)
- `action` (普通索引)
- `create_time` (普通索引)

## 数据关系说明

### 核心关系图
```
Students (1) ←→ (N) Wishes ←→ (1) Sessions
    ↓                              ↓
    (N)                           (1)
    ↓                              ↓
SeatAssignments ←→ (1) Seats ←→ (1) Classrooms
```

### 关系约束
1. **一对多关系**：
   - 一个学生可以有多个意愿记录（不同会话）
   - 一个排座会话包含多个学生意愿
   - 一个教室包含多个座位

2. **一对一关系**：
   - 一个学生在一个会话中只能有一个意愿记录
   - 一个座位在一个会话中只能分配给一个学生

3. **多对多关系**：
   - 学生和班级（一个学生可能转班，一个班级有多个学生）
   - 管理员和班级（一个管理员可以管理多个班级）

## 数据完整性规则

### 引用完整性
- `wishes.student_id` 必须存在于 `students.student_id`
- `wishes.session_id` 必须存在于 `arrangement_sessions.session_id`
- `seat_assignments.student_id` 必须存在于 `students.student_id`
- `seat_assignments.session_id` 必须存在于 `arrangement_sessions.session_id`

### 业务规则
- 学生在同一个会话中只能有一个有效的意愿记录
- 座位在同一个会话中只能分配给一个学生
- 意愿提交时间必须在会话截止时间之前
- 排座结果发布后，不允许修改意愿

### 数据验证规则
- 学号格式验证：^[0-9]{9,12}$
- 微信OpenID格式验证：以wx开头的字符串
- 座位位置坐标必须在教室布局范围内
- 权重参数总和必须等于1.0

## 性能优化建议

### 查询优化
1. 为频繁查询的字段创建索引
2. 使用复合索引优化多字段查询
3. 避免全表扫描，使用限制条件

### 存储优化
1. 定期清理过期的日志数据
2. 对历史数据进行归档处理
3. 合理设计文档结构，避免嵌套过深

### 并发控制
1. 使用乐观锁控制并发修改
2. 关键操作添加事务处理
3. 合理设置数据库连接池大小