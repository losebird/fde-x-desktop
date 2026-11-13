@echo off
setlocal
set "HERE=%~dp0"
set "LAUNCH=%HERE%..\mcp-npx-launch.mjs"
if defined FDE_HOST_NODE (
  "%FDE_HOST_NODE%" "%LAUNCH%" %*
  exit /b %ERRORLEVEL%
)
node "%LAUNCH%" %*
