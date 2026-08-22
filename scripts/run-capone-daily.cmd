@echo off
setlocal EnableExtensions

rem CAPONE LAB V2 — daily auto refresh (collect + analyze + snapshot only; no vision, no dev server)

set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."
cd /d "%PROJECT_ROOT%" || (
  echo Failed to change directory to project root: %PROJECT_ROOT%
  exit /b 1
)

for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd"') do set "RUN_DATE=%%I"
for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm-ss"') do set "RUN_STAMP=%%I"

set "LOG_DIR=%PROJECT_ROOT%\logs"
set "AUTO_MARKER=%LOG_DIR%\auto-run-%RUN_DATE%.done"
set "AUTO_LOCK=%LOG_DIR%\auto-run-%RUN_DATE%.lock"
set "LOG_FILE=%LOG_DIR%\capone-daily-%RUN_STAMP%.log"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

if exist "%AUTO_MARKER%" (
  echo [%RUN_STAMP%] Skipped: daily auto-run already completed today.>> "%LOG_DIR%\capone-daily-skipped.log"
  exit /b 0
)

if exist "%AUTO_LOCK%" (
  echo [%RUN_STAMP%] Skipped: daily auto-run already in progress.>> "%LOG_DIR%\capone-daily-skipped.log"
  exit /b 0
)

echo running> "%AUTO_LOCK%"

echo [%RUN_STAMP%] CAPONE LAB daily refresh started.> "%LOG_FILE%"
echo Project: %CD%>> "%LOG_FILE%"
echo Command: npm.cmd run collect:multibrand>> "%LOG_FILE%"
echo.>> "%LOG_FILE%"

call npm.cmd run collect:multibrand >> "%LOG_FILE%" 2>&1
set "EXIT_CODE=%ERRORLEVEL%"

echo.>> "%LOG_FILE%"
if %EXIT_CODE% equ 0 (
  echo [%RUN_STAMP%] Result: SUCCESS>> "%LOG_FILE%"
) else (
  echo [%RUN_STAMP%] Result: FAILED exit=%EXIT_CODE%>> "%LOG_FILE%"
)

del "%AUTO_LOCK%" 2>nul
echo done> "%AUTO_MARKER%"

exit /b %EXIT_CODE%
