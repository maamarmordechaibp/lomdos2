import { useNotificationLogs } from '@/hooks/useNotifications';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, MessageSquare, Mail, CheckCircle, XCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface NotificationHistoryProps {
  customerId?: string;
  limit?: number;
}

export function NotificationHistory({ customerId, limit = 10 }: NotificationHistoryProps) {
  const { data: logs, isLoading } = useNotificationLogs(customerId);

  const displayLogs = limit ? logs?.slice(0, limit) : logs;

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'phone':
        return <Phone className="w-4 h-4" />;
      case 'sms':
        return <MessageSquare className="w-4 h-4" />;
      case 'email':
        return <Mail className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge variant="default" className="bg-green-500">Sent</Badge>;
      case 'delivered':
        return <Badge variant="default" className="bg-green-600">Delivered</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'order_ready':
        return 'Order Ready';
      case 'order_received':
        return 'Order Received';
      case 'custom':
        return 'Custom Message';
      default:
        return type;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading notification history...
        </CardContent>
      </Card>
    );
  }

  if (!displayLogs || displayLogs.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No notifications sent yet
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Notification History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {displayLogs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-background">
                {getMethodIcon(log.notification_method)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">{getTypeLabel(log.notification_type)}</span>
                  {getStatusBadge(log.status)}
                </div>
                <p className="text-sm text-muted-foreground truncate">{log.message}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                </p>
              </div>
              {getStatusIcon(log.status)}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
