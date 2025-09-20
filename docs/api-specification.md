# 自动排座位系统 API 接口规范

## 概述

本文档定义了自动排座位系统的云函数API接口规范，基于微信云开发平台。

## 接口调用规范

### 调用方式
所有接口通过微信云函数 `seatArrangementFunctions` 统一调用：

```javascript
wx.cloud.callFunction({
  name: 'seatArrangementFunctions',
  data: {
    type: 'interfaceName',
    ...params
  }
})
```

### 通用响应格式
```javascript
{
  success: true,           // 请求是否成功
  code: 200,              // 状态码
  message: "操作成功",     // 响应消息
  data: {},               // 响应数据
  timestamp: 1701234567890 // 时间戳
}
```

### 错误码定义
| 错误码 | 说明 | 处理建议 |
|--------|------|----------|
| 200 | 操作成功 | - |
| 400 | 请求参数错误 | 检查参数格式和必填字段 |
| 401 | 未授权访问 | 重新登录获取授权 |
| 403 | 权限不足 | 联系管理员分配权限 |
| 404 | 资源不存在 | 确认资源ID是否正确 |
| 409 | 数据冲突 | 检查数据唯一性约束 |
| 429 | 请求过于频繁 | 降低请求频率 |
| 500 | 服务器内部错误 | 稍后重试或联系技术支持 |

## 认证授权接口

### 1. 微信授权登录
**接口名称**: `wxLogin`

**请求参数**:
```javascript
{
  type: "wxLogin",
  code: "wx_auth_code",        // 微信授权码
  userInfo: {                  // 用户信息
    nickName: "用户昵称",
    avatarUrl: "头像URL",
    gender: 1,                 // 性别 0未知 1男 2女
    city: "城市",
    province: "省份",
    country: "国家"
  }
}
```

**响应数据**:
```javascript
{
  success: true,
  code: 200,
  message: "登录成功",
  data: {
    token: "jwt_token_string",
    userProfile: {
      openid: "wx_openid",
      student_id: "stu_20240001",
      name: "张三",
      role: "student",           // student/admin
      class_id: "cs2024_1"
    },
    expiresIn: 7200             // token有效期（秒）
  }
}
```

### 2. 管理员登录
**接口名称**: `adminLogin`

**请求参数**:
```javascript
{
  type: "adminLogin",
  username: "teacher_zhang",   // 用户名
  password: "encrypted_password", // 加密后的密码
  loginType: "password"        // 登录方式：password/wx
}
```

**响应数据**:
```javascript
{
  success: true,
  code: 200,
  message: "登录成功",
  data: {
    token: "jwt_token_string",
    adminProfile: {
      admin_id: "admin_001",
      name: "张老师",
      role: "seat_manager",      // seat_manager/admin
      permissions: ["create_session", "manage_students"],
      class_ids: ["cs2024_1"]
    },
    expiresIn: 7200
  }
}
```

### 3. 刷新令牌
**接口名称**: `refreshToken`

**请求参数**:
```javascript
{
  type: "refreshToken",
  refreshToken: "refresh_token_string"
}
```

**响应数据**:
```javascript
{
  success: true,
  code: 200,
  message: "令牌刷新成功",
  data: {
    token: "new_jwt_token",
    expiresIn: 7200
  }
}
```

## 学生端接口

### 4. 获取学生信息
**接口名称**: `getStudentProfile`

**请求参数**:
```javascript
{
  type: "getStudentProfile",
  token: "jwt_token"
}
```

**响应数据**:
```javascript
{
  success: true,
  code: 200,
  message: "获取成功",
  data: {
    student_id: "stu_20240001",
    name: "张三",
    student_number: "202401001",
    class_id: "cs2024_1",
    class_name: "计算机科学与技术2024级1班",
    special_needs: {
      vision_impaired: false,
      hearing_impaired: false,
      other_requirements: ""
    },
    is_active: true
  }
}
```

### 5. 获取当前排座会话
**接口名称**: `getCurrentSession`

