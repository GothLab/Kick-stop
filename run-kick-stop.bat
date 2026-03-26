@echo off
setlocal

set PORT=5173
set URL=http://localhost:%PORT%/index.html

start "Kick-Stop" cmd /c "python -m http.server %PORT%"
timeout /t 2 >nul
start "Kick-Stop" "%URL%"

echo Kick-Stop is running at %URL%
echo Close the server window to stop.
pause