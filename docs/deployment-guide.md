# 自动排座位系统 - 部署配置文档

## 1. 微信小程序部署

### 1.1 云开发配置
```javascript
// project.config.json
{
  "cloudfunctionRoot": "cloudfunctions/",
  "setting": {
    "urlCheck": false,
    "es6": true,
    "postcss": true,
    "minified": true
  }
}
```

### 1.2 云函数部署
```bash
# 上传云函数
npm install
npm run deploy:cloud

# 配置环境变量
JWT_SECRET=your-jwt-secret-key
```

### 1.3 数据库初始化
- 创建8个核心集合
- 初始化默认管理员账户
- 配置数据库权限

## 2. 桌面版部署

### 2.1 构建配置
```bash
cd desktop
npm install
npm run build-win
```

### 2.2 系统要求
- Windows 11 或更高版本
- .NET Framework 4.8+
- 磁盘空间: 500MB

## 3. 环境配置

### 3.1 开发环境
- Node.js 16+
- 微信开发者工具
- VS Code / WebStorm

### 3.2 生产环境
- 微信云开发环境
- SSL证书配置
- 域名备案

## 4. 数据迁移

### 4.1 学生数据导入
- Excel模板格式
- 批量导入验证
- 数据清洗规则

### 4.2 同步策略
- 时间戳冲突解决
- 增量同步机制
- 数据一致性保证

## 5. 监控和维护

### 5.1 日志管理
- 操作日志记录
- 错误日志收集
- 性能监控指标

### 5.2 备份策略
- 每日自动备份
- 增量备份机制
- 灾难恢复预案

## 6. 安全配置

### 6.1 权限管理
- 管理员角色控制
- API接口鉴权
- 数据访问限制

### 6.2 数据加密
- 敏感信息加密
- 传输加密(HTTPS)
- 本地数据保护