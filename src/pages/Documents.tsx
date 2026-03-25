import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Upload, FileText, Download } from 'lucide-react';
import { format } from 'date-fns';

type DocumentCategory = 'invoice' | 'book_ad' | 'supplier_sheet' | 'general';

interface DocumentFile {
  id: string;
  title: string;
  category: DocumentCategory;
  file_name: string;
  file_path: string;
  file_url: string;
  notes: string | null;
  created_at: string;
}

const categoryLabels: Record<DocumentCategory, string> = {
  invoice: 'Invoice',
  book_ad: 'Book Ad',
  supplier_sheet: 'Supplier Sheet',
  general: 'General',
};

export default function Documents() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('general');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents-files'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('document_files')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as DocumentFile[];
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Please choose a file');
      if (!title.trim()) throw new Error('Please enter a title');

      const safeName = file.name.replace(/\s+/g, '_');
      const filePath = `${category}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, { upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      const { error: insertError } = await (supabase as any)
        .from('document_files')
        .insert({
          title: title.trim(),
          category,
          file_name: file.name,
          file_path: filePath,
          file_url: urlData.publicUrl,
          notes: notes.trim() || null,
        });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents-files'] });
      setTitle('');
      setCategory('general');
      setNotes('');
      setFile(null);
      toast.success('Document uploaded');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Upload failed');
    },
  });

  return (
    <AppLayout title="Documents" subtitle="Central folder for invoices, ads, and supplier sheets">
      <div className="space-y-6">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload File
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Invoice #1843" />
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={(v: DocumentCategory) => setCategory(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invoice">Invoice</SelectItem>
                    <SelectItem value="book_ad">Book Ad</SelectItem>
                    <SelectItem value="supplier_sheet">Supplier Sheet</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Short note..." rows={3} />
            </div>

            <div className="space-y-2">
              <Label>File</Label>
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>

            <Button onClick={() => uploadMutation.mutate()} disabled={uploadMutation.isPending}>
              {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Saved Files
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : documents && documents.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">File</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">{doc.title}</TableCell>
                      <TableCell>{categoryLabels[doc.category]}</TableCell>
                      <TableCell>{format(new Date(doc.created_at), 'MMM d, yyyy')}</TableCell>
                      <TableCell className="max-w-[280px] truncate">{doc.notes || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" asChild>
                          <a href={doc.file_url} target="_blank" rel="noreferrer">
                            <Download className="w-3.5 h-3.5 mr-1" />
                            Open
                          </a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground">No files saved yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
