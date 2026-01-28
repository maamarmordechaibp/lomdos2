import { cn } from '@/lib/utils';
import { OrderStatus } from '@/types/database';

const statusConfig: Record<OrderStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-warning/10 text-warning border-warning/20' },
  ordered: { label: 'Ordered', className: 'bg-primary/10 text-primary border-primary/20' },
  received: { label: 'Received', className: 'bg-accent/10 text-accent border-accent/20' },
  ready: { label: 'Ready', className: 'bg-success/10 text-success border-success/20' },
  picked_up: { label: 'Picked Up', className: 'bg-muted text-muted-foreground border-border' },
  cancelled: { label: 'Cancelled', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

interface OrderStatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
      config.className,
      className
    )}>
      {config.label}
    </span>
  );
}
