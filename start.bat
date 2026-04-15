@echo off
cd /d "%~dp0"

echo Starting Vesper Launcher...
echo.

if not exist "target\release\vesper-ui.exe" (
    echo Building release build...
    cargo build --release
    if errorlevel 1 (
        echo Build failed!
        pause
        exit /b 1
    )
)

start "" "target\release\vesper-supervisor.exe"
timeout /t 2 /nobreak >nul
start "" "target\release\vesper-ui.exe"

echo Launcher started!
exit /b 0