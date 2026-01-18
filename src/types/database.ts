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
