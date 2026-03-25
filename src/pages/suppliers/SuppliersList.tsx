import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Truck, 
  Plus,
  Mail,
  Phone,
  MapPin,
  ArrowRight
} from 'lucide-react';
import { useSuppliers, useCreateSupplier } from '@/hooks/useSuppliers';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function SuppliersList() {
  const [isOpen, setIsOpen] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
  });

  const { data: suppliers, isLoading } = useSuppliers();
  const createSupplier = useCreateSupplier();

  const handleCreate = async () => {
    await createSupplier.mutateAsync({
      name: newSupplier.name,
      email: newSupplier.email,
      phone: newSupplier.phone || null,
      address: newSupplier.address || null,
      notes: newSupplier.notes || null,
    });
    setIsOpen(false);
    setNewSupplier({ name: '', email: '', phone: '', address: '', notes: '' });
  };

  return (
    <AppLayout 
      title="Suppliers" 
      subtitle="Manage your book suppliers"
      actions={
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Supplier
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">New Supplier</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                  placeholder="Supplier name"
                />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={newSupplier.email}
                  onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                  placeholder="Email address for orders"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={newSupplier.phone}
                  onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                  placeholder="Phone number"
                />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Textarea
                  value={newSupplier.address}
                  onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                  placeholder="Supplier address"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={newSupplier.notes}
                  onChange={(e) => setNewSupplier({ ...newSupplier, notes: e.target.value })}
                  placeholder="Any additional notes..."
                  rows={2}
                />
              </div>
              <div className="sticky bottom-0 bg-background pt-2">
                <Button 
                  onClick={handleCreate} 
                  className="w-full"
                  disabled={!newSupplier.name || !newSupplier.email || createSupplier.isPending}
                >
                  Create Supplier
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="space-y-6 animate-fade-in">
        {/* Suppliers List */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading suppliers...</div>
        ) : suppliers && suppliers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map((supplier) => (
              <Card key={supplier.id} className="shadow-soft hover:shadow-card transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Truck className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{supplier.name}</h3>
                      <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                        <p className="flex items-center gap-2 truncate">
                          <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                          {supplier.email}
                        </p>
                        {supplier.phone && (
                          <p className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5" />
                            {supplier.phone}
                          </p>
                        )}
                        {supplier.address && (
                          <p className="flex items-center gap-2 truncate">
                            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                            {supplier.address}
                          </p>
                        )}
                      </div>
                      <Button variant="link" asChild className="p-0 h-auto mt-3">
                        <Link to={`/suppliers/${supplier.id}`}>
                          View details <ArrowRight className="w-4 h-4 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="shadow-soft">
            <CardContent className="py-12 text-center">
              <Truck className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground">No suppliers found</p>
              <Button onClick={() => setIsOpen(true)} className="mt-4">
                Add your first supplier
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
