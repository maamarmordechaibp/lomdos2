@echo off
echo Starting Django Development Server...
echo.
call venv\Scripts\activate.bat
python manage.py runserver
