@echo off
chcp 65001 >nul
echo ==========================================
echo   作品集 · 侠迹 服务端启动器
echo ==========================================
echo.
echo 数据存储位置：D:\portfolio-workbench-data
echo.
cd /d D:\portfolio-workbench
node server.js
pause