**请求参数**:
```javascript
{
  type: "getCurrentSession",
  token: "jwt_token",
  class_id: "cs2024_1"          // 可选，用于指定班级
}
```

**响应数据**:
```javascript
{
  success: true,
  code: 200,
  message: "获取成功",
  data: {
    session_id: "session_20241201_001",
    title: "2024年12月期末排座",
    status: "collecting",        // collecting/arranging/completed/published
    deadline: "2024-12-05T18:00:00Z",
    classroom: {
      classroom_id: "room_001",
      name: "A101教室",
      layout_config: {
        dimensions: { width: 12, height: 8 },
        seats: [
          {
            seat_id: "seat_1_1",
            position: { row: 1, col: 1 },
            is_available: true,
            is_fixed: false
          }
          // ... 更多座位
        ]
      }
    },
    my_wish_status: "submitted",  // not_submitted/submitted/expired
    can_modify: true              // 是否可以修改意愿
  }
}
```

### 6. 提交学生意愿
**接口名称**: `submitWish`

**请求参数**:
```javascript
{
  type: "submitWish",
  token: "jwt_token",
  session_id: "session_20241201_001",
  wish_data: {
    preferred_seats: [
      { seat_id: "seat_1_1", priority: 1 },
      { seat_id: "seat_1_2", priority: 2 }
    ],
    avoided_seats: [
      { seat_id: "seat_5_1" },
      { seat_id: "seat_5_2" }
    ],
    preferred_neighbors: [
      { 
        student_id: "stu_20240002",
        name: "李四",
        relationship: "study_partner"
      }
    ],
    avoided_neighbors: [
      { 
        student_id: "stu_20240003",
        name: "王五",
        reason: "personality_conflict"
      }
    ],
    special_requirements: "需要靠近讲台，视力较差"
  }
}
```

**响应数据**:
```javascript
{
  success: true,
  code: 200,
  message: "意愿提交成功",
  data: {
    wish_id: "wish_20241201_001",
    submit_time: "2024-12-01T10:30:00Z",
    version: 1,
    next_modify_deadline: "2024-12-05T18:00:00Z"
  }
}
```

### 7. 更新学生意愿
**接口名称**: `updateWish`

**请求参数**:
```javascript
{
  type: "updateWish",
  token: "jwt_token",
  wish_id: "wish_20241201_001",
  wish_data: {
    // 同提交意愿的wish_data结构
  }
}
```

**响应数据**:
```javascript
{
  success: true,
  code: 200,
  message: "意愿更新成功",
  data: {
    wish_id: "wish_20241201_001",
    update_time: "2024-12-01T15:45:00Z",
    version: 2
  }
}
```

### 8. 获取我的意愿
**接口名称**: `getMyWish`

**请求参数**:
```javascript
{
  type: "getMyWish",
  token: "jwt_token",
  session_id: "session_20241201_001"
}
```

**响应数据**:
```javascript
{
  success: true,
  code: 200,
  message: "获取成功",
  data: {
    wish_id: "wish_20241201_001",
    wish_data: {
      // 完整的意愿数据
    },
    submit_time: "2024-12-01T10:30:00Z",
    update_time: "2024-12-01T15:45:00Z",
    version: 2,
    can_modify: true
  }
}
```

### 9. 获取排座结果
**接口名称**: `getMyAssignment`

**请求参数**:
```javascript
{
  type: "getMyAssignment",
  token: "jwt_token",
  session_id: "session_20241201_001"
}
```

**响应数据**:
```javascript
{
  success: true,
  code: 200,
  message: "获取成功",
  data: {
    assignment_id: "assign_20241201_001",
    seat_info: {
      seat_id: "seat_1_1",
      position: { row: 1, col: 1 },
      position_desc: "第1排第1列"
    },
    neighbors: [
      {
        direction: "left",
        student_name: "李四",
        is_preferred: true
      },
      {
        direction: "right",
        student_name: "王五",
        is_preferred: false
      }
    ],
    satisfaction_score: 0.85,
    assignment_reasons: [
      "preferred_seat_matched",
      "preferred_neighbor_nearby"
    ],
    assign_time: "2024-12-01T16:00:00Z"
  }
}
```

