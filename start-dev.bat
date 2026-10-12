@echo off
cd /d "%~dp0"
echo Starting GEAR HUB Web Driver...
start http://localhost:5173
npm run dev
pause
