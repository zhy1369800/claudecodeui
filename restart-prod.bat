@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM Restart production for this project.
REM Default: kill PID(s) listening on PORT (default 3001), then run `npm run start`.
REM Usage:
REM   restart-prod.bat
REM   restart-prod.bat 3001
REM   restart-prod.bat --no-build 3001

cd /d "%~dp0"

set "NO_BUILD=0"
if /i "%~1"=="--no-build" (
  set "NO_BUILD=1"
  shift
)

set "PORT=%~1"
if "%PORT%"=="" set "PORT=3001"

REM Elevate to admin if needed (taskkill may require it)
net session >nul 2>&1
if not "%errorlevel%"=="0" (
  echo [restart-prod] need admin, requesting elevation...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs -ArgumentList @('%*')" >nul 2>nul
  exit /b 0
)

echo.
echo [restart-prod] dir: %CD%
echo [restart-prod] port: %PORT%
echo.

call :KILL_BY_PORT %PORT%
call :ASSERT_PORT_FREE %PORT%
if not "%errorlevel%"=="0" (
  echo [restart-prod] abort: port %PORT% still in use
  exit /b 1
)

echo.
if "%NO_BUILD%"=="1" (
  echo [restart-prod] start: npm run server
  echo.
  call npm run server
) else (
  echo [restart-prod] start: npm run start
  echo.
  call npm run start
)

set "RC=%errorlevel%"
if not "%RC%"=="0" echo [restart-prod] exit code: %RC%
exit /b %RC%

:KILL_BY_PORT
set "P=%~1"
set "FOUND="
echo [restart-prod] checking port %P% ...

for /f "usebackq tokens=5" %%I in (`netstat -ano ^| findstr /R /C:":%P% .*LISTENING"`) do (
  set "FOUND=1"
  call :KILL_PID %%I %P%
)

REM Some locales may show a localized LISTENING state
for /f "usebackq tokens=5" %%I in (`netstat -ano ^| findstr /R /C:":%P% .*??"`) do (
  set "FOUND=1"
  call :KILL_PID %%I %P%
)

if not defined FOUND (
  echo [restart-prod] port %P% not in use
)
exit /b 0

:KILL_PID
set "PID=%~1"
set "P=%~2"
if defined KILLED_%PID% exit /b 0
set "KILLED_%PID%=1"

echo [restart-prod] kill PID %PID% (port %P%)

REM Try taskkill first
taskkill /PID %PID% /T /F
if "%errorlevel%"=="0" (
  echo [restart-prod] killed PID %PID%
  exit /b 0
)

echo [restart-prod] WARN: taskkill failed for PID %PID%, trying Stop-Process...
powershell -NoProfile -Command "try { Stop-Process -Id %PID% -Force -ErrorAction Stop; exit 0 } catch { exit 1 }"
if "%errorlevel%"=="0" (
  echo [restart-prod] killed PID %PID% via Stop-Process
  exit /b 0
)

echo [restart-prod] ERROR: failed to kill PID %PID%
exit /b 1

:ASSERT_PORT_FREE
set "P=%~1"
timeout /t 1 /nobreak >nul
netstat -ano | findstr /R /C:":%P% .*LISTENING" >nul
if "%errorlevel%"=="0" (
  echo [restart-prod] port %P% still LISTENING:
  netstat -ano | findstr ":%P%" 
  exit /b 1
)
netstat -ano | findstr /R /C:":%P% .*??" >nul
if "%errorlevel%"=="0" (
  echo [restart-prod] port %P% still LISTENING(localized):
  netstat -ano | findstr ":%P%" 
  exit /b 1
)
exit /b 0
