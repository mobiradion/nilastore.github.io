@echo off
title Nila Store - Variation Importer Server (Port 8080)
cd /d "%~dp0"

echo ===================================================
echo Starting Nila Store Variation Importer Server
echo Directory: %CD%
echo.
echo URL: http://localhost:8080
echo ===================================================
echo Press Ctrl+C in this window to stop the server.
echo.

:: Open default browser
start http://localhost:8080

python import_server.py --port 8080

pause
