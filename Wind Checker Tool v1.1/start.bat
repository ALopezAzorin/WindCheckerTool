@echo off

cd /d "%~dp0"

echo Current folder:
echo %CD%
echo.

python --version
echo.

echo Starting local server...

@REM start the python server in the background, redirecting output to nul.
start /b python -m http.server 8000 >nul 2>&1

@REM Wait for the server to start by checking if the port is open. While loop until the server is reachable. Once reachable, returns 0 so the script can continue.
:waitloop
powershell -Command "try { $r=Invoke-WebRequest -Uri 'http://localhost:8000' -UseBasicParsing -TimeoutSec 1; exit 0 } catch { exit 1 }" >nul 2>&1

if errorlevel 1 (
    timeout /t 1 >nul @REM wait 1s before checking again
    goto waitloop
)


cls
echo Local server is running. Opening in default browser...
start http://localhost:8000

echo.
echo Close this window to stop the local server.