@echo off
REM 自动排座位系统 - 离线管理端快速启动脚本(简化版)

REM 切换到desktop目录
cd desktop

REM 安装依赖(如果需要)
if not exist "node_modules" (
    echo 正在安装依赖...
    npm install
)

REM 启动离线管理端
echo 正在启动离线管理端...
npm start

REM 返回原目录
cd ..
pause