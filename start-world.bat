@echo off
setlocal
cd /d "%~dp0"
where npm >nul 2>nul
if errorlevel 1 goto missing_node
if not exist "node_modules\vite\bin\vite.js" goto install
goto start

:install
echo Installing browser viewer dependencies for the first run...
call npm install --no-audit --no-fund
if errorlevel 1 goto install_failed

:start
echo Opening Toon World in your browser...
echo Keep this command window open while flying. Press Ctrl+C to stop.
call npm run dev -- --open
if errorlevel 1 goto start_failed
exit /b 0

:missing_node
echo Node.js and npm were not found.
echo Install Node.js LTS from https://nodejs.org/ and reopen this command window.
pause
exit /b 1

:install_failed
echo Dependency installation failed. See the error above.
pause
exit /b 1

:start_failed
echo Viewer failed to start. See the error above.
pause
exit /b 1
