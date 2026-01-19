/**
 * Browser Notification Helpers
 * Handles permission requests and showing native browser notifications
 */

const NOTIFICATION_PERMISSION_KEY = 'conlify_notification_permission';

/**
 * Check if browser notifications are supported
 */
export const isNotificationSupported = (): boolean => {
  return 'Notification' in window;
};

/**
 * Get current notification permission status
 */
export const getNotificationPermission = (): NotificationPermission | 'unsupported' => {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
};

/**
 * Request notification permission from the user
 * Returns true if granted, false otherwise
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!isNotificationSupported()) {
    console.warn('Browser notifications are not supported');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    localStorage.setItem(NOTIFICATION_PERMISSION_KEY, permission);
    return permission === 'granted';
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
};

/**
 * Show a browser notification
 */
export const showNotification = (
  title: string, 
  options?: {
    body?: string;
    icon?: string;
    tag?: string;
    onClick?: () => void;
  }
): Notification | null => {
  if (!isNotificationSupported()) {
    console.warn('Browser notifications are not supported');
    return null;
  }

  if (Notification.permission !== 'granted') {
    console.warn('Notification permission not granted');
    return null;
  }

  try {
    const notification = new Notification(title, {
      body: options?.body,
      icon: options?.icon || '/favicon.ico',
      tag: options?.tag,
    });

    if (options?.onClick) {
      notification.onclick = () => {
        window.focus();
        options.onClick?.();
        notification.close();
      };
    }

    return notification;
  } catch (error) {
    console.error('Error showing notification:', error);
    return null;
  }
};

/**
 * In-App Notification Types and Storage
 */
export interface AppNotification {
  id: string;
  type: 'payment_pending' | 'payment_verified' | 'payment_rejected' | 'cycle_started' | 'cycle_closed' | 'member_joined' | 'member_locked';
  title: string;
  message: string;
  groupId?: string;
  groupName?: string;
  createdAt: string;
  read: boolean;
}

const NOTIFICATIONS_STORAGE_KEY = 'conlify_notifications';
const MAX_NOTIFICATIONS = 50;

/**
 * Get all stored notifications
 */
export const getStoredNotifications = (): AppNotification[] => {
  try {
    const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

/**
 * Add a new notification
 */
export const addNotification = (notification: Omit<AppNotification, 'id' | 'createdAt' | 'read'>): AppNotification => {
  const newNotification: AppNotification = {
    ...notification,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    read: false,
  };

  const notifications = getStoredNotifications();
  notifications.unshift(newNotification);

  // Keep only the most recent notifications
  const trimmed = notifications.slice(0, MAX_NOTIFICATIONS);
  localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(trimmed));

  return newNotification;
};

/**
 * Mark a notification as read
 */
export const markNotificationAsRead = (notificationId: string): void => {
  const notifications = getStoredNotifications();
  const updated = notifications.map(n => 
    n.id === notificationId ? { ...n, read: true } : n
  );
  localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
};

/**
 * Mark all notifications as read
 */
export const markAllNotificationsAsRead = (): void => {
  const notifications = getStoredNotifications();
  const updated = notifications.map(n => ({ ...n, read: true }));
  localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
};

/**
 * Get unread notification count
 */
export const getUnreadCount = (): number => {
  return getStoredNotifications().filter(n => !n.read).length;
};

/**
 * Clear all notifications
 */
export const clearAllNotifications = (): void => {
  localStorage.removeItem(NOTIFICATIONS_STORAGE_KEY);
};

/**
 * Create notification based on event type
 */
export const createPaymentNotification = (
  type: 'pending' | 'verified' | 'rejected',
  memberName: string,
  groupName: string,
  groupId: string,
  amount: number
): AppNotification => {
  const configs = {
    pending: {
      type: 'payment_pending' as const,
      title: 'Payment Marked as Sent',
      message: `${memberName} marked their $${amount} payment as sent in ${groupName}`,
    },
    verified: {
      type: 'payment_verified' as const,
      title: 'Payment Verified',
      message: `Your $${amount} payment was verified in ${groupName}`,
    },
    rejected: {
      type: 'payment_rejected' as const,
      title: 'Payment Rejected',
      message: `Your $${amount} payment was rejected in ${groupName}. Please re-submit.`,
    },
  };

  const config = configs[type];
  return addNotification({
    ...config,
    groupId,
    groupName,
  });
};
