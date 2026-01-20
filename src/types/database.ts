export type MemberStatus = 'active' | 'locked' | 'pending';
export type PaymentStatus = 'unpaid' | 'pending' | 'verified' | 'rejected';
export type GroupFrequency = 'weekly' | 'monthly';
export type CycleStatus = 'active' | 'closed';
export type MemberRole = 'president' | 'vice_president' | 'member';

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: string;
  name: string;
  president_id: string;
  frequency: GroupFrequency;
  contribution_amount: number;
  president_email: string;
  invite_code: string;
  photo_url: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  queue_position: number;
  status: MemberStatus;
  role: MemberRole;
  missed_payment_count: number;
  created_at: string;
  updated_at: string;
}

export interface PaymentCycle {
  id: string;
  group_id: string;
  start_date: string;
  due_date: string;
  status: CycleStatus;
  created_at: string;
}

export interface PaymentLog {
  id: string;
  cycle_id: string;
  member_id: string;
  status: PaymentStatus;
  marked_at: string | null;
  verified_at: string | null;
  reminder_count: number;
  last_reminded_at: string | null;
  created_at: string;
}

// Activity types for group feed
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

// Notification types (database-stored)
export type NotificationType =
  | 'payment_reminder'
  | 'payment_verified'
  | 'payment_rejected'
  | 'cycle_started'
  | 'cycle_closed'
  | 'member_joined'
  | 'member_locked';

export interface DbNotification {
  id: string;
  user_id: string;
  group_id: string | null;
  type: NotificationType;
  title: string;
  message: string;
  read_at: string | null;
  created_at: string;
}

// Extended types with joins
export interface GroupMemberWithProfile extends GroupMember {
  profile?: Profile;
}

export interface GroupWithMembers extends Group {
  members?: GroupMemberWithProfile[];
}

export interface PaymentLogWithMember extends PaymentLog {
  member?: GroupMemberWithProfile;
}
