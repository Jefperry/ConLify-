import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, CheckCheck, Trash2, DollarSign, Users, Calendar, Lock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  AppNotification,
  getStoredNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  clearAllNotifications,
  getUnreadCount,
} from '@/lib/notifications';
import { DbNotification, NotificationType } from '@/types/database';

interface NotificationCenterProps {
  onNotificationClick?: (notification: AppNotification) => void;
}

export default function NotificationCenter({ onNotificationClick }: NotificationCenterProps) {
  const { user } = useAuth();
  const [localNotifications, setLocalNotifications] = useState<AppNotification[]>([]);
  const [dbNotifications, setDbNotifications] = useState<DbNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  // Combine and sort notifications from both sources
  const allNotifications = [...localNotifications, ...dbNotifications.map(dbToAppNotification)]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20);

  // Convert DB notification to AppNotification format
  function dbToAppNotification(db: DbNotification): AppNotification {
    return {
      id: db.id,
      type: mapDbTypeToAppType(db.type as NotificationType),
      title: db.title,
      message: db.message,
      groupId: db.group_id || undefined,
      createdAt: db.created_at,
      read: !!db.read_at,
      isFromDb: true, // Custom flag to track source
    } as AppNotification & { isFromDb: boolean };
  }

  function mapDbTypeToAppType(type: NotificationType): AppNotification['type'] {
    switch (type) {
      case 'payment_reminder':
        return 'payment_pending';
      case 'payment_verified':
        return 'payment_verified';
      case 'payment_rejected':
        return 'payment_rejected';
      case 'cycle_started':
        return 'cycle_started';
      case 'cycle_closed':
        return 'cycle_closed';
      case 'member_joined':
        return 'member_joined';
      case 'member_locked':
        return 'member_locked';
      default:
        return 'payment_pending';
    }
  }

  // Load local notifications on mount and when popover opens
  useEffect(() => {
    loadLocalNotifications();
  }, [open]);

  // Fetch database notifications
  useEffect(() => {
    if (user) {
      fetchDbNotifications();
    }
  }, [user, open]);

  // Set up real-time subscription for new notifications
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('notification-center-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = payload.new as DbNotification;
          setDbNotifications(prev => [newNotification, ...prev.slice(0, 19)]);
          updateUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadLocalNotifications();
      if (user) fetchDbNotifications();
    }, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const loadLocalNotifications = () => {
    const stored = getStoredNotifications();
    setLocalNotifications(stored);
    updateUnreadCount();
  };

  const fetchDbNotifications = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setDbNotifications((data as DbNotification[]) || []);
      updateUnreadCount();
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const updateUnreadCount = () => {
    const localUnread = getUnreadCount();
    const dbUnread = dbNotifications.filter(n => !n.read_at).length;
    setUnreadCount(localUnread + dbUnread);
  };

  const handleMarkAsRead = async (notificationId: string, isFromDb?: boolean) => {
    if (isFromDb) {
      try {
        await supabase
          .from('notifications')
          .update({ read_at: new Date().toISOString() })
          .eq('id', notificationId);
        
        setDbNotifications(prev => 
          prev.map(n => n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n)
        );
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    } else {
      markNotificationAsRead(notificationId);
      loadLocalNotifications();
    }
    updateUnreadCount();
  };

  const handleMarkAllAsRead = async () => {
    // Mark local notifications
    markAllNotificationsAsRead();
    loadLocalNotifications();
    
    // Mark database notifications
    if (user) {
      try {
        await supabase
          .from('notifications')
          .update({ read_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .is('read_at', null);
        
        setDbNotifications(prev => 
          prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
        );
      } catch (error) {
        console.error('Error marking all as read:', error);
      }
    }
    
    updateUnreadCount();
  };

  const handleClearAll = async () => {
    clearAllNotifications();
    setLocalNotifications([]);
    
    // Clear database notifications
    if (user) {
      try {
        await supabase
          .from('notifications')
          .delete()
          .eq('user_id', user.id);
        
        setDbNotifications([]);
      } catch (error) {
        console.error('Error clearing notifications:', error);
      }
    }
    
    setUnreadCount(0);
  };

  const handleNotificationClick = (notification: AppNotification & { isFromDb?: boolean }) => {
    handleMarkAsRead(notification.id, notification.isFromDb);
    onNotificationClick?.(notification);
    setOpen(false);
  };

  const getNotificationIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'payment_pending':
      case 'payment_verified':
      case 'payment_rejected':
        return <DollarSign className="h-4 w-4" />;
      case 'cycle_started':
      case 'cycle_closed':
        return <Calendar className="h-4 w-4" />;
      case 'member_joined':
        return <Users className="h-4 w-4" />;
      case 'member_locked':
        return <Lock className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getNotificationColor = (type: AppNotification['type']) => {
    switch (type) {
      case 'payment_pending':
        return 'bg-yellow-500/10 text-yellow-600';
      case 'payment_verified':
        return 'bg-green-500/10 text-green-600';
      case 'payment_rejected':
        return 'bg-red-500/10 text-red-600';
      case 'cycle_started':
        return 'bg-blue-500/10 text-blue-600';
      case 'cycle_closed':
        return 'bg-gray-500/10 text-gray-600';
      case 'member_joined':
        return 'bg-primary/10 text-primary';
      case 'member_locked':
        return 'bg-red-500/10 text-red-600';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold">Notifications</h4>
          <div className="flex gap-1">
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleMarkAllAsRead}
                className="h-8 text-xs"
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="h-[300px]">
          {allNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
              <p className="text-xs mt-1">Payment reminders will appear here</p>
            </div>
          ) : (
            <div className="divide-y">
              {allNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-muted/50 cursor-pointer transition-colors ${
                    !notification.read ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification as AppNotification & { isFromDb?: boolean })}
                >
                  <div className="flex gap-3">
                    <div className={`p-2 rounded-full ${getNotificationColor(notification.type)}`}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium ${!notification.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {allNotifications.length > 0 && (
          <>
            <Separator />
            <div className="p-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleClearAll}
                className="w-full text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3 mr-2" />
                Clear all notifications
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
