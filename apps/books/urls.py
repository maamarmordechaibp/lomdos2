from django.urls import path
from . import views

app_name = 'books'

urlpatterns = [
    # List view
    path('', views.BookListView.as_view(), name='book_list'),
    path('<int:pk>/', views.BookDetailView.as_view(), name='book_detail'),
    
    # Autocomplete endpoints
    path('autocomplete/', views.BookAutocomplete.as_view(), name='autocomplete'),
    path('author-autocomplete/', views.AuthorAutocomplete.as_view(), name='author-autocomplete'),
    
    # AJAX endpoints
    path('create-ajax/', views.create_book_ajax, name='create_ajax'),
    
    # Barcode lookup
    path('lookup/<str:isbn>/', views.book_lookup, name='lookup'),
]
