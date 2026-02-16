@echo off
echo Starting Celery Beat Scheduler...
echo.
call venv\Scripts\activate.bat
celery -A config beat -l info
