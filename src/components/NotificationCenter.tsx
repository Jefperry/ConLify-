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
import {
  AppNotification,
  getStoredNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  clearAllNotifications,
  getUnreadCount,
} from '@/lib/notifications';

interface NotificationCenterProps {
  onNotificationClick?: (notification: AppNotification) => void;
}

export default function NotificationCenter({ onNotificationClick }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  // Load notifications on mount and when popover opens
  useEffect(() => {
    loadNotifications();
  }, [open]);

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = () => {
    const stored = getStoredNotifications();
    setNotifications(stored);
    setUnreadCount(getUnreadCount());
  };

  const handleMarkAsRead = (notificationId: string) => {
    markNotificationAsRead(notificationId);
    loadNotifications();
  };

  const handleMarkAllAsRead = () => {
    markAllNotificationsAsRead();
    loadNotifications();
  };

  const handleClearAll = () => {
    clearAllNotifications();
    loadNotifications();
  };

  const handleNotificationClick = (notification: AppNotification) => {
    handleMarkAsRead(notification.id);
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
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-muted/50 cursor-pointer transition-colors ${
                    !notification.read ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
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

        {notifications.length > 0 && (
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
