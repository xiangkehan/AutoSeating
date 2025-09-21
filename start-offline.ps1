<#
.SYNOPSIS
    自动排座位系统 - 离线管理端快速启动脚本
.DESCRIPTION
    此脚本用于便捷地初始化并运行离线端程序，确保离线端可快速投入使用。
    脚本会检查环境、安装依赖并启动应用程序，同时提供详细的日志信息用于问题排查。
#>

# 设置详细日志记录
$VerbosePreference = "Continue"
$ErrorActionPreference = "Continue"

# 设置控制台编码为UTF-8
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# 清屏并显示欢迎信息
Clear-Host
Write-Host "====================================================" -ForegroundColor Green
Write-Host "          自动排座位系统 - 离线管理端快速启动脚本          " -ForegroundColor Green
Write-Host "            版本: 1.0.1 - 增强日志版                      " -ForegroundColor Green
Write-Host "===================================================="
Write-Host

# 记录启动时间
$startTime = Get-Date
Write-Verbose "[INFO] 脚本启动时间: $startTime"
Write-Verbose "[INFO] 脚本路径: $($MyInvocation.MyCommand.Definition)"

Write-Host "[1/4] 正在检查环境..." -ForegroundColor Cyan

# 检查操作系统信息
$osInfo = Get-WmiObject -Class Win32_OperatingSystem | Select-Object Caption, Version, BuildNumber
Write-Verbose "[INFO] 操作系统: $($osInfo.Caption) ($($osInfo.Version) Build $($osInfo.BuildNumber))"
Write-Verbose "[INFO] PowerShell版本: $($PSVersionTable.PSVersion)"

# 检查Node.js是否安装
try {
    Write-Verbose "[DEBUG] 正在检查Node.js是否安装..."
    $nodeCmd = Get-Command node -ErrorAction Stop
    Write-Verbose "[DEBUG] Node.js路径: $($nodeCmd.Source)"
    $nodeVersion = node --version
    Write-Host "找到Node.js版本: $nodeVersion" -ForegroundColor Green
    Write-Verbose "[INFO] Node.js版本: $nodeVersion"
} catch {
    Write-Host "错误: 未找到Node.js。请先安装Node.js，然后重试。" -ForegroundColor Red
    Write-Host "您可以从 https://nodejs.org/ 下载并安装最新版本。" -ForegroundColor Yellow
    Write-Error "[ERROR] Node.js检查失败: $($_.Exception.Message)"
    Read-Host "按Enter键退出..."
    exit 1
}

# 检查npm是否安装
try {
    Write-Verbose "[DEBUG] 正在检查npm是否安装..."
    $npmCmd = Get-Command npm -ErrorAction Stop
    Write-Verbose "[DEBUG] npm路径: $($npmCmd.Source)"
    $npmVersion = npm --version
    Write-Host "找到npm版本: $npmVersion" -ForegroundColor Green
    Write-Verbose "[INFO] npm版本: $npmVersion"
} catch {
    Write-Host "错误: 未找到npm。请先安装npm，然后重试。" -ForegroundColor Red
    Write-Error "[ERROR] npm检查失败: $($_.Exception.Message)"
    Read-Host "按Enter键退出..."
    exit 1
}

Write-Host
Write-Host "[2/4] 正在切换到desktop目录..." -ForegroundColor Cyan

# 切换到desktop目录
try {
    # 获取脚本所在目录
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
    $desktopPath = Join-Path -Path $scriptDir -ChildPath "desktop"
    
    if (-Not (Test-Path -Path $desktopPath -PathType Container)) {
        Write-Host "警告: 找不到desktop目录，尝试使用当前工作目录。" -ForegroundColor Yellow
        Write-Host "当前工作目录: $((Get-Location).Path)" -ForegroundColor Yellow
        $desktopPath = (Get-Location).Path
    }
    
    Set-Location -Path $desktopPath -ErrorAction Stop
    Write-Host "成功切换到工作目录: $desktopPath" -ForegroundColor Green
} catch {
    Write-Host "错误: 无法切换到工作目录。详细错误: $_" -ForegroundColor Red
    Write-Host "当前工作目录: $((Get-Location).Path)" -ForegroundColor Yellow
    Write-Host "脚本所在目录: $((Split-Path -Parent $MyInvocation.MyCommand.Definition))" -ForegroundColor Yellow
    Read-Host "按Enter键退出..."
    exit 1
}

Write-Host "[3/4] 正在检查并安装依赖..." -ForegroundColor Cyan

# 检查package.json文件是否存在
$packageJsonPath = Join-Path -Path $desktopPath -ChildPath "package.json"
if (-not (Test-Path -Path $packageJsonPath)) {
    Write-Host "警告: 未找到package.json文件。" -ForegroundColor Yellow
    Write-Host "[警告] 未在目录 $desktopPath 中找到package.json文件" -ForegroundColor Yellow
}

