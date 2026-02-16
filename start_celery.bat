@echo off
echo Starting Celery Worker...
echo.
call venv\Scripts\activate.bat
celery -A config worker --pool=gevent -l info
