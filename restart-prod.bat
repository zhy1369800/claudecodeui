@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM Restart production for this project.
REM Default: kill PID(s) listening on PORT (default 3001), then run `npm run start`.
REM Usage:
REM   restart-prod.bat
REM   restart-prod.bat 3001
REM   restart-prod.bat --no-build 3001
REM   restart-prod.bat --no-elevate --no-build 3001

cd /d "%~dp0"

set "NO_BUILD=0"
set "NO_ELEVATE=0"
set "PORT="

:PARSE_ARGS
if "%~1"=="" goto ARGS_DONE

set "ARG=%~1"
echo(%ARG%| findstr /I /C:"no-build" >nul
if "%errorlevel%"=="0" (
  set "NO_BUILD=1"
  shift
  goto PARSE_ARGS
)

echo(%ARG%| findstr /I /C:"no-elevate" >nul
if "%errorlevel%"=="0" (
  set "NO_ELEVATE=1"
  shift
  goto PARSE_ARGS
)

if not defined PORT set "PORT=%~1"
shift
goto PARSE_ARGS

:ARGS_DONE
if not defined PORT set "PORT=3001"
echo(%PORT%| findstr /R "^[0-9][0-9]*$" >nul
if not "%errorlevel%"=="0" (
  echo [restart-prod] WARN: invalid port "%PORT%", fallback to 3001
  set "PORT=3001"
)

REM Elevate to admin if needed (taskkill may require it)
if "%NO_ELEVATE%"=="1" (
  echo [restart-prod] skip admin elevation (--no-elevate^)
) else (
  net session >nul 2>&1
  if not "%errorlevel%"=="0" (
    echo [restart-prod] need admin, requesting elevation...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs -ArgumentList @('%*')" >nul 2>nul
    exit /b 0
  )
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

set "PID_FILE=%TEMP%\restart-prod-pids-%RANDOM%-%RANDOM%.txt"
powershell -NoProfile -Command "$p='%P%'; netstat -ano | ForEach-Object { $line = $_.ToString().Trim(); if($line -match '^(TCP|UDP)\s+\S+:'+$p+'\s+') { ($line -split '\s+')[-1] } } | Where-Object { $_ -match '^\d+$' } | Sort-Object -Unique | Set-Content -Path '%PID_FILE%'" >nul 2>nul
if exist "%PID_FILE%" for /f "usebackq delims=" %%I in ("%PID_FILE%") do (
  set "FOUND=1"
  call :KILL_PID %%I %P%
)
if exist "%PID_FILE%" del /q "%PID_FILE%" >nul 2>nul

if not defined FOUND (
  echo [restart-prod] port %P% not in use
)
exit /b 0

:KILL_PID
set "PID=%~1"
set "P=%~2"
echo(%PID%| findstr /R "^[0-9][0-9]*$" >nul
if not "%errorlevel%"=="0" (
  echo [restart-prod] WARN: skip invalid PID "%PID%"
  exit /b 0
)
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
powershell -NoProfile -Command "Start-Sleep -Seconds 1" >nul 2>nul
powershell -NoProfile -Command "$p='%P%'; $lines = netstat -ano | ForEach-Object { $line = $_.ToString().Trim(); if($line -match '^(TCP|UDP)\s+\S+:'+$p+'\s+') { $line } }; if($lines){$lines | ForEach-Object { $_.ToString() }; exit 1} else { exit 0 }" >nul
if "%errorlevel%"=="1" (
  echo [restart-prod] port %P% still LISTENING:
  netstat -ano | findstr ":%P%" 
  exit /b 1
)
exit /b 0
