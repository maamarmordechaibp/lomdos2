# Generated migration for OrderItem discount fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0001_initial'),  # Adjust this to your last migration
    ]

    operations = [
        migrations.AddField(
            model_name='orderitem',
            name='original_price',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text='Original price before discount',
                max_digits=10,
                null=True
            ),
        ),
        migrations.AddField(
            model_name='orderitem',
            name='discount_percentage',
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                help_text='Discount percentage applied',
                max_digits=5
            ),
        ),
    ]
