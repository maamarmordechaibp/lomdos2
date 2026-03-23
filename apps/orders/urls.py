from django.urls import path
from . import views

app_name = 'orders'

urlpatterns = [
    path('', views.OrderListView.as_view(), name='order_list'),
    path('create/', views.OrderCreateView.as_view(), name='order_create'),
    path('<int:pk>/', views.OrderDetailView.as_view(), name='order_detail'),
    path('<int:pk>/payment/', views.RecordPaymentView.as_view(), name='record_payment'),
    path('<int:pk>/invoice/', views.InvoicePrintView.as_view(), name='invoice_print'),
]
