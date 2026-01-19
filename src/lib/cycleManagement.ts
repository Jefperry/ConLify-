import { supabase } from '@/integrations/supabase/client';

interface CloseCycleResult {
  success: boolean;
  lockedMembers: string[];
  missedPayments: number;
  error?: string;
}

/**
 * Closes a payment cycle and handles missed payments
 * 1. Gets all payment logs for this cycle with status 'unpaid' or 'rejected'
 * 2. For each unpaid/rejected log, increments member's missed_payment_count
 * 3. Checks if missed_payment_count >= 3, sets status to 'locked'
 * 4. Updates cycle status to 'closed'
 */
export const closeCycle = async (cycleId: string, groupId: string): Promise<CloseCycleResult> => {
  try {
    // 1. Get all payment logs for this cycle that weren't verified
    const { data: unpaidLogs, error: logsError } = await supabase
      .from('payment_logs')
      .select('*, member:group_members!inner(*)')
      .eq('cycle_id', cycleId)
      .in('status', ['unpaid', 'rejected']);

    if (logsError) throw logsError;

    const lockedMembers: string[] = [];
    let missedPayments = 0;

    // 2. For each unpaid log, increment the member's missed_payment_count
    if (unpaidLogs && unpaidLogs.length > 0) {
      for (const log of unpaidLogs) {
        const member = log.member as { id: string; missed_payment_count: number; user_id: string };
        const newMissedCount = (member.missed_payment_count || 0) + 1;
        missedPayments++;

        // Determine if member should be locked (3 or more missed payments)
        const newStatus = newMissedCount >= 3 ? 'locked' : 'active';

        const { error: updateError } = await supabase
          .from('group_members')
          .update({ 
            missed_payment_count: newMissedCount,
            status: newStatus
          })
          .eq('id', member.id);

        if (updateError) {
          console.error('Error updating member:', updateError);
          continue;
        }

        if (newStatus === 'locked') {
          lockedMembers.push(member.id);
        }
      }
    }

    // 3. Update cycle status to 'closed'
    const { error: cycleError } = await supabase
      .from('payment_cycles')
      .update({ status: 'closed' })
      .eq('id', cycleId);

    if (cycleError) throw cycleError;

    return {
      success: true,
      lockedMembers,
      missedPayments,
    };
  } catch (error) {
    console.error('Error closing cycle:', error);
    return {
      success: false,
      lockedMembers: [],
      missedPayments: 0,
      error: error instanceof Error ? error.message : 'Failed to close cycle',
    };
  }
};

/**
 * Restores a locked member
 * 1. Gets max queue_position in group
 * 2. Updates member: status='active', queue_position=max+1, missed_payment_count=0
 */
export const restoreMember = async (memberId: string, groupId: string): Promise<{ success: boolean; newPosition?: number; error?: string }> => {
  try {
    // 1. Get max queue_position in the group
    const { data: members, error: membersError } = await supabase
      .from('group_members')
      .select('queue_position')
      .eq('group_id', groupId)
      .eq('status', 'active')
      .order('queue_position', { ascending: false })
      .limit(1);

    if (membersError) throw membersError;

    const maxPosition = members && members.length > 0 ? members[0].queue_position : 0;
    const newPosition = maxPosition + 1;

    // 2. Update the member
    const { error: updateError } = await supabase
      .from('group_members')
      .update({
        status: 'active',
        queue_position: newPosition,
        missed_payment_count: 0,
      })
      .eq('id', memberId);

    if (updateError) throw updateError;

    return {
      success: true,
      newPosition,
    };
  } catch (error) {
    console.error('Error restoring member:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to restore member',
    };
  }
};
