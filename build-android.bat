@echo off
chcp 65001 >nul
echo ==========================================
echo   作品集 · 侠迹 — 安卓安装包打包脚本
echo ==========================================
echo.
echo 前提条件：
echo  1. 已安装 Android Studio
echo  2. 已安装 Android SDK (API 33+)
echo  3. 已安装 Node.js
echo.
echo 打包步骤：
echo  1. 同步前端资源到安卓项目
echo  2. 打开 Android Studio 编译 APK
echo.
pause

cd /d D:\portfolio-workbench

echo [1/3] 同步前端资源...
npx cap sync android

echo.
echo [2/3] 打开 Android Studio...
echo 请在 Android Studio 中点击 Build -^> Build Bundle(s) / APK(s) -^> Build APK(s)
npx cap open android

echo.
echo [3/3] 完成！
echo APK 文件位置：android\app\build\outputs\apk\debug\app-debug.apk
echo.
pause
