@echo off
rem ============================================================
rem  红色警报 RED ALERT - Windows one-click launcher
rem  Double-click this file to install (first run only) and play.
rem ============================================================
chcp 65001 >nul
title 红色警报 RED ALERT
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  [X] 没有检测到 Node.js / Node.js not found
  echo.
  echo      请先安装 Node.js（免费，装一次就行）:
  echo      1. 打开网址  https://nodejs.org/zh-cn
  echo      2. 点绿色的下载按钮，下载后双击安装
  echo      3. 安装时一路点"下一步"即可
  echo      4. 装好后，再回来双击本文件
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo.
  echo  第一次运行，正在自动安装（大约 1-2 分钟，只需要装这一次）...
  echo  First run: installing, about 1-2 minutes...
  echo.
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo  默认下载点连不上，自动改用国内镜像重试... / retrying with the China mirror...
    echo.
    call npm install --no-audit --no-fund --registry=https://registry.npmmirror.com
  )
  if errorlevel 1 (
    echo.
    echo  [X] 安装失败，请检查网络后重新双击本文件 / install failed, check network and retry
    pause
    exit /b 1
  )
)

echo.
echo  正在启动游戏... 浏览器几秒后会自动打开
echo  Starting... your browser will open in a few seconds
echo.
echo  ============================================
echo   玩的时候请不要关闭这个黑色窗口！
echo   Keep this window open while playing!
echo   （不玩了直接关掉这个窗口就行）
echo  ============================================
echo.

start "" cmd /c "timeout /t 6 >nul & start http://127.0.0.1:5173"
call npm run dev
pause
