import { supabase } from '@/integrations/supabase/client';

// =====================================================
// ACTIVITY TYPES
// =====================================================

export type ActivityType =
  | 'payment_marked_sent'
  | 'payment_verified'
  | 'payment_rejected'
  | 'member_joined'
  | 'member_locked'
  | 'member_restored'
  | 'cycle_started'
  | 'cycle_closed'
  | 'reminder_sent'
  | 'member_reminded';

export interface ActivityLog {
  id: string;
  group_id: string;
  user_id: string | null;
  actor_name: string | null;
  action_type: ActivityType;
  target_user_id: string | null;
  target_name: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface ActivityLogInput {
  group_id: string;
  user_id?: string;
  actor_name?: string;
  action_type: ActivityType;
  target_user_id?: string;
  target_name?: string;
  metadata?: Record<string, any>;
}

// =====================================================
// ACTIVITY LOG FUNCTIONS
// =====================================================

/**
 * Log an activity to the group's activity feed
 */
export async function logActivity(input: ActivityLogInput): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('activity_logs').insert({
      group_id: input.group_id,
      user_id: input.user_id || null,
      actor_name: input.actor_name || null,
      action_type: input.action_type,
      target_user_id: input.target_user_id || null,
      target_name: input.target_name || null,
      metadata: input.metadata || {},
    });

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Error logging activity:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get recent activities for a group
 */
export async function getGroupActivities(
  groupId: string,
  limit: number = 20
): Promise<ActivityLog[]> {
  try {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data as ActivityLog[]) || [];
  } catch (error) {
    console.error('Error fetching activities:', error);
    return [];
  }
}

/**
 * Format activity for human-readable display
 */
export function formatActivityMessage(activity: ActivityLog): string {
  const actor = activity.actor_name || 'Someone';
  const target = activity.target_name || 'a member';
  const amount = activity.metadata?.amount;

  switch (activity.action_type) {
    case 'payment_marked_sent':
      return `${actor} marked payment as sent`;
    case 'payment_verified':
      return `${actor} verified payment from ${target}`;
    case 'payment_rejected':
      return `${actor} rejected payment from ${target}`;
    case 'member_joined':
      return `${actor} joined the group`;
    case 'member_locked':
      return `${target} was locked due to missed payments`;
    case 'member_restored':
      return `${actor} restored ${target} to the group`;
    case 'cycle_started':
      return `${actor} started a new payment cycle`;
    case 'cycle_closed':
      return `${actor} closed the payment cycle`;
    case 'reminder_sent':
      return `${actor} sent reminders to unpaid members`;
    case 'member_reminded':
      return `${actor} sent a reminder to ${target}`;
    default:
      return `${actor} performed an action`;
  }
}

// =====================================================
// REMINDER FUNCTIONS
// =====================================================

interface RemindResult {
  success: boolean;
  error?: string;
  alreadyRemindedRecently?: boolean;
}

/**
 * Send a reminder to a specific member
 * - Creates a notification for the member
 * - Increments reminder_count on payment_log
 * - Logs the activity
 * - Prevents spam (max 1 reminder per hour)
 */
