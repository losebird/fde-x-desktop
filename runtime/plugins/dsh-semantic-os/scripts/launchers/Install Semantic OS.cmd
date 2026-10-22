@echo off
setlocal
cd /d "%~dp0"
set "PATH=%APPDATA%\npm;%LOCALAPPDATA%\pnpm;%ProgramFiles%\nodejs;%ProgramFiles(x86)%\nodejs;%PATH%"
if defined NODE_EXECUTABLE (set "NODE=%NODE_EXECUTABLE%") else (set "NODE=node")
"%NODE%" "scripts\install-release.js" "%CD%"
if errorlevel 1 (
  echo.
  echo Semantic OS installation failed. See the error above.
  pause
  exit /b 1
)
echo.
echo Semantic OS installation completed.
pause
