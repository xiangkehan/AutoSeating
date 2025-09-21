@echo off
REM 自动排座位系统 - 离线管理端快速启动脚本

REM 设置控制台编码为UTF-8
chcp 65001 > NUL

cls
echo ====================================================
echo           自动排座位系统 - 离线管理端快速启动脚本           
echo ====================================================
echo.

echo [1/4] 正在检查环境...

REM 检查Node.js是否安装
where node > NUL 2>NUL
if %errorlevel% neq 0 (
    echo 错误: 未找到Node.js。请先安装Node.js，然后重试。
    echo 您可以从 https://nodejs.org/ 下载并安装最新版本。
    pause
    exit /b 1
)

REM 检查npm是否安装
where npm > NUL 2>NUL
if %errorlevel% neq 0 (
    echo 错误: 未找到npm。请先安装npm，然后重试。
    pause
    exit /b 1
)

REM 显示Node.js和npm版本信息
echo 找到Node.js版本: 
node --version
echo 找到npm版本: 
npm --version
echo.

REM 切换到desktop目录
echo [2/4] 正在切换到desktop目录...
cd desktop
if %errorlevel% neq 0 (
    echo 错误: 无法切换到desktop目录。
    pause
    exit /b 1
)

echo [3/4] 正在检查并安装依赖...
REM 检查node_modules目录是否存在
if not exist "node_modules" (
    echo 未找到node_modules目录，正在安装依赖...
    npm install
    if %errorlevel% neq 0 (
        echo 错误: 依赖安装失败。
        pause
        exit /b 1
    )
) else (
    echo node_modules目录已存在，跳过依赖安装。
)

echo.
echo [4/4] 正在启动离线管理端...
echo 启动命令: npm start
echo 启动过程中请勿关闭此窗口...
echo.

REM 启动离线管理端
npm start
if %errorlevel% neq 0 (
    echo 错误: 离线管理端启动失败。
    pause
    exit /b 1
)

REM 程序结束后的处理
if %errorlevel% equ 0 (
    echo 离线管理端已正常关闭。
) else (
    echo 离线管理端异常关闭，错误代码: %errorlevel%
)

cd ..
pause