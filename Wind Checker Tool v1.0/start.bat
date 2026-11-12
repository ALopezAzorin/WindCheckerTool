@echo off

cd /d "%~dp0"

echo Current folder:
echo %CD%
echo.

python --version

echo.
echo Opening tool in the browser localhost:8000...
echo If your browser does not open automatically, please open it manually and go to http://localhost:8000
echo.


python -m http.server 8000

echo.
echo Error code: %ERRORLEVEL%
pause