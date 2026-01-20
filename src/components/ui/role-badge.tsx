import { Crown, Shield, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MemberRole } from '@/types/database';

interface RoleBadgeProps {
  role: MemberRole;
  size?: 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
}

const roleConfig: Record<MemberRole, { 
  label: string; 
  icon: typeof Crown; 
  className: string;
}> = {
  president: {
    label: 'President',
    icon: Crown,
    className: 'bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20',
  },
  vice_president: {
    label: 'Vice President',
    icon: Shield,
    className: 'bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/20',
  },
  member: {
    label: 'Member',
    icon: User,
    className: 'bg-gray-500/10 text-gray-600 border-gray-500/20 hover:bg-gray-500/20',
  },
};

/**
 * Role badge component for displaying member roles
 * President: Gold/Amber with Crown icon
 * Vice President: Blue with Shield icon
 * Member: Gray with User icon
 */
export function RoleBadge({ role, size = 'md', showIcon = true, className }: RoleBadgeProps) {
  const config = roleConfig[role] || roleConfig.member;
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 font-medium',
        config.className,
        size === 'sm' && 'text-xs px-1.5 py-0',
        className
      )}
    >
      {showIcon && <Icon className={cn('flex-shrink-0', size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />}
      {config.label}
    </Badge>
  );
}

/**
 * Compact role indicator (just icon + short text)
 */
export function RoleIndicator({ role, className }: { role: MemberRole; className?: string }) {
  const config = roleConfig[role] || roleConfig.member;
  const Icon = config.icon;

  return (
    <span className={cn('inline-flex items-center gap-1 text-sm', className)}>
      <Icon className={cn('h-3.5 w-3.5', 
        role === 'president' && 'text-amber-600',
        role === 'vice_president' && 'text-blue-600',
        role === 'member' && 'text-gray-500'
      )} />
      <span className="text-muted-foreground">{config.label}</span>
    </span>
  );
}
