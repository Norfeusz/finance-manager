@echo off
echo Creating Manager Finansow Release Package...

set RELEASE_DIR=release
set APP_NAME=Manager-Finansow

if exist %RELEASE_DIR% (
    echo Cleaning old release...
    rmdir /s /q %RELEASE_DIR%
)

mkdir %RELEASE_DIR%

echo Building launcher...
go env -w GOOS=windows
go env -w GOARCH=amd64
go build -ldflags="-s -w" -o %RELEASE_DIR%\%APP_NAME%.exe launcher.go

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Build failed!
    pause
    exit /b 1
)

echo Copying configuration files...
copy launcher.json %RELEASE_DIR%\
copy package.json %RELEASE_DIR%\
copy package-lock.json %RELEASE_DIR%\
copy .env %RELEASE_DIR%\

echo Copying backend...
xcopy /E /I backend %RELEASE_DIR%\backend

echo Copying frontend...
xcopy /E /I frontend %RELEASE_DIR%\frontend

echo Creating run script...
echo @echo off > %RELEASE_DIR%\run.bat
echo echo Manager Finansow - Quick Start >> %RELEASE_DIR%\run.bat
echo echo ========================== >> %RELEASE_DIR%\run.bat
echo echo. >> %RELEASE_DIR%\run.bat
echo echo Installing dependencies... >> %RELEASE_DIR%\run.bat
echo npm install ^>nul 2^>^&1 >> %RELEASE_DIR%\run.bat
echo cd frontend >> %RELEASE_DIR%\run.bat
echo npm install ^>nul 2^>^&1 >> %RELEASE_DIR%\run.bat
echo cd .. >> %RELEASE_DIR%\run.bat
echo echo. >> %RELEASE_DIR%\run.bat
echo echo Starting Manager Finansow... >> %RELEASE_DIR%\run.bat
echo %APP_NAME%.exe >> %RELEASE_DIR%\run.bat

echo Creating README...
echo Manager Finansow - Release Package > %RELEASE_DIR%\README.txt
echo ================================= >> %RELEASE_DIR%\README.txt
echo. >> %RELEASE_DIR%\README.txt
echo Quick Start: >> %RELEASE_DIR%\README.txt
echo 1. Run: run.bat (installs dependencies and starts app) >> %RELEASE_DIR%\README.txt
echo. >> %RELEASE_DIR%\README.txt
echo Manual Start: >> %RELEASE_DIR%\README.txt
echo 1. npm install >> %RELEASE_DIR%\README.txt
echo 2. cd frontend && npm install && cd .. >> %RELEASE_DIR%\README.txt
echo 3. %APP_NAME%.exe >> %RELEASE_DIR%\README.txt
echo. >> %RELEASE_DIR%\README.txt
echo Configuration: >> %RELEASE_DIR%\README.txt
echo - Edit launcher.json to change ports/commands >> %RELEASE_DIR%\README.txt
echo - Edit .env for database and API settings >> %RELEASE_DIR%\README.txt
echo. >> %RELEASE_DIR%\README.txt
echo Requirements: >> %RELEASE_DIR%\README.txt
echo - Node.js 18+ >> %RELEASE_DIR%\README.txt
echo - PostgreSQL (configured in .env) >> %RELEASE_DIR%\README.txt

echo.
echo ✅ Release package created in %RELEASE_DIR%\ folder!
echo 📦 Package: %APP_NAME%.exe
echo 📁 Location: %RELEASE_DIR%\
echo.
echo To distribute: zip the entire %RELEASE_DIR% folder
echo Users can run: run.bat or %APP_NAME%.exe

pause