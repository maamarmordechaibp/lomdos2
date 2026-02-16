@echo off
echo Starting ALL services for Bookstore Management System
echo.
echo Opening 3 terminal windows...
echo.

start "Django Server" cmd /k "cd /d %~dp0 && start_django.bat"
timeout /t 2 /nobreak >nul
start "Celery Worker" cmd /k "cd /d %~dp0 && start_celery.bat"
timeout /t 2 /nobreak >nul
start "Celery Beat" cmd /k "cd /d %~dp0 && start_beat.bat"

echo.
echo ========================================
echo All services started!
echo ========================================
echo.
echo Django Server: http://localhost:8000
echo Admin Panel: http://localhost:8000/admin
echo.
echo Close those terminal windows to stop the services
echo.
pause
