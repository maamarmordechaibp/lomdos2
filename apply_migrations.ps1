# Apply All New Migrations
# Run this script to apply all the new features to your database

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Bookstore Management - Database Migrations" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Ensure we're in the right directory
$projectRoot = "c:\Users\congt\Downloads\books"
Set-Location $projectRoot

Write-Host "1. Making migrations..." -ForegroundColor Yellow
python manage.py makemigrations

Write-Host ""
Write-Host "2. Applying orders migrations (discount fields)..." -ForegroundColor Yellow
python manage.py migrate orders

Write-Host ""
Write-Host "3. Applying documents migrations..." -ForegroundColor Yellow
python manage.py migrate documents

Write-Host ""
Write-Host "4. Applying customers migrations (gift cards & payments)..." -ForegroundColor Yellow
python manage.py migrate customers

Write-Host ""
Write-Host "5. Applying all remaining migrations..." -ForegroundColor Yellow
python manage.py migrate

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "  Migration Complete!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""

Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Test the new features in Django admin"
Write-Host "2. Visit /documents/ to upload documents"
Write-Host "3. Create gift cards in admin"
Write-Host "4. Configure voicemail (see VOICEMAIL_SETUP.md)"
Write-Host ""

Write-Host "To start the server:" -ForegroundColor Yellow
Write-Host "  python manage.py runserver"
Write-Host ""
