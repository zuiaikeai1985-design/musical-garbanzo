@echo off
setlocal
title RED ALERT
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto NONODE

if exist "node_modules\.bin\vite.cmd" goto RUN

echo.
echo  [1/2] 第一次运行, 正在安装游戏文件, 大约 1-2 分钟, 请等它跑完...
echo        First run: installing, about 1-2 minutes...
echo.
call npm install --no-audit --no-fund
if exist "node_modules\.bin\vite.cmd" goto RUN

echo.
echo  国外服务器连不上, 自动换国内镜像重新安装...
echo  Retrying with the China mirror...
echo.
call npm install --no-audit --no-fund --registry=https://registry.npmmirror.com
if exist "node_modules\.bin\vite.cmd" goto RUN
goto FAIL

:RUN
echo.
echo  [2/2] 正在启动游戏... 浏览器几秒后会自动打开
echo        Starting... the browser opens in a few seconds
echo.
echo  ==========================================
echo   玩的时候不要关这个黑色窗口!
echo   KEEP THIS WINDOW OPEN WHILE PLAYING
echo   不玩了直接关掉这个窗口即可
echo  ==========================================
echo.
start "" cmd /c "timeout /t 6 >nul & start http://127.0.0.1:5173"
call npm run dev
echo.
echo  游戏已停止 / game stopped
pause
exit /b 0

:NONODE
echo.
echo  [X] 还没有安装 Node.js / Node.js not found
echo.
echo      1. 打开网址  https://nodejs.org/zh-cn
echo      2. 点绿色按钮下载, 双击安装, 一路点"下一步"
echo      3. 装好后再双击本文件
echo.
pause
exit /b 1

:FAIL
echo.
echo  [X] 安装失败 / install failed
echo      请检查电脑能不能上网, 然后重新双击本文件
echo      如果一直失败, 把这个窗口截图发给开发者
echo.
pause
exit /b 1
