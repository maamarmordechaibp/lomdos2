import { useState } from 'react';
import { Search, Plus, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useCustomers, useCreateCustomer } from '@/hooks/useCustomers';
import { Customer } from '@/types/database';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CustomerSearchProps {
  onSelect: (customer: Customer) => void;
  selectedCustomer?: Customer | null;
}

export function CustomerSearch({ onSelect, selectedCustomer }: CustomerSearchProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    notification_preference: 'phone' as const,
  });

  const { data: customers, isLoading } = useCustomers(search);
  const createCustomer = useCreateCustomer();

  const handleCreateCustomer = async () => {
    const customer = await createCustomer.mutateAsync(newCustomer);
    onSelect(customer);
    setIsOpen(false);
    setNewCustomer({ name: '', phone: '', email: '', notification_preference: 'phone' });
  };

  const handleSelect = (customer: Customer) => {
    onSelect(customer);
    setShowResults(false);
    setSearch('');
  };

  if (selectedCustomer) {
    return (
      <Card className="p-4 bg-secondary/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">{selectedCustomer.name}</p>
              <p className="text-sm text-muted-foreground">{selectedCustomer.phone}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onSelect(null as any)}>
            Change
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
            className="pl-10"
          />
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon">
              <Plus className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">New Customer</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  placeholder="Customer name"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone *</Label>
                <Input
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  placeholder="Phone number"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                  placeholder="Email address"
                />
              </div>
              <div className="space-y-2">
                <Label>Notification Preference</Label>
                <Select
                  value={newCustomer.notification_preference}
                  onValueChange={(value: any) => setNewCustomer({ ...newCustomer, notification_preference: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">Phone Call</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={handleCreateCustomer} 
                className="w-full"
                disabled={!newCustomer.name || !newCustomer.phone || createCustomer.isPending}
              >
                Create Customer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {showResults && search && (
        <Card className="absolute z-50 w-full mt-1 max-h-60 overflow-auto shadow-elevated">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">Searching...</div>
          ) : customers && customers.length > 0 ? (
            <div className="py-1">
              {customers.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => handleSelect(customer)}
                  className="w-full px-4 py-3 text-left hover:bg-secondary/50 transition-colors flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{customer.name}</p>
                    <p className="text-sm text-muted-foreground">{customer.phone}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center">
              <p className="text-muted-foreground mb-2">No customers found</p>
              <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create "{search}"
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
