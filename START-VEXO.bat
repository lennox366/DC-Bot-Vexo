@echo off
cd /d "%~dp0"
set VEXO_SUPERVISOR=1
:restart
node index.js
set EXITCODE=%ERRORLEVEL%
if "%EXITCODE%"=="75" (
  echo [VEXO] Bestaetigte Codeaenderung - Bot wird neu gestartet.
  timeout /t 3 /nobreak >nul
  goto restart
)
echo [VEXO] Bot wurde beendet mit Code %EXITCODE%.
pause
