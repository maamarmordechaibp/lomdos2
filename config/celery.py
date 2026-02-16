"""
Celery configuration for bookstore project.
"""

import os
from celery import Celery
from celery.schedules import crontab

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('bookstore')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
# - namespace='CELERY' means all celery-related configuration keys
#   should have a `CELERY_` prefix.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django apps.
app.autodiscover_tasks()

# Periodic tasks configuration
app.conf.beat_schedule = {
    'send-queued-emails-every-minute': {
        'task': 'post_office.tasks.send_queued_mail',
        'schedule': crontab(minute='*/1'),  # Every minute
    },
    'cleanup-old-emails-daily': {
        'task': 'post_office.tasks.cleanup_mail',
        'schedule': crontab(hour=3, minute=0),  # 3 AM daily
        'kwargs': {'days': 30},
    },
}


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
