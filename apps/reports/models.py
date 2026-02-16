from django.db import models

# Permissions model for reports
class ReportPermissions(models.Model):
    class Meta:
        managed = False  # No database table
        default_permissions = ()
        permissions = [
            ('view_sales_report', 'Can view sales reports'),
            ('view_profit_analysis', 'Can view profit analysis'),
            ('view_customer_history', 'Can view customer purchase history'),
            ('export_reports', 'Can export reports'),
            ('view_dashboard', 'Can view dashboard'),
        ]
