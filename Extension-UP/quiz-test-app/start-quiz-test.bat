@echo off
cd /d "%~dp0"
echo Checking Quiz Test Center at http://localhost:5175
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $response = Invoke-WebRequest -Uri 'http://127.0.0.1:5175/api/quizzes' -UseBasicParsing -TimeoutSec 2; if ($response.StatusCode -eq 200) { exit 0 } } catch { exit 1 }"
if %ERRORLEVEL% EQU 0 (
  echo Quiz Test Center is already running.
  start "" "http://localhost:5175"
  pause
  exit /b 0
)

echo Starting Quiz Test Center at http://localhost:5175
start "" "http://localhost:5175"
node server.js
pause
