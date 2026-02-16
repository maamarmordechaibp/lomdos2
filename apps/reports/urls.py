from django.urls import path
from . import views

app_name = 'reports'

urlpatterns = [
    # Financial reports
    path('financial/', views.FinancialReportView.as_view(), name='financial'),
    path('payments/', views.PaymentsView.as_view(), name='payments'),
]
