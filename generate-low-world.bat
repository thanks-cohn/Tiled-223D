@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js was not found. Install Node.js LTS, then try again.
 pause
 exit /b 1
)
set "MAP=%~1"
if "%MAP%"=="" (
 echo Drag your edited 500x500 Tiled JSON onto this BAT file,
 echo or enter its path here.
 set /p "MAP=Edited Tiled JSON: "
)
if "%MAP%"=="" exit /b 1
set "ELEV=%~2"
if "%ELEV%"=="" (
 echo Optional: enter the ORIGINAL elevation JSON path to preserve old mountains.
 echo You can leave this blank if the edited map already embeds the original heights.
 set /p "ELEV=Original elevations [Enter to skip]: "
)
if "%ELEV%"=="" (
 node scripts\assemble-low-world.mjs --map "%MAP%" --out "generated\low-world.json"
) else (
 node scripts\assemble-low-world.mjs --map "%MAP%" --elevation "%ELEV%" --out "generated\low-world.json"
)
if errorlevel 1 (
 echo Generation failed. The original map was not changed.
 pause
 exit /b 1
)
echo.
echo Done. Start the browser with start-world.bat, then choose
echo Import Tiled JSON: generated\low-world.json and click Load map.
pause
