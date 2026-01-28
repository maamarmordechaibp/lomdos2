import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  Book,
  User,
  Truck
} from 'lucide-react';
import { usePendingSupplierAssignments, useAssignSupplier } from '@/hooks/useOrders';
import { useSuppliers } from '@/hooks/useSuppliers';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export default function PendingSupplier() {
  const { data: pendingItems, isLoading } = usePendingSupplierAssignments();
  const { data: suppliers } = useSuppliers();
  const assignSupplier = useAssignSupplier();
  
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');

  const handleAssign = async () => {
    if (!selectedItem || !selectedSupplierId) return;
    
    await assignSupplier.mutateAsync({
      bookId: selectedItem.book_id,
      supplierId: selectedSupplierId,
      pendingAssignmentId: selectedItem.id,
    });
    
    setSelectedItem(null);
    setSelectedSupplierId('');
  };

  return (
    <AppLayout 
      title="Pending Supplier Assignment" 
      subtitle="Books that need a supplier assigned"
    >
      <div className="space-y-6 animate-fade-in">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : pendingItems && pendingItems.length > 0 ? (
          <div className="space-y-3">
            {pendingItems.map((item) => (
              <Card key={item.id} className="shadow-soft hover:shadow-card transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center flex-shrink-0">
                        <Book className="w-6 h-6 text-warning" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium">{item.book?.title}</h3>
                        {item.book?.title_hebrew && (
                          <p className="text-sm text-muted-foreground" dir="rtl">
                            {item.book.title_hebrew}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            {item.customer_order?.customer?.name}
                          </span>
                          <span>Qty: {item.customer_order?.quantity}</span>
                        </div>
                      </div>
                    </div>
                    <Button onClick={() => setSelectedItem(item)}>
                      <Truck className="w-4 h-4 mr-2" />
                      Assign Supplier
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="shadow-soft">
            <CardContent className="py-12 text-center">
              <AlertTriangle className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground">No books pending supplier assignment</p>
              <p className="text-sm text-muted-foreground mt-1">
                All books have suppliers assigned
              </p>
            </CardContent>
          </Card>
        )}

        {/* Assign Supplier Dialog */}
        <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">Assign Supplier</DialogTitle>
            </DialogHeader>
            {selectedItem && (
              <div className="space-y-4 mt-4">
                <div className="p-4 bg-secondary/30 rounded-lg">
                  <p className="font-medium">{selectedItem.book?.title}</p>
                  {selectedItem.book?.author && (
                    <p className="text-sm text-muted-foreground">by {selectedItem.book.author}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Select Supplier</Label>
                  <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a supplier..." />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers?.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {suppliers?.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No suppliers available. Please add a supplier first.
                  </p>
                )}

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setSelectedItem(null)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleAssign}
                    disabled={!selectedSupplierId || assignSupplier.isPending}
                  >
                    {assignSupplier.isPending ? 'Assigning...' : 'Assign Supplier'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
