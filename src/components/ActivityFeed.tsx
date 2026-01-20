import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { 
  DollarSign, 
  Users, 
  Calendar, 
  Bell, 
  Lock, 
  RotateCcw,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { getGroupActivities, formatActivityMessage, type ActivityLog, type ActivityType } from '@/lib/activity';

interface ActivityFeedProps {
  groupId: string;
  limit?: number;
  showHeader?: boolean;
  maxHeight?: string;
  className?: string;
}

const activityIcons: Record<ActivityType, typeof DollarSign> = {
  payment_marked_sent: DollarSign,
  payment_verified: CheckCircle,
  payment_rejected: XCircle,
  member_joined: Users,
  member_locked: Lock,
  member_restored: RotateCcw,
  cycle_started: Calendar,
  cycle_closed: Calendar,
  reminder_sent: Bell,
  member_reminded: Bell,
};

const activityColors: Record<ActivityType, string> = {
  payment_marked_sent: 'bg-blue-500/10 text-blue-600',
  payment_verified: 'bg-green-500/10 text-green-600',
  payment_rejected: 'bg-red-500/10 text-red-600',
  member_joined: 'bg-primary/10 text-primary',
  member_locked: 'bg-red-500/10 text-red-600',
  member_restored: 'bg-green-500/10 text-green-600',
  cycle_started: 'bg-blue-500/10 text-blue-600',
  cycle_closed: 'bg-gray-500/10 text-gray-600',
  reminder_sent: 'bg-amber-500/10 text-amber-600',
  member_reminded: 'bg-amber-500/10 text-amber-600',
};

/**
 * Activity Feed component for displaying group activity
 * Shows a human-readable log of recent actions
 */
export function ActivityFeed({ 
  groupId, 
  limit = 10, 
  showHeader = true, 
  maxHeight = '300px',
  className 
}: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
      setLoading(true);
      const data = await getGroupActivities(groupId, limit);
      setActivities(data);
      setLoading(false);
    };

    fetchActivities();
  }, [groupId, limit]);

  if (loading) {
    return (
      <Card className={cn('card-elevated', className)}>
        {showHeader && (
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Group Activity
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('card-elevated', className)}>
      {showHeader && (
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Group Activity
          </CardTitle>
        </CardHeader>
      )}
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No activity yet</p>
            <p className="text-xs mt-1">Actions will appear here as they happen</p>
          </div>
        ) : (
          <ScrollArea style={{ maxHeight }}>
            <div className="space-y-3">
              {activities.map((activity) => {
                const Icon = activityIcons[activity.action_type] || Clock;
                const colorClass = activityColors[activity.action_type] || 'bg-muted text-muted-foreground';
                const message = formatActivityMessage(activity);

                return (
                  <div key={activity.id} className="flex items-start gap-3 group">
                    <div className={cn('p-2 rounded-full flex-shrink-0', colorClass)}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground leading-snug">{message}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Inline activity list (no card wrapper)
 */
export function ActivityList({ 
  groupId, 
  limit = 5,
  className 
}: { groupId: string; limit?: number; className?: string }) {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
      setLoading(true);
      const data = await getGroupActivities(groupId, limit);
      setActivities(data);
      setLoading(false);
    };

    fetchActivities();
  }, [groupId, limit]);

  if (loading) {
    return (
      <div className={cn('space-y-2', className)}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        No activity yet. Actions will appear here as they happen.
      </p>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {activities.map((activity) => {
        const Icon = activityIcons[activity.action_type] || Clock;
        const colorClass = activityColors[activity.action_type] || 'text-muted-foreground';
        const message = formatActivityMessage(activity);

        return (
          <div key={activity.id} className="flex items-center gap-2 text-sm">
            <Icon className={cn('h-4 w-4 flex-shrink-0', colorClass.split(' ')[1])} />
            <span className="text-muted-foreground truncate">{message}</span>
            <span className="text-xs text-muted-foreground/70 flex-shrink-0">
              {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
            </span>
          </div>
        );
      })}
    </div>
  );
}
