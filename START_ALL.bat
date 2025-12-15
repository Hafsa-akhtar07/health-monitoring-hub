@echo off
echo ========================================
echo Starting HMH Project Services
echo ========================================
echo.

echo [1/3] Starting Python OCR Service (ocr-code)...
start "Python OCR Service" cmd /k "cd backend\ocr-code && python app.py"
timeout /t 3 /nobreak >nul

echo [2/3] Starting Node.js Backend...
start "Node.js Backend" cmd /k "cd backend && node server.js"
timeout /t 3 /nobreak >nul

echo [3/3] Starting Frontend...
start "Frontend" cmd /k "cd frontend && npm run dev"
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo All services starting...
echo ========================================
echo Python OCR: http://localhost:5002
echo Node.js API: http://localhost:5000
echo Frontend: http://localhost:5173
echo.
echo Press any key to exit...
pause >nul