## 管理员端接口

### 10. 创建排座会话
**接口名称**: `createSession`

**请求参数**:
```javascript
{
  type: "createSession",
  token: "admin_jwt_token",
  session_data: {
    classroom_id: "room_001",
    class_id: "cs2024_1",
    title: "2024年12月期末排座",
    deadline: "2024-12-05T18:00:00Z",
    algorithm_params: {
      wish_weight: 0.4,
      teaching_weight: 0.3,
      fairness_weight: 0.2,
      constraint_weight: 0.1,
      max_iterations: 1000,
      min_satisfaction: 0.7,
      enable_random_fallback: true
    }
  }
}
```

**响应数据**:
```javascript
{
  success: true,
  code: 200,
  message: "排座会话创建成功",
  data: {
    session_id: "session_20241201_001",
    status: "collecting",
    create_time: "2024-12-01T10:00:00Z",
    notification_sent: true      // 是否已发送通知
  }
}
```

### 11. 获取会话统计信息
**接口名称**: `getSessionStatistics`

**请求参数**:
```javascript
{
  type: "getSessionStatistics",
  token: "admin_jwt_token",
  session_id: "session_20241201_001"
}
```

**响应数据**:
```javascript
{
  success: true,
  code: 200,
  message: "获取成功",
  data: {
    session_info: {
      session_id: "session_20241201_001",
      title: "2024年12月期末排座",
      status: "collecting",
      deadline: "2024-12-05T18:00:00Z"
    },
    statistics: {
      total_students: 45,
      submitted_wishes: 42,
      completion_rate: 0.93,
      pending_students: [
        { student_id: "stu_20240044", name: "赵六" },
        { student_id: "stu_20240045", name: "孙七" }
      ]
    },
    timeline: [
      {
        time: "2024-12-01T10:00:00Z",
        event: "session_created",
        description: "排座会话创建"
      },
      {
        time: "2024-12-01T10:30:00Z",
        event: "first_wish_submitted",
        description: "第一个意愿提交"
      }
    ]
  }
}
```

### 12. 执行自动排座
**接口名称**: `executeArrangement`

**请求参数**:
```javascript
{
  type: "executeArrangement",
  token: "admin_jwt_token",
  session_id: "session_20241201_001",
  force_start: false           // 是否强制开始（忽略截止时间）
}
```

**响应数据**:
```javascript
{
  success: true,
  code: 200,
  message: "排座任务启动成功",
  data: {
    task_id: "task_20241201_001",
    estimated_time: 30,         // 预估执行时间（秒）
    status: "running"           // running/completed/failed
  }
}
```

### 13. 获取排座任务状态
**接口名称**: `getArrangementStatus`

**请求参数**:
```javascript
{
  type: "getArrangementStatus",
  token: "admin_jwt_token",
  task_id: "task_20241201_001"
}
```

**响应数据**:
```javascript
{
  success: true,
  code: 200,
  message: "获取成功",
  data: {
    task_id: "task_20241201_001",
    status: "completed",        // running/completed/failed
    progress: 100,              // 进度百分比
    result: {
      total_assignments: 45,
      successful_assignments: 43,
      random_assignments: 2,
      overall_satisfaction: 0.85,
      execution_time: 28,       // 实际执行时间（秒）
      algorithm_details: {
        iterations_used: 856,
        convergence_achieved: true,
        conflict_resolutions: 5
      }
    },
    start_time: "2024-12-01T16:00:00Z",
    end_time: "2024-12-01T16:00:28Z"
  }
}
```

### 14. 获取排座结果
**接口名称**: `getArrangementResult`

**请求参数**:
```javascript
{
  type: "getArrangementResult",
  token: "admin_jwt_token",
  session_id: "session_20241201_001",
  format: "detailed"           // simple/detailed/export
}
```

