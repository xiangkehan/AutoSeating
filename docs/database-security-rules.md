# 云开发数据库安全规则配置
# 实现"仅管理端可写，所有人可读"的权限控制

## 方案1: 基于角色字段的安全规则

### students 集合安全规则
```json
{
  "read": true,
  "write": "get('database.students.$(auth.openid)').role in ['admin', 'seat_manager']"
}
```

### arrangement_sessions 集合安全规则
```json
{
  "read": true,
  "write": "get('database.students.$(auth.openid)').role in ['admin', 'seat_manager']"
}
```

### classes 集合安全规则
```json
{
  "read": true,
  "write": "get('database.students.$(auth.openid)').role in ['admin', 'seat_manager']"
}
```

### classrooms 集合安全规则
```json
{
  "read": true,
  "write": "get('database.students.$(auth.openid)').role in ['admin', 'seat_manager']"
}
```

### system_logs 集合安全规则（仅管理员可读写）
```json
{
  "read": "get('database.students.$(auth.openid)').role in ['admin', 'seat_manager']",
  "write": "get('database.students.$(auth.openid)').role in ['admin', 'seat_manager']"
}
```

## 方案2: 基于独立管理员表的安全规则

### 通用集合安全规则
```json
{
  "read": true,
  "write": "get('database.admins.$(auth.openid)').is_active == true"
}
```

### 敏感集合安全规则
```json
{
  "read": "get('database.admins.$(auth.openid)').role in ['admin', 'seat_manager']",
  "write": "get('database.admins.$(auth.openid)').role in ['admin', 'seat_manager']"
}
```

## 方案3: 基于权限列表的安全规则

### 动态权限验证
```json
{
  "read": true,
  "write": "get('database.admins.$(auth.openid)').permissions.indexOf('write_data') >= 0"
}
```

## 配置步骤

1. **登录云开发控制台**
   - 打开微信开发者工具
   - 点击"云开发"按钮
   - 选择对应环境

2. **设置数据库安全规则**
   - 进入"数据库"页面
   - 选择要配置的集合
   - 点击"安全规则"标签
   - 输入上述JSON规则

3. **测试安全规则**
   - 使用不同角色的用户测试读写权限
   - 确认规则生效

## 注意事项

1. **性能影响**: 安全规则会在每次数据库操作时执行，可能影响性能
2. **调试困难**: 规则错误可能导致操作失败，需要仔细测试
3. **功能限制**: 复杂的业务逻辑建议在云函数中实现
4. **缓存问题**: 规则更新可能需要一段时间生效

## 推荐方案

建议采用**云函数权限控制**作为主要方案，**数据库安全规则**作为辅助防护：

1. 在云函数中实现详细的权限验证逻辑
2. 在数据库层面设置基础的安全规则作为最后一道防线
3. 结合JWT令牌验证确保用户身份的可靠性