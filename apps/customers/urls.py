from django.urls import path
from . import views

app_name = 'customers'

urlpatterns = [
    # List and detail views
    path('', views.CustomerListView.as_view(), name='customer_list'),
    path('<int:pk>/', views.CustomerDetailView.as_view(), name='customer_detail'),
    
    # Autocomplete endpoint
    path('autocomplete/', views.CustomerAutocomplete.as_view(), name='autocomplete'),
    # AJAX create endpoint
    path('create-ajax/', views.create_customer_ajax, name='create_ajax'),
]
