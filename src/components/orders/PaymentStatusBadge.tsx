import { cn } from '@/lib/utils';
import { PaymentStatus } from '@/types/database';

const statusConfig: Record<PaymentStatus, { label: string; className: string }> = {
  unpaid: { label: 'Unpaid', className: 'bg-red-500/10 text-red-600 border-red-500/20' },
  partial: { label: 'Partial', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  paid: { label: 'Paid', className: 'bg-green-500/10 text-green-600 border-green-500/20' },
  pay_at_pickup: { label: 'Pay at Pickup', className: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
};

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
  className?: string;
}

export function PaymentStatusBadge({ status, className }: PaymentStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.unpaid;
  
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
