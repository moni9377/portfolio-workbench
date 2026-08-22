@echo off
chcp 65001 >nul
title 作品集·侠迹 — GitHub Actions 云端打包助手
echo.
echo ═══════════════════════════════════════════
echo   作品集·侠迹 — GitHub Actions 云端打包
echo ═══════════════════════════════════════════
echo.
echo ☁️  为什么用云端打包？
echo    1. 不受国内网络墙影响（GitHub 服务器在国外）
echo    2. 不需要本地安装 Android Studio / JDK / SDK
echo    3. 每次 push 代码自动打包，APK 直接下载
echo    4. 打包环境标准化，避免"我电脑上能跑"的问题
echo.
echo ═══════════════════════════════════════════
echo.

setlocal EnableDelayedExpansion

:: 检查是否是 Git 仓库
cd /d D:\portfolio-workbench
git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
    echo ⚠️  当前项目还不是 Git 仓库
echo.
    echo 是否需要我帮你初始化 Git 并推送到 GitHub？
    choice /C YN /N /M "按 Y 初始化，按 N 跳过"
    if errorlevel 2 goto :ShowManual
    if errorlevel 1 goto :InitGit
)

:: 获取远程仓库信息
for /f "tokens=*" %%a in ('git remote get-url origin 2^>nul') do set "REMOTE_URL=%%a"
if defined REMOTE_URL (
    echo ✅ 已关联远程仓库：%REMOTE_URL%
    for /f "tokens=3" %%a in ('git remote get-url origin') do (
        echo    Actions 页面：https://github.com/%%a/actions
    )
) else (
    echo ⚠️  未关联远程仓库
echo.
    echo 是否需要推送代码到 GitHub？
    choice /C YN /N /M "按 Y 查看推送教程，按 N 跳过"
    if errorlevel 2 goto :ShowManual
    if errorlevel 1 goto :PushGuide
)

echo.
echo ═══════════════════════════════════════════
echo   使用方法
echo ═══════════════════════════════════════════
echo.
:ShowManual
echo 【方式一】自动触发（推荐）
echo    1. 修改代码后提交并 push 到 main/master 分支
echo    2. GitHub 会自动开始打包（约 3-5 分钟）
echo    3. 访问仓库页面的 Actions 标签查看进度
echo    4. 完成后在 Artifacts 中下载 APK
echo.
echo 【方式二】手动触发
echo    1. 打开 GitHub 仓库页面
echo    2. 点击 Actions → Build Android APK
echo    3. 点击右侧 "Run workflow" 按钮
echo    4. 选择 build_type（debug 或 release）
echo    5. 点击 "Run workflow" 开始打包
echo.
echo 【方式三】本地一键 push 并触发
echo    用这个命令快速提交并推送：
echo.
echo    git add .
echo    git commit -m "update"
echo    git push origin main
echo.
echo ═══════════════════════════════════════════
echo   APK 下载位置
echo ═══════════════════════════════════════════
echo.
echo    打包完成后：
echo    1. 打开 GitHub 仓库 → Actions 标签
echo    2. 点击最新的 workflow 运行记录
echo    3. 页面底部 "Artifacts" 区域
echo    4. 点击 app-debug-apk 下载 ZIP
echo    5. 解压后得到 app-debug.apk
echo.
echo ═══════════════════════════════════════════
echo.
echo 按任意键退出...
pause >nul
goto :EOF

:InitGit
echo.
echo ═══════════════════════════════════════════
echo   Git 初始化教程
echo ═══════════════════════════════════════════
echo.
echo 步骤 1：在 GitHub 创建仓库
echo    1. 打开 https://github.com/new
echo    2. 仓库名填：portfolio-workbench（或其他名字）
echo    3. 选择 Public 或 Private
echo    4. 不要勾选 README（已有）
echo    5. 点击 "Create repository"
echo.
echo 步骤 2：推送代码（在命令行执行）
echo.
echo    cd D:\portfolio-workbench
echo    git init
echo    git add .
echo    git commit -m "first commit"
echo    git branch -M main
echo    git remote add origin https://github.com/你的用户名/仓库名.git
echo    git push -u origin main
echo.
echo 步骤 3：触发打包
echo    push 完成后，GitHub Actions 会自动运行
echo    访问仓库页面 → Actions 查看进度
echo.
pause
goto :EOF

:PushGuide
echo.
echo 推送代码命令：
echo.
echo    cd D:\portfolio-workbench
echo    git add .
echo    git commit -m "update"
echo    git push origin main
echo.
echo push 后 Actions 会自动触发打包
echo.
pause
goto :EOF
