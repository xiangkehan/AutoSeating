# 管理员后台配置说明

## 概述

根据项目规范要求，管理员后台需要支持以下功能：
1. 基础管理功能（普通管理员）
2. 完整排座管理功能（排座负责人）
3. 独立的管理员意愿填写入口（参与排座的管理员）

## 功能权限矩阵

### 普通管理员 (role: admin)
- 查看排座结果
- 填写个人意愿（使用独立入口）
- 查看班级统计信息

### 排座负责人 (role: seat_manager)
- 所有普通管理员权限
- 创建和管理排座会话
- 执行排座算法
- 手动调整座位
- 发布排座结果
- 管理教室配置
- 批量导入学生数据

## 管理员意愿填写规范

根据项目规范要求，参与排座的管理员需要有独立的意愿填写入口：

### 实现方案
1. **独立页面**: 创建专门的管理员意愿填写页面 `/pages/admin-wish/admin-wish`
2. **权限验证**: 只有具备管理员身份的用户才能访问
3. **数据隔离**: 管理员意愿数据与学生数据分开处理
4. **流程区分**: 管理员无需通过学生端流程，直接访问专用界面

### 访问路径
- 管理员登录后，在管理后台显示"参与排座"入口
- 点击后跳转到专用的意愿填写页面
- 页面设计与学生端类似，但具有管理员标识

## Web管理后台

由于小程序平台限制，建议使用Web页面实现完整的管理后台：

### 技术方案
1. **前端**: HTML + CSS + JavaScript
2. **认证**: 使用相同的JWT令牌认证
3. **API**: 调用相同的云函数接口
4. **部署**: 可部署到云开发静态网站托管

### 核心页面
1. **登录页**: 管理员账号密码登录
2. **仪表盘**: 显示系统概览和统计信息
3. **会话管理**: 创建、配置和管理排座会话
4. **学生管理**: 维护学生名单和班级信息
5. **教室管理**: 配置教室布局和座位
6. **结果管理**: 查看、调整和发布排座结果
7. **意愿填写**: 管理员专用的意愿填写界面

## 数据库初始化

### 创建默认管理员账户
```javascript
// 在云函数中执行初始化
const initDefaultAdmin = async () => {
  const defaultAdmin = {
    admin_id: 'admin_default',
    username: 'admin',
    password: 'admin123', // 实际使用时应加密
    name: '系统管理员',
    role: 'seat_manager',
    permissions: [
      'create_session',
      'manage_students', 
      'execute_arrangement',
      'manual_adjust',
      'publish_result'
    ],
    class_ids: [],
    is_active: true,
    create_time: new Date().toISOString()
  };
  
  await db.collection('admins').add({ data: defaultAdmin });
};
```

### 创建示例教室
```javascript
const initSampleClassroom = async () => {
  const sampleClassroom = {
    classroom_id: 'room_sample',
    name: '示例教室',
    total_seats: 48,
    layout_config: {
      dimensions: { width: 8, height: 6 },
      seats: [
        // 6排8列的座位布局
        ...generateSeatLayout(6, 8)
      ],
      elements: {
        podium: { position: { x: 200, y: 50 } },
        doors: [{ position: { x: 0, y: 200 } }]
      }
    },
    create_time: new Date().toISOString()
  };
  
  await db.collection('classrooms').add({ data: sampleClassroom });
};
```

## 离线版本考虑

根据项目要求，后端需要支持Win11桌面版和离线运行：

### 技术方案
1. **桌面应用**: 使用Electron框架
2. **本地数据库**: SQLite存储
3. **数据同步**: 在线时自动同步到云端
4. **文件操作**: 支持Excel导入导出

### 同步机制
1. **自动同步**: 检测到网络连接时自动同步数据
2. **手动同步**: 提供手动同步按钮
3. **冲突解决**: 时间戳优先策略
4. **离线标识**: 标记离线创建的数据

## 部署说明

### 云函数部署
1. 上传云函数代码到微信云开发
2. 安装依赖：`jsonwebtoken`
3. 配置环境变量和数据库权限

### 小程序发布
1. 提交小程序代码审核
2. 配置合法域名和权限
3. 发布正式版本

### Web后台部署
1. 部署静态网站到云开发
2. 配置HTTPS和域名
3. 设置管理员访问权限

## 安全考虑

1. **密码加密**: 管理员密码使用bcrypt加密存储
2. **权限控制**: 严格验证用户权限
3. **操作日志**: 记录所有关键操作
4. **数据验证**: 前后端双重数据验证
5. **令牌管理**: JWT令牌定期刷新

## 后续开发建议

1. **优先级1**: 完成核心算法优化
2. **优先级2**: 实现Web管理后台
3. **优先级3**: 开发桌面离线版本
4. **优先级4**: 完善监控和运维功能