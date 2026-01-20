import { cn } from '@/lib/utils';

type StatusType = 'paid' | 'pending' | 'unpaid' | 'late' | 'verified' | 'rejected' | 'active' | 'locked';

interface StatusDotProps {
  status: StatusType;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  className?: string;
}

const statusColors: Record<StatusType, string> = {
  paid: 'bg-green-500',
  verified: 'bg-green-500',
  active: 'bg-green-500',
  pending: 'bg-amber-500',
  unpaid: 'bg-gray-400',
  late: 'bg-red-500',
  rejected: 'bg-red-500',
  locked: 'bg-red-500',
};

const sizeClasses = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4',
};

/**
 * Status dot component for visual status indication
 * Uses 🟢🟡🔴 color system for human-friendly status display
 */
export function StatusDot({ status, size = 'md', pulse = false, className }: StatusDotProps) {
  return (
    <span
      className={cn(
        'inline-block rounded-full flex-shrink-0',
        statusColors[status],
        sizeClasses[size],
        pulse && 'animate-pulse',
        className
      )}
      aria-label={status}
    />
  );
}

/**
 * Status dot with label
 */
interface StatusWithLabelProps extends StatusDotProps {
  label?: string;
}

export function StatusWithLabel({ status, size = 'sm', label, className }: StatusWithLabelProps) {
  const defaultLabels: Record<StatusType, string> = {
    paid: 'Paid',
    verified: 'Verified',
    active: 'Active',
    pending: 'Pending',
    unpaid: 'Unpaid',
    late: 'Late',
    rejected: 'Rejected',
    locked: 'Locked',
  };

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <StatusDot status={status} size={size} />
      <span className="text-sm text-muted-foreground">{label || defaultLabels[status]}</span>
    </span>
  );
}
