# 数据格式示例与测试用例

## 概述

本文档提供了自动排座位系统中各种数据格式的详细示例，包括请求数据、响应数据和测试用例。

## 核心数据格式示例

### 1. 学生信息数据格式

#### 基础学生信息
```json
{
  "_id": "student_doc_id_001",
  "student_id": "stu_20240001",
  "name": "张三",
  "student_number": "202401001",
  "class_id": "cs2024_1",
  "wx_openid": "ox1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O",
  "is_active": true,
  "special_needs": {
    "vision_impaired": false,
    "hearing_impaired": false,
    "height_tall": true,
    "other_requirements": "需要靠近讲台，座位旁边要有插座"
  },
  "create_time": "2024-09-01T10:00:00Z",
  "update_time": "2024-12-01T10:00:00Z"
}
```

### 2. 教室布局数据格式

#### 标准教室布局
```json
{
  "classroom_id": "room_a101",
  "name": "A101多媒体教室",
  "capacity": 48,
  "layout_config": {
    "dimensions": {"width": 12, "height": 8},
    "seats": [
      {
        "seat_id": "seat_1_1",
        "position": {"row": 1, "col": 1},
        "is_available": true,
        "is_fixed": false,
        "properties": {
          "near_podium": true,
          "has_power_outlet": true
        }
      }
    ],
    "elements": {
      "podium": {"position": {"x": 300, "y": 50}},
      "doors": [{"position": {"x": 0, "y": 200}}],
      "aisles": [{"type": "horizontal", "position": {"x": 0, "y": 250}}]
    }
  }
}
```

### 3. 学生意愿数据格式

#### 详细意愿信息
```json
{
  "wish_id": "wish_20241201_001",
  "student_id": "stu_20240001",
  "session_id": "session_20241201_001",
  "preferred_seats": [
    {
      "seat_id": "seat_2_3",
      "priority": 1,
      "reason": "视野好，距离适中"
    }
  ],
  "avoided_seats": [
    {
      "seat_id": "seat_8_1",
      "reason": "太远看不清"
    }
  ],
  "preferred_neighbors": [
    {
      "student_id": "stu_20240002",
      "name": "李四",
      "relationship": "study_partner",
      "importance": "high"
    }
  ],
  "special_requirements": "我是近视眼，需要坐在前排靠中间的位置",
  "submit_time": "2024-12-01T14:30:00Z"
}
```

### 4. 排座结果数据格式

#### 完整排座结果
```json
{
  "session_id": "session_20241201_001",
  "execution_info": {
    "start_time": "2024-12-05T19:00:00Z",
    "end_time": "2024-12-05T19:02:15Z",
    "iterations_completed": 892,
    "convergence_achieved": true
  },
  "overall_statistics": {
    "total_students": 43,
    "overall_satisfaction": 0.847,
    "random_assignments": 1
  },
  "assignments": [
    {
      "student_id": "stu_20240001",
      "student_name": "张三",
      "seat_id": "seat_2_3",
      "position": {"row": 2, "col": 3},
      "satisfaction_score": 0.92,
      "assignment_reasons": [
        "preferred_seat_matched",
        "preferred_neighbor_nearby"
      ],
      "neighbors": {
        "left": {"student_name": "李四", "is_preferred": true},
        "right": {"student_name": "钱八", "is_preferred": false}
      }
    }
  ]
}
```

## 接口测试用例

### API测试数据集

#### 登录测试用例
```json
{
  "login_test_cases": [
    {
      "case_name": "正常登录",
      "request": {
        "type": "wxLogin",
        "code": "valid_wx_code",
        "userInfo": {"nickName": "测试用户"}
      },
      "expected_response": {
        "success": true,
        "code": 200,
        "data": {"token": "jwt_token"}
      }
    },
    {
      "case_name": "无效授权码",
      "request": {
        "type": "wxLogin",
        "code": "invalid_code"
      },
      "expected_response": {
        "success": false,
        "code": 401,
        "message": "授权码无效"
      }
    }
  ]
}
```

#### 意愿提交测试用例
```json
{
  "wish_test_cases": [
    {
      "case_name": "正常提交意愿",
      "request": {
        "type": "submitWish",
        "token": "valid_token",
        "session_id": "test_session_001",
        "wish_data": {
          "preferred_seats": [{"seat_id": "seat_1_1", "priority": 1}]
        }
      },
      "expected_response": {
        "success": true,
        "code": 200,
        "data": {"wish_id": "wish_test_001"}
      }
    }
  ]
}
```

## 算法测试数据

### 排座算法测试用例
```json
{
  "algorithm_test_cases": [
    {
      "name": "基础排座功能测试",
      "description": "测试20人小班级的基础排座功能",
      "input": {
        "students_count": 20,
        "classroom_capacity": 24,
        "wishes_count": 18
      },
      "expected_output": {
        "success": true,
        "assignments_count": 20,
        "min_satisfaction": 0.5
      }
    },
    {
      "name": "冲突解决测试",
      "description": "测试多名学生争夺同一座位的情况",
      "input": {
        "conflicting_students": 3,
        "target_seat": "seat_1_1"
      },
      "expected_output": {
        "conflict_resolution": "priority_based",
        "alternative_assignments": 2
      }
    }
  ]
}
```

## 性能测试数据

### 负载测试场景
```json
{
  "load_test_scenarios": [
    {
      "scenario_name": "并发意愿提交",
      "concurrent_users": 50,
      "duration": "5分钟",
      "operations": [
        {
          "operation": "submitWish",
          "frequency": "每用户每分钟2次"
        }
      ],
      "success_criteria": {
        "response_time_95th": "< 2秒",
        "error_rate": "< 1%"
      }
    }
  ]
}
```

## 错误处理示例

### 常见错误响应格式
```json
{
  "success": false,
  "code": 400,
  "message": "请求参数错误",
  "details": {
    "field": "session_id",
    "error": "会话ID不能为空"
  },
  "timestamp": 1701234567890
}
```

### 业务逻辑错误
```json
{
  "success": false,
  "code": 409,
  "message": "意愿提交失败",
  "details": {
    "reason": "deadline_exceeded",
    "deadline": "2024-12-05T18:00:00Z",
    "current_time": "2024-12-05T18:30:00Z"
  }
}
```