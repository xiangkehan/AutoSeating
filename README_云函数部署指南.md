# 微信小程序云函数部署指南

## 问题概述

最近仪表盘数据加载失败，出现错误提示：`Cannot find module '../utils/databaseSecurity'`。这是因为云函数无法找到并引用utils目录中的数据库安全模块。

## 解决方案

### 根本原因

微信云开发中，要让一个目录成为可被其他云函数引用的共享模块，需要满足两个条件：
1. 该目录必须包含`package.json`文件（utils目录之前缺少这个文件）
2. 该目录必须作为公共模块部署到云端

### 已完成的修复

1. ✅ 为`utils`目录创建了`package.json`文件，使其成为有效的Node.js模块
2. ✅ 修复了`uploadCloudFunction.sh`脚本，添加了参数检查、错误处理和正确的部署顺序
3. ✅ 确保了`seatArrangementFunctions`云函数中的导入路径正确 (`../utils/databaseSecurity`)

## 部署方法

### 方法1：使用脚本部署（推荐）

```bash
# Windows PowerShell中执行
bash ./uploadCloudFunction.sh "<微信开发者工具CLI路径>" "<您的环境ID>" "<项目路径>"

# 示例
# bash ./uploadCloudFunction.sh "C:/Program Files (x86)/Tencent/微信web开发者工具/cli.bat" "your-env-id" "c:/Users/xjh20/WeChatProjects/miniprogram-2"
```

### 方法2：手动在微信开发者工具中部署

1. 打开微信开发者工具，进入项目
2. 点击左侧菜单栏中的**云开发**按钮
3. 在云开发控制台中，点击**云函数**标签页
4. 先部署`utils`目录作为公共模块：
   - 右键点击项目文件列表中的`cloudfunctions/utils`目录
   - 选择**上传并部署：云端安装依赖**
5. 然后部署`seatArrangementFunctions`云函数：
   - 右键点击项目文件列表中的`cloudfunctions/seatArrangementFunctions`目录
   - 选择**上传并部署：云端安装依赖**
6. 等待部署完成后，重新加载小程序页面

## 注意事项

- 部署顺序很重要：必须先部署`utils`模块，再部署依赖它的云函数
- 确保在部署时选择了"云端安装依赖"选项
- 如果使用脚本部署，需要确保安装了bash环境（Windows 10/11用户可通过Windows Subsystem for Linux或Git Bash获取）

部署完成后，仪表盘数据加载应该能够正常工作。