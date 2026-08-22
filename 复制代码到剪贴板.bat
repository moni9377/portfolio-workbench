@echo off
chcp 65001 >nul
echo 正在将代码复制到剪贴板，请稍候...
powershell -Command "Get-Content 'D:\portfolio-workbench\public\index.html' -Encoding UTF8 | Set-Clipboard"
echo.
echo ✅ 代码已复制到剪贴板！
echo.
echo 现在去无思维小程序的代码框里按 Ctrl+V 粘贴即可。
echo.
pause
