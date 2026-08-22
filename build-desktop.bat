@echo off
chcp 65001 >nul
echo ==========================================
echo   作品集 · 侠迹 — 电脑端安装包打包脚本
echo ==========================================
echo.
echo 前提条件：
echo  1. 已安装 Node.js
echo.

cd /d D:\portfolio-workbench

echo [1/2] 安装 Electron 打包工具...
npm install electron electron-builder --save-dev

echo.
echo [2/2] 打包电脑端应用...
npx electron-builder --win --x64

echo.
echo 完成！安装包位置：dist\作品集侠迹 Setup.exe
echo.
pause