# 检查node_modules目录是否存在
$nodeModulesPath = Join-Path -Path $desktopPath -ChildPath "node_modules"
if (-not (Test-Path -Path $nodeModulesPath)) {
    Write-Host "未找到node_modules目录，正在安装依赖..." -ForegroundColor Yellow
    Write-Host "[调试] 开始npm install，路径: $desktopPath" -ForegroundColor DarkGray
    
    try {
        # 记录npm install开始时间
        $npmInstallStartTime = Get-Date
        Write-Host "[调试] npm install 开始时间: $npmInstallStartTime" -ForegroundColor DarkGray
        
        # 执行npm install并捕获详细输出
        $npmOutput = npm install --no-progress 2>&1
        $exitCode = $LASTEXITCODE
        
        # 记录npm install结束时间
        $npmInstallEndTime = Get-Date
        $npmDuration = ($npmInstallEndTime - $npmInstallStartTime).TotalSeconds
        Write-Host "[调试] npm install 结束时间: $npmInstallEndTime" -ForegroundColor DarkGray
        Write-Host "[调试] npm install 执行时间: $npmDuration 秒" -ForegroundColor DarkGray
        
        if ($exitCode -ne 0) {
            Write-Host "[错误] npm install 失败，退出码: $exitCode" -ForegroundColor Red
            Write-Host "[错误] npm 输出: $($npmOutput -join "`n")" -ForegroundColor Red
            throw "npm install failed with exit code $exitCode"
        }
        
        Write-Host "依赖安装成功。" -ForegroundColor Green
        Write-Host "[信息] npm install 成功完成" -ForegroundColor Green
    } catch {
        Write-Host "错误: 依赖安装失败。错误信息: $_" -ForegroundColor Red
        Write-Host "[错误] 依赖安装失败的详细信息: $($_.Exception.Message)" -ForegroundColor Red
        Read-Host "按Enter键退出..."
        exit 1
    }
} else {
    Write-Host "node_modules目录已存在，跳过依赖安装。" -ForegroundColor Green
    Write-Host "[信息] 跳过npm install，node_modules目录已存在: $nodeModulesPath" -ForegroundColor Green
    
    # 可选：检查并更新package.json中的依赖
    try {
        Write-Host "[调试] 检查package.json文件内容..." -ForegroundColor DarkGray
        $packageJson = Get-Content -Path $packageJsonPath -Raw | ConvertFrom-Json
        Write-Host "[信息] 项目名称: $($packageJson.name), 版本: $($packageJson.version)" -ForegroundColor Green
        
        # 查看是否有electron依赖
        if ($packageJson.dependencies -and $packageJson.dependencies.electron) {
            Write-Host "[信息] 项目依赖electron版本: $($packageJson.dependencies.electron)" -ForegroundColor Green
        }
    } catch {
        Write-Host "[警告] 无法解析package.json文件: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host
Write-Host "[4/4] 正在启动离线管理端..." -ForegroundColor Cyan
Write-Host "启动命令: npm start" -ForegroundColor Yellow
Write-Host "启动过程中请勿关闭此窗口..." -ForegroundColor Yellow
Write-Host

# 启动离线管理端
try {
    # 记录启动开始时间
    $startTime = Get-Date
    Write-Host "[调试] 离线管理端启动开始时间: $startTime" -ForegroundColor DarkGray
    
    # 显示启动命令详情
    Write-Host "[信息] 执行命令: npm start"
    Write-Host "[信息] 工作目录: $((Get-Location).Path)"
    
    # 捕获npm start的输出
    Write-Host "[信息] 正在启动应用程序，等待输出..." -ForegroundColor Yellow
    
    # 修复PowerShell中的执行问题
    # 使用cmd.exe来执行npm start命令，避免chcp 65001在PowerShell中不兼容的问题
    $process = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm start" -NoNewWindow -PassThru -Wait
    $exitCode = $process.ExitCode
    
    # 记录启动结束时间
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalSeconds
    Write-Host "[调试] 离线管理端启动结束时间: $endTime" -ForegroundColor DarkGray
    Write-Host "[调试] 离线管理端运行时间: $duration 秒" -ForegroundColor DarkGray
    
    if ($exitCode -ne 0) {
        Write-Host "[错误] 离线管理端启动失败，退出码: $exitCode" -ForegroundColor Red
        throw "npm start failed with exit code $exitCode"
    }
    
    Write-Host "离线管理端已正常关闭。" -ForegroundColor Green
    Write-Host "[信息] 离线管理端正常退出，退出码: $exitCode" -ForegroundColor Green
} catch {
    Write-Host "错误: 离线管理端启动失败。错误信息: $_" -ForegroundColor Red
    Write-Host "[错误] 启动失败的详细异常: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "[错误] 当前工作目录: $((Get-Location).Path)" -ForegroundColor Yellow
    Write-Host "[提示] 尝试使用其他启动方式: start-offline.bat 或 start-offline-simple.bat" -ForegroundColor Cyan
    Read-Host "按Enter键退出..."
    exit 1
}

# 返回原目录
try {
    # 确保返回到脚本所在目录而不是上级目录
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
    Set-Location -Path $scriptDir -ErrorAction Stop
    Write-Host "成功返回到脚本所在目录: $scriptDir" -ForegroundColor Green
} catch {
    Write-Host "警告: 无法返回到原目录。详细错误: $_" -ForegroundColor Yellow
    Write-Host "当前工作目录: $((Get-Location).Path)" -ForegroundColor Yellow
}

Read-Host "按Enter键退出..."