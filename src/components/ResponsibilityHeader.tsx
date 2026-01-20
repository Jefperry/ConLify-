import { AlertCircle, Clock, Crown, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { RoleIndicator } from '@/components/ui/role-badge';
import { cn } from '@/lib/utils';
import type { MemberRole } from '@/types/database';

interface ResponsibilityHeaderProps {
  // User info
  userName: string;
  role: MemberRole;
  
  // Group status (for presidents)
  unpaidCount?: number;
  pendingCount?: number;
  
  // Cycle info
  hasCycle?: boolean;
  daysUntilDue?: number;
  cycleDueDate?: string;
  
  // Personal status (for members)
  personalStatus?: 'paid' | 'pending' | 'unpaid';
  
  className?: string;
}

/**
 * Responsibility Header Component
 * 
 * For Presidents: Shows group attention needs
 * "Your group needs attention"
 * 🔴 2 members haven't paid this cycle
 * ⏰ Next payment due in 3 days
 * 👤 You are the Group President
 * 
 * For Members: Shows personal status
 * "Your payment status"
 * 🟢 Payment verified / 🟡 Payment pending / 🔴 Payment due
 */
export function ResponsibilityHeader({
  userName,
  role,
  unpaidCount = 0,
  pendingCount = 0,
  hasCycle = false,
  daysUntilDue,
  cycleDueDate,
  personalStatus,
  className,
}: ResponsibilityHeaderProps) {
  const isPresident = role === 'president' || role === 'vice_president';
  const needsAttention = unpaidCount > 0 || pendingCount > 0;
  const totalOutstanding = unpaidCount + pendingCount;

  // Determine header state
  const getHeaderState = () => {
    if (!hasCycle) {
      return {
        title: `Good to see you, ${userName}`,
        variant: 'neutral' as const,
        message: 'No active payment cycle right now.',
      };
    }

    if (isPresident) {
      if (needsAttention) {
        return {
          title: 'Your group needs attention',
          variant: 'warning' as const,
          message: null,
        };
      }
      return {
        title: 'Everyone is on track!',
        variant: 'success' as const,
        message: 'All members have paid this cycle.',
      };
    }

    // Member view
    if (personalStatus === 'paid') {
      return {
        title: `You're all set, ${userName}!`,
        variant: 'success' as const,
        message: 'Your payment has been verified.',
      };
    }
    if (personalStatus === 'pending') {
      return {
        title: 'Payment awaiting verification',
        variant: 'pending' as const,
        message: 'The president will verify your payment soon.',
      };
    }
    return {
      title: 'Payment due',
      variant: 'warning' as const,
      message: cycleDueDate ? `Due by ${cycleDueDate}` : 'Please make your contribution.',
    };
  };

  const state = getHeaderState();

  const variantStyles = {
    neutral: 'bg-card border-border/50',
    warning: 'bg-amber-500/5 border-amber-500/20',
    success: 'bg-green-500/5 border-green-500/20',
    pending: 'bg-blue-500/5 border-blue-500/20',
  };

  const variantIcon = {
    neutral: null,
    warning: AlertCircle,
    success: CheckCircle,
    pending: Clock,
  };

  const Icon = variantIcon[state.variant];

  return (
    <Card className={cn('card-elevated overflow-hidden', variantStyles[state.variant], className)}>
      <CardContent className="pt-6 pb-5">
        <div className="space-y-3">
          {/* Header Title */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {Icon && (
                <div className={cn(
                  'p-2 rounded-xl',
                  state.variant === 'warning' && 'bg-amber-500/10',
                  state.variant === 'success' && 'bg-green-500/10',
                  state.variant === 'pending' && 'bg-blue-500/10',
                )}>
                  <Icon className={cn(
                    'h-5 w-5',
                    state.variant === 'warning' && 'text-amber-600',
                    state.variant === 'success' && 'text-green-600',
                    state.variant === 'pending' && 'text-blue-600',
                  )} />
                </div>
              )}
              <div>
                <h2 className="text-xl font-semibold text-foreground">{state.title}</h2>
                {state.message && (
                  <p className="text-sm text-muted-foreground mt-0.5">{state.message}</p>
                )}
              </div>
            </div>
            <RoleIndicator role={role} className="flex-shrink-0" />
          </div>

          {/* Status Details (President only, when needs attention) */}
          {isPresident && hasCycle && needsAttention && (
            <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 border-t border-border/50">
              {unpaidCount > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span className="text-muted-foreground">
                    {unpaidCount} {unpaidCount === 1 ? 'member hasn\'t' : 'members haven\'t'} paid
                  </span>
                </div>
              )}
              {pendingCount > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-muted-foreground">
                    {pendingCount} {pendingCount === 1 ? 'payment' : 'payments'} awaiting verification
                  </span>
                </div>
              )}
              {daysUntilDue !== undefined && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {daysUntilDue === 0 
                      ? 'Due today' 
                      : daysUntilDue < 0 
                        ? `Overdue by ${Math.abs(daysUntilDue)} days`
                        : `Due in ${daysUntilDue} days`
                    }
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Simple greeting for when there's no group context
 */
export function SimpleGreeting({ 
  userName, 
  message,
  className 
}: { 
  userName: string; 
  message?: string;
  className?: string;
}) {
  return (
    <div className={cn('mb-6', className)}>
      <h2 className="text-2xl font-semibold text-foreground">
        Good to see you, {userName}!
      </h2>
      {message && (
        <p className="text-muted-foreground mt-1">{message}</p>
      )}
    </div>
  );
}
