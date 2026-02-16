"""
Documents views
"""
from django.shortcuts import render
from django.views.generic import ListView, CreateView, DetailView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.urls import reverse_lazy
from .models import Document


class DocumentListView(LoginRequiredMixin, ListView):
    """List all documents with filtering."""
    model = Document
    template_name = 'documents/document_list.html'
    context_object_name = 'documents'
    paginate_by = 20
    
    def get_queryset(self):
        queryset = Document.objects.all()
        
        # Filter by document type
        doc_type = self.request.GET.get('type')
        if doc_type:
            queryset = queryset.filter(document_type=doc_type)
        
        # Search
        search = self.request.GET.get('search')
        if search:
            queryset = queryset.filter(
                title__icontains=search
            ) | queryset.filter(
                reference_number__icontains=search
            ) | queryset.filter(
                tags__icontains=search
            )
        
        return queryset
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['document_types'] = Document.DOCUMENT_TYPE_CHOICES
        return context


class DocumentCreateView(LoginRequiredMixin, CreateView):
    """Upload a new document."""
    model = Document
    template_name = 'documents/document_form.html'
    fields = ['title', 'document_type', 'file', 'document_date', 
              'reference_number', 'notes', 'tags']
    success_url = reverse_lazy('documents:document_list')
    
    def form_valid(self, form):
        form.instance.uploaded_by = self.request.user
        return super().form_valid(form)


class DocumentDetailView(LoginRequiredMixin, DetailView):
    """View document details."""
    model = Document
    template_name = 'documents/document_detail.html'
    context_object_name = 'document'
