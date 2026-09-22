@echo off
setlocal
cd /d "%~dp0"
where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install the LTS version from https://nodejs.org/ then double-click this file again.
  pause
  exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
  echo Installing browser viewer dependencies (first run only)...
  call npm install --no-audit --no-fund
  if errorlevel 1 (echo Dependency installation failed. & pause & exit /b 1)
)
echo Opening Toon World in your default browser...
echo Leave this window open while you fly. Press Ctrl+C here to stop the server.
call npm run dev -- --open
if errorlevel 1 (echo The viewer failed to start. & pause & exit /b 1)
