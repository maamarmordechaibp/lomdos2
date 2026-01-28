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
import { Label } from '@/components/ui/label';
import { Phone, MessageSquare, Mail, Loader2 } from 'lucide-react';
import { useNotifyCustomer } from '@/hooks/useNotifications';
import { NotificationType } from '@/services/notificationService';
import { Customer } from '@/types/database';

interface NotifyButtonProps {
  customer: Customer;
  customerOrderId: string;
  bookTitle?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function NotifyButton({ 
  customer, 
  customerOrderId, 
  bookTitle,
  variant = 'outline',
  size = 'sm',
}: NotifyButtonProps) {
  const [open, setOpen] = useState(false);
  const [notificationType, setNotificationType] = useState<NotificationType>('order_ready');
  const [customMessage, setCustomMessage] = useState('');
  
  const notifyMutation = useNotifyCustomer();

  const getPreferenceIcon = () => {
    switch (customer.notification_preference) {
      case 'phone':
        return <Phone className="w-4 h-4" />;
      case 'email':
        return <Mail className="w-4 h-4" />;
      default:
        return <Phone className="w-4 h-4" />;
    }
  };

  const getDefaultMessage = (type: NotificationType) => {
    const name = customer.name;
    const book = bookTitle || 'your book';
    
    switch (type) {
      case 'order_ready':
        return `Hello ${name}, your order for "${book}" is ready for pickup at our store. Thank you!`;
      case 'order_received':
        return `Hello ${name}, we've received "${book}" and it's being processed. We'll notify you when it's ready for pickup.`;
      case 'custom':
        return '';
    }
  };

  const handleNotify = async () => {
    await notifyMutation.mutateAsync({
      customerId: customer.id,
      customerOrderId,
      notificationType,
      customMessage: notificationType === 'custom' ? customMessage : undefined,
    });
    setOpen(false);
    setCustomMessage('');
    setNotificationType('order_ready');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          {getPreferenceIcon()}
          <span className="ml-2">Notify</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Notify Customer</DialogTitle>
          <DialogDescription>
            Send a notification to {customer.name} via {customer.notification_preference}
            {customer.notification_preference !== 'email' && ` (${customer.phone})`}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Notification Type</Label>
            <Select value={notificationType} onValueChange={(v) => setNotificationType(v as NotificationType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="order_ready">Order Ready for Pickup</SelectItem>
                <SelectItem value="order_received">Order Received</SelectItem>
                <SelectItem value="custom">Custom Message</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {notificationType === 'custom' ? (
            <div className="space-y-2">
              <Label>Custom Message</Label>
              <Textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Enter your custom message..."
                rows={4}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Message Preview</Label>
              <div className="p-3 bg-muted rounded-md text-sm">
                {getDefaultMessage(notificationType)}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {getPreferenceIcon()}
            <span>
              Will be sent via {customer.notification_preference}
              {customer.notification_preference === 'phone' && ' (automated call)'}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleNotify} 
            disabled={notifyMutation.isPending || (notificationType === 'custom' && !customMessage.trim())}
          >
            {notifyMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                {getPreferenceIcon()}
                <span className="ml-2">Send Notification</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
