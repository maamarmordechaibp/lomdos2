import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Search,
  Plus,
  Phone,
  Mail,
  Bell,
  DollarSign,
  ChevronRight,
} from 'lucide-react';
import { useCustomers, useCreateCustomer } from '@/hooks/useCustomers';
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

export default function CustomersList() {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    notification_preference: 'phone' as const,
  });

  const { data: customers, isLoading } = useCustomers(search);
  const createCustomer = useCreateCustomer();

  const handleCreate = async () => {
    await createCustomer.mutateAsync(newCustomer);
    setIsOpen(false);
    setNewCustomer({ name: '', phone: '', email: '', notification_preference: 'phone' });
  };

  const notificationLabels = {
    phone: 'Phone Call',
    sms: 'SMS',
    email: 'Email',
  };

  return (
    <AppLayout 
      title="Customers" 
      subtitle="Manage your customer database"
      actions={
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="font-display">New Customer</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4 overflow-y-auto flex-1 pr-2">
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
                onClick={handleCreate} 
                className="w-full"
                disabled={!newCustomer.name || !newCustomer.phone || createCustomer.isPending}
              >
                Create Customer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="space-y-6 animate-fade-in">
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Customers List */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading customers...</div>
        ) : customers && customers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customers.map((customer) => (
              <Link key={customer.id} to={`/customers/${customer.id}`} className="block">
                <Card className="shadow-soft hover:shadow-card hover:border-primary/30 transition-all cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Users className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-medium truncate">{customer.name}</h3>
                          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        </div>
                        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                          <p className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5" />
                            {customer.phone}
                          </p>
                          {customer.email && (
                            <p className="flex items-center gap-2 truncate">
                              <Mail className="w-3.5 h-3.5" />
                              {customer.email}
                            </p>
                          )}
                          <p className="flex items-center gap-2">
                            <Bell className="w-3.5 h-3.5" />
                            {notificationLabels[customer.notification_preference]}
                          </p>
                          {(customer.outstanding_balance || 0) > 0 && (
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="destructive" className="flex items-center gap-1">
                                <DollarSign className="w-3 h-3" />
                                Balance: ${(customer.outstanding_balance || 0).toFixed(2)}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="shadow-soft">
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground">No customers found</p>
              <Button onClick={() => setIsOpen(true)} className="mt-4">
                Add your first customer
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
