:: run-app-preview.bat
@echo off
setlocal
REM Launch Windows APP (Electron) in PREVIEW (sandbox/limbo) mode

set VITE_PREVIEW_MODE=true
REM Start Vite dev server in a new window
start "" cmd /c "npm run dev"

REM Give Vite a moment to boot (adjust if needed)
timeout /t 5 >nul

REM Launch Electron pointing at the dev server
npx electron electron/main.cjs --dev
endlocal
