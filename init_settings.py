import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.pricing.models import GlobalSettings

# Create or get the singleton settings
settings, created = GlobalSettings.objects.get_or_create(pk=1)

if created:
    settings.default_margin_percentage = 20.0  # 20% default margin
    settings.save()
    print('GlobalSettings created with 20% default margin.')
else:
    print(f'GlobalSettings already exists with {settings.default_margin_percentage}% default margin.')
