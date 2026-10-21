@echo off
setlocal
where dsh >nul 2>nul
if errorlevel 1 (
  echo 先装 dsh，再跑这一条。
  exit /b 127
)
where pnpm >nul 2>nul
if errorlevel 1 (
  echo 先装 pnpm，再跑这一条。
  exit /b 127
)
set "SPEC=%~1"
if "%SPEC%"=="" set "SPEC=github:losebird/dsh-lan-assist"
echo 装进 web profile：%SPEC%
dsh plugin --profile web add "%SPEC%"
if errorlevel 1 exit /b %ERRORLEVEL%
echo.
echo 装好了。整进程重启后再硬刷新：
echo   dsh --profile web --host 127.0.0.1 --port 3080
echo 用 dsh --profile web --dump-config 应能看到 id: dsh-lan-assist
endlocal
