@echo off
echo Building Manager Finansow Launcher...

echo Setting Go environment for Windows...
go env -w GOOS=windows
go env -w GOARCH=amd64

echo Building executable...
go build -ldflags="-s -w" -o launcher.exe launcher.go

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Build successful!
    echo 📁 launcher.exe created
    echo.
    echo To run: .\launcher.exe
    echo To build release: run build-release.bat
) else (
    echo.
    echo ❌ Build failed!
    echo Check Go installation and try again.
)

pause