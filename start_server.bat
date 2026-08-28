@echo off
title Nila Store - Local HTTP Server
cd /d "%~dp0"

echo ===================================================
echo Starting Python HTTP Server at:
echo %CD%
echo.
echo URL: http://localhost:8000
echo ===================================================
echo Press Ctrl+C in this window to stop the server.
echo.

:: Open default browser
start http://localhost:8000

python -m http.server 8000

pause
