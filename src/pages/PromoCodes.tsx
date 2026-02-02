import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Tag,
  Plus,
  Percent,
  DollarSign,
  Calendar,
  Users,
  Trash2,
  Edit2,
  Copy,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { usePromoCodes, useCreatePromoCode, useUpdatePromoCode, useDeletePromoCode } from '@/hooks/usePromoCodes';
import { PromoCode } from '@/types/database';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function PromoCodes() {
  const { data: promoCodes, isLoading } = usePromoCodes();
  const createPromo = useCreatePromoCode();
  const updatePromo = useUpdatePromoCode();
  const deletePromo = useDeletePromoCode();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<PromoCode | null>(null);
  
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: '',
    start_date: '',
    end_date: '',
    max_uses: '',
    max_uses_per_customer: '1',
    minimum_order_amount: '',
    is_active: true,
  });
  
  const resetForm = () => {
    setFormData({
      code: '',
      description: '',
      discount_type: 'percentage',
      discount_value: '',
      start_date: '',
      end_date: '',
      max_uses: '',
      max_uses_per_customer: '1',
      minimum_order_amount: '',
      is_active: true,
    });
    setEditingPromo(null);
  };
  
  const openEditDialog = (promo: PromoCode) => {
    setEditingPromo(promo);
    setFormData({
      code: promo.code,
      description: promo.description || '',
      discount_type: promo.discount_type,
      discount_value: promo.discount_value.toString(),
      start_date: promo.start_date ? format(new Date(promo.start_date), 'yyyy-MM-dd') : '',
      end_date: promo.end_date ? format(new Date(promo.end_date), 'yyyy-MM-dd') : '',
      max_uses: promo.max_uses?.toString() || '',
      max_uses_per_customer: promo.max_uses_per_customer.toString(),
      minimum_order_amount: promo.minimum_order_amount?.toString() || '',
      is_active: promo.is_active,
    });
    setIsDialogOpen(true);
  };
  
  const handleSubmit = async () => {
    if (!formData.code.trim()) {
      toast.error('Promo code is required');
      return;
    }
    if (!formData.discount_value || parseFloat(formData.discount_value) <= 0) {
      toast.error('Discount value must be greater than 0');
      return;
    }
    
    const promoData = {
      code: formData.code.toUpperCase().trim(),
      description: formData.description || null,
      discount_type: formData.discount_type,
      discount_value: parseFloat(formData.discount_value),
      start_date: formData.start_date ? new Date(formData.start_date).toISOString() : null,
      end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null,
      max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
      max_uses_per_customer: parseInt(formData.max_uses_per_customer) || 1,
      minimum_order_amount: formData.minimum_order_amount ? parseFloat(formData.minimum_order_amount) : null,
      is_active: formData.is_active,
    };
    
    if (editingPromo) {
      await updatePromo.mutateAsync({ id: editingPromo.id, ...promoData });
    } else {
      await createPromo.mutateAsync(promoData);
    }
    
    setIsDialogOpen(false);
    resetForm();
  };
  
  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard');
  };
  
  const getPromoStatus = (promo: PromoCode): { status: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } => {
    if (!promo.is_active) return { status: 'Inactive', variant: 'secondary' };
    
    const now = new Date();
    if (promo.start_date && new Date(promo.start_date) > now) {
      return { status: 'Scheduled', variant: 'outline' };
    }
    if (promo.end_date && new Date(promo.end_date) < now) {
      return { status: 'Expired', variant: 'destructive' };
    }
    if (promo.max_uses !== null && promo.current_uses >= promo.max_uses) {
      return { status: 'Limit Reached', variant: 'secondary' };
    }
    
    return { status: 'Active', variant: 'default' };
  };
  
  return (
    <AppLayout title="Promo Codes" subtitle="Manage discounts and promotions">
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Tag className="w-6 h-6 text-primary" />
            <span className="text-lg font-medium">{promoCodes?.length || 0} promo codes</span>
          </div>
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            New Promo Code
          </Button>
        </div>
        
        {/* Promo Codes Grid */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : promoCodes?.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="py-12 text-center">
              <Tag className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No promo codes yet</h3>
              <p className="text-muted-foreground mb-4">Create your first promo code to offer discounts</p>
              <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Create Promo Code
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {promoCodes?.map((promo) => {
              const { status, variant } = getPromoStatus(promo);
              return (
                <Card key={promo.id} className="shadow-card hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <code className="text-xl font-bold bg-muted px-3 py-1 rounded">{promo.code}</code>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyCode(promo.code)}>
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                      <Badge variant={variant}>{status}</Badge>
                    </div>
                    {promo.description && (
                      <p className="text-sm text-muted-foreground mt-2">{promo.description}</p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Discount Value */}
                    <div className="flex items-center gap-2">
                      {promo.discount_type === 'percentage' ? (
                        <Percent className="w-5 h-5 text-green-600" />
                      ) : (
                        <DollarSign className="w-5 h-5 text-green-600" />
                      )}
                      <span className="text-2xl font-bold text-green-600">
                        {promo.discount_type === 'percentage' 
                          ? `${promo.discount_value}% off`
                          : `$${promo.discount_value} off`}
                      </span>
                    </div>
                    
                    {/* Details */}
                    <div className="space-y-2 text-sm">
                      {(promo.start_date || promo.end_date) && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {promo.start_date && format(new Date(promo.start_date), 'MMM d')}
                            {promo.start_date && promo.end_date && ' - '}
                            {promo.end_date && format(new Date(promo.end_date), 'MMM d, yyyy')}
                          </span>
                        </div>
                      )}
                      
                      {promo.max_uses !== null && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Users className="w-4 h-4" />
                          <span>{promo.current_uses} / {promo.max_uses} uses</span>
                          {promo.current_uses >= promo.max_uses && (
                            <Badge variant="secondary" className="text-xs">Full</Badge>
                          )}
                        </div>
                      )}
                      
                      {promo.minimum_order_amount !== null && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <DollarSign className="w-4 h-4" />
                          <span>Min order: ${promo.minimum_order_amount}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Actions */}
                    <div className="flex gap-2 pt-2 border-t">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditDialog(promo)}>
                        <Edit2 className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDeleteConfirm(promo)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5" />
              {editingPromo ? 'Edit Promo Code' : 'Create Promo Code'}
            </DialogTitle>
            <DialogDescription>
              {editingPromo ? 'Update the promo code details' : 'Create a new discount code for customers'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Code */}
            <div className="space-y-2">
              <Label>Promo Code *</Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="e.g., SAVE20, WELCOME10"
                className="font-mono text-lg uppercase"
              />
              <p className="text-xs text-muted-foreground">This is what customers will enter at checkout</p>
            </div>
            
            {/* Description */}
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g., Summer sale discount"
              />
            </div>
            
            {/* Discount Type & Value */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Discount Type</Label>
                <Select 
                  value={formData.discount_type} 
                  onValueChange={(v: 'percentage' | 'fixed') => setFormData({ ...formData, discount_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Discount Value *</Label>
                <div className="relative">
                  {formData.discount_type === 'percentage' ? (
                    <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  ) : (
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  )}
                  <Input
                    type="number"
                    min="0"
                    step={formData.discount_type === 'percentage' ? '1' : '0.01'}
                    max={formData.discount_type === 'percentage' ? '100' : undefined}
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                    className="pl-9"
                    placeholder={formData.discount_type === 'percentage' ? '10' : '5.00'}
                  />
                </div>
              </div>
            </div>
            
            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date (optional)</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date (optional)</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>
            
            {/* Usage Limits */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max Total Uses</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.max_uses}
                  onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                  placeholder="Unlimited"
                />
                <p className="text-xs text-muted-foreground">Leave empty for unlimited</p>
              </div>
              <div className="space-y-2">
                <Label>Uses Per Customer</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.max_uses_per_customer}
                  onChange={(e) => setFormData({ ...formData, max_uses_per_customer: e.target.value })}
                />
              </div>
            </div>
            
            {/* Minimum Order */}
            <div className="space-y-2">
              <Label>Minimum Order Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.minimum_order_amount}
                  onChange={(e) => setFormData({ ...formData, minimum_order_amount: e.target.value })}
                  className="pl-9"
                  placeholder="No minimum"
                />
              </div>
            </div>
            
            {/* Active Toggle */}
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground">Promo code can be used by customers</p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={createPromo.isPending || updatePromo.isPending}
            >
              {editingPromo ? 'Update' : 'Create'} Promo Code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Promo Code?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.code}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirm) {
                  deletePromo.mutate(deleteConfirm.id);
                  setDeleteConfirm(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
