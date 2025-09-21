@echo off
REM Auto Seating System - Offline Client Quick Start Script (English Version)

REM Set console encoding to UTF-8
chcp 65001 > NUL

cls
echo ====================================================
echo           Auto Seating System - Offline Client Quick Start          
echo ====================================================
echo.

echo [1/4] Checking environment...

REM Check if Node.js is installed
where node > NUL 2>NUL
if %errorlevel% neq 0 (
    echo Error: Node.js not found. Please install Node.js first and try again.
    echo You can download it from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if npm is installed
where npm > NUL 2>NUL
if %errorlevel% neq 0 (
    echo Error: npm not found. Please install npm first and try again.
    pause
    exit /b 1
)

REM Display Node.js and npm versions
echo Found Node.js version: 
node --version
echo Found npm version: 
npm --version
echo.

REM Change to desktop directory
echo [2/4] Changing to desktop directory...
cd desktop
if %errorlevel% neq 0 (
    echo Error: Cannot change to desktop directory.
    pause
    exit /b 1
)

echo [3/4] Checking and installing dependencies...
REM Check if node_modules directory exists
if not exist "node_modules" (
    echo node_modules directory not found, installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo Error: Failed to install dependencies.
        pause
        exit /b 1
    )
) else (
    echo node_modules directory exists, skipping dependency installation.
)

echo.
echo [4/4] Starting offline client...
echo Command: npm start
echo Do not close this window during operation...
echo.

REM Start offline client
npm start
if %errorlevel% neq 0 (
    echo Error: Failed to start offline client.
    pause
    exit /b 1
)

REM Process after program ends
if %errorlevel% equ 0 (
    echo Offline client closed normally.
) else (
    echo Offline client closed abnormally, error code: %errorlevel%
)

cd ..
pause