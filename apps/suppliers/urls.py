from django.urls import path
from . import views

app_name = 'suppliers'

urlpatterns = [
    # Supplier management
    path('', views.SupplierListView.as_view(), name='supplier_list'),
    path('<int:pk>/', views.SupplierDetailView.as_view(), name='supplier_detail'),
    path('create-ajax/', views.CreateSupplierAjaxView.as_view(), name='create_ajax'),
    
    # Books pending supplier assignment
    path('pending-assignment/', views.PendingSupplierBooksView.as_view(), name='pending_assignment'),
    path('assign-supplier/', views.AssignSupplierView.as_view(), name='assign_supplier'),
    path('assign-book-supplier/', views.AssignBookSupplierView.as_view(), name='assign_book_supplier'),
    path('send-quote-request/', views.SendQuoteRequestView.as_view(), name='send_quote_request'),
    path('send-book-quote-request/', views.SendBookQuoteRequestView.as_view(), name='send_book_quote_request'),
    
    # Supplier orders
    path('orders/', views.SupplierOrdersView.as_view(), name='supplier_orders'),
    path('orders/create/', views.CreateSupplierOrderView.as_view(), name='create_order'),
    path('orders/send-email/', views.SendSupplierEmailView.as_view(), name='send_email'),
    
    # Receiving
    path('receiving/', views.PendingReceivingView.as_view(), name='pending_receiving'),
    path('receiving/<int:pk>/', views.ReceiveItemsView.as_view(), name='receive_items'),
]