**响应数据**:
```javascript
{
  success: true,
  code: 200,
  message: "获取成功",
  data: {
    session_id: "session_20241201_001",
    classroom_layout: {
      dimensions: { width: 12, height: 8 },
      seat_map: [
        [
          {
            seat_id: "seat_1_1",
            student: {
              student_id: "stu_20240001",
              name: "张三",
              satisfaction_score: 0.9
            }
          }
          // ... 更多座位
        ]
      ]
    },
    statistics: {
      total_students: 45,
      overall_satisfaction: 0.85,
      satisfaction_distribution: {
        excellent: 32,    // 满意度 >= 0.8
        good: 10,         // 满意度 >= 0.6
        fair: 3           // 满意度 < 0.6
      }
    },
    conflicts: [
      {
        type: "seat_conflict",
        description: "多名学生希望同一座位",
        resolution: "按优先级分配"
      }
    ]
  }
}
```

### 15. 手动调整座位
**接口名称**: `manualAdjustSeat`

**请求参数**:
```javascript
{
  type: "manualAdjustSeat",
  token: "admin_jwt_token",
  session_id: "session_20241201_001",
  adjustments: [
    {
      student_id: "stu_20240001",
      from_seat: "seat_1_1",
      to_seat: "seat_1_2",
      reason: "管理员手动调整"
    },
    {
      student_id: "stu_20240002",
      from_seat: "seat_1_2",
      to_seat: "seat_1_1",
      reason: "交换座位"
    }
  ]
}
```

**响应数据**:
```javascript
{
  success: true,
  code: 200,
  message: "座位调整成功",
  data: {
    adjusted_count: 2,
    new_satisfaction_scores: {
      "stu_20240001": 0.75,
      "stu_20240002": 0.88
    },
    overall_satisfaction_change: -0.02,
    adjust_time: "2024-12-01T16:30:00Z"
  }
}
```

### 16. 发布排座结果
**接口名称**: `publishResult`

**请求参数**:
```javascript
{
  type: "publishResult",
  token: "admin_jwt_token",
  session_id: "session_20241201_001",
  notification_config: {
    send_miniprogram_notice: true,    // 发送小程序通知
    send_template_message: true,      // 发送模板消息
    custom_message: "排座结果已出，请查看您的座位安排"
  }
}
```

**响应数据**:
```javascript
{
  success: true,
  code: 200,
  message: "结果发布成功",
  data: {
    publish_time: "2024-12-01T17:00:00Z",
    notification_status: {
      miniprogram_notices: 45,       // 发送的小程序通知数
      template_messages: 45,         // 发送的模板消息数
      failed_notifications: 0        // 发送失败数
    }
  }
}
```

## 数据管理接口

### 17. 学生信息管理
**接口名称**: `manageStudents`

**请求参数**:
```javascript
{
  type: "manageStudents",
  token: "admin_jwt_token",
  action: "list",              // list/add/update/delete/import
  class_id: "cs2024_1",
  // 根据action不同，附加不同参数
  data: {
    // action=add时的新增数据
    // action=update时的更新数据
    // action=import时的批量导入数据
  },
  pagination: {                // action=list时的分页参数
    page: 1,
    limit: 20
  }
}
```

**响应数据**:
```javascript
{
  success: true,
  code: 200,
  message: "操作成功",
  data: {
    // 根据action返回不同的数据结构
    students: [],              // list操作返回学生列表
    total: 45,                 // 总数
    page: 1,                   // 当前页
    operation_result: {}       // 增删改操作的结果
  }
}
```

### 18. 教室管理
**接口名称**: `manageClassrooms`

**请求参数**:
```javascript
{
  type: "manageClassrooms",
  token: "admin_jwt_token",
  action: "list",              // list/add/update/delete
  classroom_id: "room_001",    // 操作特定教室时需要
  data: {
    // 教室数据
  }
}
```

### 19. 历史记录查询
**接口名称**: `getHistoryRecords`

**请求参数**:
```javascript
{
  type: "getHistoryRecords",
  token: "admin_jwt_token",
  record_type: "sessions",     // sessions/assignments/wishes
  filters: {
    class_id: "cs2024_1",
    start_date: "2024-01-01",
    end_date: "2024-12-31"
  },
  pagination: {
    page: 1,
    limit: 10
  }
}
```

