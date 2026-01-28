import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Loader2, Send } from 'lucide-react';
import { useEmailSupplier } from '@/hooks/useSupplierEmail';
import { SupplierEmailType } from '@/services/supplierEmailService';
import { Supplier } from '@/types/database';

interface EmailSupplierButtonProps {
  supplier: Supplier;
  supplierOrderId: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function EmailSupplierButton({ 
  supplier, 
  supplierOrderId, 
  variant = 'outline',
  size = 'sm',
}: EmailSupplierButtonProps) {
  const [open, setOpen] = useState(false);
  const [emailType, setEmailType] = useState<SupplierEmailType>('new_order');
  const [customSubject, setCustomSubject] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  
  const emailMutation = useEmailSupplier();

  const handleSend = async () => {
    await emailMutation.mutateAsync({
      supplierId: supplier.id,
      supplierOrderId,
      emailType,
      customSubject: emailType === 'custom' ? customSubject : undefined,
      customMessage: emailType === 'custom' ? customMessage : undefined,
    });
    setOpen(false);
    setCustomSubject('');
    setCustomMessage('');
    setEmailType('new_order');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          <Mail className="w-4 h-4" />
          <span className="ml-2">Email Supplier</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Email Supplier</DialogTitle>
          <DialogDescription>
            Send an email to {supplier.name} ({supplier.email})
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Email Type</Label>
            <Select value={emailType} onValueChange={(v) => setEmailType(v as SupplierEmailType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new_order">New Order Request</SelectItem>
                <SelectItem value="order_update">Order Update</SelectItem>
                <SelectItem value="custom">Custom Message</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {emailType === 'custom' && (
            <>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  placeholder="Enter email subject..."
                />
              </div>
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Enter your message..."
                  rows={6}
                />
              </div>
            </>
          )}

          {emailType !== 'custom' && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                {emailType === 'new_order' && (
                  <>
                    An email will be sent with the order details, including all books and quantities. 
                    The supplier will be asked to confirm receipt and provide an estimated delivery date.
                  </>
                )}
                {emailType === 'order_update' && (
                  <>
                    An email will be sent with the current order status and any notes associated with the order.
                  </>
                )}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={emailMutation.isPending || (emailType === 'custom' && (!customSubject.trim() || !customMessage.trim()))}
          >
            {emailMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
