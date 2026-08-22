@echo off
chcp 65001 >nul
title 作品集·侠迹 — 全自动安卓打包
echo.
echo ═══════════════════════════════════════════
echo   作品集·侠迹 — 全自动安卓打包脚本
echo ═══════════════════════════════════════════
echo.

setlocal EnableDelayedExpansion

:: ========== 配置 ==========
set "PROJECT_DIR=D:\portfolio-workbench"
set "ANDROID_DIR=%PROJECT_DIR%\android"
set "DIST_DIR=%PROJECT_DIR%\dist"
set "APK_NAME=作品集侠迹.apk"

:: ========== 步骤1: 检查 Node.js ==========
echo [1/6] 检查 Node.js 环境...
node --version >nul 2>&1
if errorlevel 1 (
    echo   ✗ Node.js 未安装或未添加到 PATH
    echo   请从 https://nodejs.org/ 下载安装 LTS 版本
    pause
    exit /b 1
)
for /f "tokens=*" %%a in ('node --version') do echo   ✓ Node.js %%a

:: ========== 步骤2: 检查并配置 Java ==========
echo.
echo [2/6] 检查 Java 环境...
java -version >nul 2>&1
if errorlevel 1 (
    echo   ! Java 未在 PATH 中，尝试自动查找...
    call :FindJava
    if errorlevel 1 (
        echo   ✗ 未找到 Java，请安装 JDK 17+
        echo   推荐：从 Android Studio 自带 JDK 或 https://adoptium.net/ 下载
        pause
        exit /b 1
    )
) else (
    for /f "tokens=3" %%a in ('java -version 2^>^&1 ^| findstr "version"') do (
        set "JAVA_VER=%%a"
        set "JAVA_VER=!JAVA_VER:"=!"
        echo   ✓ Java !JAVA_VER!
    )
)

:: ========== 步骤3: 检查并配置 Android SDK ==========
echo.
echo [3/6] 检查 Android SDK...
if not defined ANDROID_HOME (
    echo   ! ANDROID_HOME 未设置，尝试自动查找...
    call :FindAndroidSDK
    if errorlevel 1 (
        echo   ✗ 未找到 Android SDK
        echo   方案1：安装 Android Studio，SDK 会自动配置
        echo   方案2：使用 GitHub Actions 云端打包（推荐，不受墙影响）
        echo     地址：https://github.com/你的用户名/仓库名/actions
        pause
        exit /b 1
    )
)
echo   ✓ ANDROID_HOME = %ANDROID_HOME%

:: ========== 步骤4: 同步前端资源 ==========
echo.
echo [4/6] 同步前端资源到安卓项目...
cd /d "%PROJECT_DIR%"
call npx cap sync android
if errorlevel 1 (
    echo   ✗ 同步失败
    pause
    exit /b 1
)
echo   ✓ 同步完成

:: ========== 步骤5: 构建 APK ==========
echo.
echo [5/6] 开始构建 APK（使用国内镜像加速）...
cd /d "%ANDROID_DIR%"

:: 先配置国内 Gradle 镜像（如果不存在）
if not exist "%USERPROFILE%\.gradle\init.gradle" (
    call :SetupGradleMirror
)

:: 执行构建
call gradlew.bat assembleDebug --no-daemon
if errorlevel 1 (
    echo   ✗ 构建失败，查看上方错误信息
    echo   常见原因：
    echo     1. 网络问题（Gradle 依赖下载失败）→ 使用 GitHub Actions 云端打包
    echo     2. SDK 版本不匹配 → 检查 Android SDK 是否安装了 API 33+
    pause
    exit /b 1
)
echo   ✓ 构建成功

:: ========== 步骤6: 复制 APK 到 dist ==========
echo.
echo [6/6] 复制 APK 到输出目录...
if not exist "%DIST_DIR%" mkdir "%DIST_DIR%"
copy /Y "%ANDROID_DIR%\app\build\outputs\apk\debug\app-debug.apk" "%DIST_DIR%\%APK_NAME%" >nul
echo   ✓ APK 已复制到：%DIST_DIR%\%APK_NAME%

:: 显示文件大小
for %%F in ("%DIST_DIR%\%APK_NAME%") do (
    echo   📦 文件大小：%%~zF 字节（约 %%~zF 字节）
)

echo.
echo ═══════════════════════════════════════════
echo   ✅ 打包完成！
echo   APK 位置：%DIST_DIR%\%APK_NAME%
echo ═══════════════════════════════════════════
echo.
echo 提示：
echo   • 将此 APK 发送到安卓手机即可安装
echo   • 如果构建因网络失败，推荐使用 GitHub Actions 云端打包
echo   • 双击 build-android-ci.bat 查看 CI 使用说明
echo.
pause
goto :EOF

:: ========== 子程序：查找 Java ==========
:FindJava
:: 常见 JDK 路径
set "JAVA_CANDIDATES="
set "JAVA_CANDIDATES=%JAVA_CANDIDATES% C:\Program Files\Java\jdk-17"
set "JAVA_CANDIDATES=%JAVA_CANDIDATES% C:\Program Files\Java\jdk-21"
set "JAVA_CANDIDATES=%JAVA_CANDIDATES% C:\Program Files\Eclipse Adoptium\jdk-17"
set "JAVA_CANDIDATES=%JAVA_CANDIDATES% C:\Program Files\Eclipse Adoptium\jdk-21"
set "JAVA_CANDIDATES=%JAVA_CANDIDATES% D:\AndroidStudio\jbr"
set "JAVA_CANDIDATES=%JAVA_CANDIDATES% C:\Program Files\Android\Android Studio\jbr"
set "JAVA_CANDIDATES=%JAVA_CANDIDATES% C:\Program Files (x86)\Android\Android Studio\jbr"

for %%J in (%JAVA_CANDIDATES%) do (
    if exist "%%J\bin\java.exe" (
        set "JAVA_HOME=%%J"
        set "PATH=%JAVA_HOME%\bin;%PATH%"
        echo   ✓ 自动找到 Java：%%J
        exit /b 0
    )
)
exit /b 1

:: ========== 子程序：查找 Android SDK ==========
:FindAndroidSDK
set "SDK_CANDIDATES="
set "SDK_CANDIDATES=%SDK_CANDIDATES% C:\Users\%USERNAME%\AppData\Local\Android\Sdk"
set "SDK_CANDIDATES=%SDK_CANDIDATES% D:\Android\Sdk"
set "SDK_CANDIDATES=%SDK_CANDIDATES% C:\Android\Sdk"

for %%S in (%SDK_CANDIDATES%) do (
    if exist "%%S\platforms" (
        set "ANDROID_HOME=%%S"
        set "PATH=%ANDROID_HOME%\cmdline-tools\latest\bin;%ANDROID_HOME%\platform-tools;%PATH%"
        echo   ✓ 自动找到 Android SDK：%%S
        exit /b 0
    )
)
exit /b 1

:: ========== 子程序：配置 Gradle 国内镜像 ==========
:SetupGradleMirror
if not exist "%USERPROFILE%\.gradle" mkdir "%USERPROFILE%\.gradle"
(
echo allprojects {
echo     repositories {
echo         maven { url 'https://maven.aliyun.com/repository/public' }
echo         maven { url 'https://maven.aliyun.com/repository/google' }
echo         maven { url 'https://maven.aliyun.com/repository/gradle-plugin' }
echo         google^(^)
echo         mavenCentral^(^)
echo     }
echo }
) > "%USERPROFILE%\.gradle\init.gradle"
echo   ✓ 已配置 Gradle 国内镜像（阿里源）
exit /b 0