**响应数据**:
```javascript
{
  success: true,
  code: 200,
  message: "获取成功",
  data: {
    records: [
      {
        session_id: "session_20241201_001",
        title: "2024年12月期末排座",
        create_time: "2024-12-01T10:00:00Z",
        status: "published",
        statistics: {
          total_students: 45,
          overall_satisfaction: 0.85
        }
      }
    ],
    total: 15,
    page: 1,
    limit: 10
  }
}
```

### 20. 数据导出
**接口名称**: `exportData`

**请求参数**:
```javascript
{
  type: "exportData",
  token: "admin_jwt_token",
  export_type: "seat_chart",   // seat_chart/wish_data/history_report
  session_id: "session_20241201_001",
  format: "excel",             // excel/pdf/csv
  options: {
    include_photos: false,     // 是否包含学生照片
    include_statistics: true   // 是否包含统计信息
  }
}
```

**响应数据**:
```javascript
{
  success: true,
  code: 200,
  message: "导出成功",
  data: {
    file_id: "export_20241201_001",
    download_url: "cloud://file_url",
    file_name: "座位表_2024年12月.xlsx",
    file_size: 1024000,        // 文件大小（字节）
    expires_in: 3600           // 下载链接有效期（秒）
  }
}
```

## 系统管理接口

### 21. 系统配置
**接口名称**: `systemConfig`

**请求参数**:
```javascript
{
  type: "systemConfig",
  token: "admin_jwt_token",
  action: "get",               // get/update
  config_key: "algorithm_defaults", // 配置项键名
  config_value: {}             // update时的新配置值
}
```

### 22. 系统通知
**接口名称**: `systemNotification`

**请求参数**:
```javascript
{
  type: "systemNotification",
  token: "admin_jwt_token",
  action: "send",              // send/list/delete
  notification_data: {
    target_type: "all",        // all/class/student
    target_ids: [],            // 目标用户ID列表
    title: "系统通知",
    content: "系统将于今晚进行维护",
    priority: "normal"         // high/normal/low
  }
}
```

## 接口调用示例

### 学生提交意愿完整流程

```javascript
// 1. 微信授权登录
const loginResult = await wx.cloud.callFunction({
  name: 'seatArrangementFunctions',
  data: {
    type: 'wxLogin',
    code: wx.getStorageSync('wx_code'),
    userInfo: wx.getStorageSync('userInfo')
  }
});

// 2. 获取当前排座会话
const sessionResult = await wx.cloud.callFunction({
  name: 'seatArrangementFunctions',
  data: {
    type: 'getCurrentSession',
    token: loginResult.result.data.token
  }
});

// 3. 提交意愿
const wishResult = await wx.cloud.callFunction({
  name: 'seatArrangementFunctions',
  data: {
    type: 'submitWish',
    token: loginResult.result.data.token,
    session_id: sessionResult.result.data.session_id,
    wish_data: {
      preferred_seats: [
        { seat_id: "seat_1_1", priority: 1 }
      ],
      preferred_neighbors: [
        { student_id: "stu_20240002", name: "李四", relationship: "friend" }
      ],
      special_requirements: "需要靠近讲台"
    }
  }
});
```

## 接口安全说明

### 身份验证
- 所有接口都需要有效的JWT令牌
- 令牌包含用户身份和权限信息
- 令牌有效期为2小时，支持刷新

### 权限控制
- 学生只能访问自己相关的数据
- 管理员权限分级，seat_manager拥有完整权限
- 敏感操作需要二次验证

### 数据验证
- 所有输入参数都进行格式验证
- 防止SQL注入和XSS攻击
- 敏感数据传输加密

### 频率限制
- 同一用户每分钟最多100次请求
- 批量操作限制单次处理数量
- 异常请求自动封禁

## 版本说明

当前API版本：v1.0
- 支持基础排座功能
- 支持管理员后台操作
- 支持数据导出功能

后续版本计划：
- v1.1: 新增离线同步功能
- v1.2: 增强算法参数配置
- v2.0: 支持多校区部署