export async function sendMemberReminder(
  groupId: string,
  paymentLogId: string,
  targetUserId: string,
  targetName: string,
  actorId: string,
  actorName: string,
  groupName: string,
  amount: number
): Promise<RemindResult> {
  try {
    // Check if already reminded recently (within 1 hour)
    const { data: paymentLog } = await supabase
      .from('payment_logs')
      .select('last_reminded_at, reminder_count')
      .eq('id', paymentLogId)
      .single();

    if (paymentLog?.last_reminded_at) {
      const lastReminded = new Date(paymentLog.last_reminded_at);
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (lastReminded > hourAgo) {
        return { success: false, alreadyRemindedRecently: true, error: 'Already reminded within the last hour' };
      }
    }

    // Update payment log with reminder tracking
    const { error: updateError } = await supabase
      .from('payment_logs')
      .update({
        reminder_count: (paymentLog?.reminder_count || 0) + 1,
        last_reminded_at: new Date().toISOString(),
      })
      .eq('id', paymentLogId);

    if (updateError) throw updateError;

    // Create notification for the target member
    const { error: notifError } = await supabase.from('notifications').insert({
      user_id: targetUserId,
      group_id: groupId,
      type: 'payment_reminder',
      title: 'Payment Reminder',
      message: `The president of ${groupName} is reminding you that your $${amount} contribution is due.`,
    });

    if (notifError) throw notifError;

    // Log the activity
    await logActivity({
      group_id: groupId,
      user_id: actorId,
      actor_name: actorName,
      action_type: 'member_reminded',
      target_user_id: targetUserId,
      target_name: targetName,
      metadata: { amount },
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error sending reminder:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send reminders to all unpaid members in a cycle
 */
export async function sendBulkReminders(
  groupId: string,
  cycleId: string,
  actorId: string,
  actorName: string,
  groupName: string,
  amount: number
): Promise<{ success: boolean; remindedCount: number; skippedCount: number; error?: string }> {
  try {
    // Get all unpaid/rejected payment logs for this cycle
    const { data: unpaidLogs, error: logsError } = await supabase
      .from('payment_logs')
      .select(`
        id,
        member_id,
        last_reminded_at,
        reminder_count,
        group_members!inner(user_id, profiles:user_id(name, email))
      `)
      .eq('cycle_id', cycleId)
      .in('status', ['unpaid', 'rejected']);

    if (logsError) throw logsError;

    let remindedCount = 0;
    let skippedCount = 0;
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

    for (const log of unpaidLogs || []) {
      // Skip if reminded recently
      if (log.last_reminded_at && new Date(log.last_reminded_at) > hourAgo) {
        skippedCount++;
        continue;
      }

      const member = log.group_members as any;
      const profile = member?.profiles;
      const targetUserId = member?.user_id;
      const targetName = profile?.name || profile?.email || 'Member';

      if (!targetUserId) continue;

      // Update payment log
      await supabase
        .from('payment_logs')
        .update({
          reminder_count: (log.reminder_count || 0) + 1,
          last_reminded_at: new Date().toISOString(),
        })
        .eq('id', log.id);

      // Create notification
      await supabase.from('notifications').insert({
        user_id: targetUserId,
        group_id: groupId,
        type: 'payment_reminder',
        title: 'Payment Reminder',
        message: `The president of ${groupName} is reminding you that your $${amount} contribution is due.`,
      });

      remindedCount++;
    }

    // Log bulk reminder activity
    if (remindedCount > 0) {
      await logActivity({
        group_id: groupId,
        user_id: actorId,
        actor_name: actorName,
        action_type: 'reminder_sent',
        metadata: { count: remindedCount, amount },
      });
    }

    return { success: true, remindedCount, skippedCount };
  } catch (error: any) {
    console.error('Error sending bulk reminders:', error);
    return { success: false, remindedCount: 0, skippedCount: 0, error: error.message };
  }
}

// =====================================================
// DATABASE NOTIFICATION FUNCTIONS
// =====================================================

export interface DbNotification {
  id: string;
  user_id: string;
  group_id: string | null;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

/**
 * Get notifications for the current user from database
 */
export async function getDbNotifications(limit: number = 50): Promise<DbNotification[]> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data as DbNotification[]) || [];
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
}

/**
 * Get unread notification count
 */
export async function getUnreadNotificationCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('read', false);

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
}

/**
 * Mark a notification as read
 */
export async function markDbNotificationRead(notificationId: string): Promise<void> {
  try {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);
  } catch (error) {
    console.error('Error marking notification read:', error);
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllDbNotificationsRead(): Promise<void> {
  try {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('read', false);
  } catch (error) {
    console.error('Error marking all notifications read:', error);
  }
}

/**
 * Clear all notifications
 */
export async function clearAllDbNotifications(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('notifications')
      .delete()
      .eq('user_id', user.id);
  } catch (error) {
    console.error('Error clearing notifications:', error);
  }
}

/**
 * Create a notification in the database
 */
export async function createDbNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  groupId?: string
): Promise<void> {
  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      group_id: groupId || null,
      type,
      title,
      message,
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}
