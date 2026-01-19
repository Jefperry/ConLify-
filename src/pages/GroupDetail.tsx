import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Users, Copy, Check, Calendar, DollarSign, 
  Crown, AlertCircle, CheckCircle, Clock, XCircle, Loader2,
  UserPlus, Settings, Shield, User, Play, Timer, Filter, StopCircle, RotateCcw, Lock,
  ChevronUp, ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { format, differenceInDays, differenceInHours, addDays, addWeeks, addMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { closeCycle, restoreMember } from '@/lib/cycleManagement';
import { addNotification, showNotification, requestNotificationPermission } from '@/lib/notifications';
import { Group, GroupMember, Profile, PaymentCycle, PaymentLog, MemberStatus, PaymentStatus, MemberRole } from '@/types/database';

interface MemberWithProfile extends GroupMember {
  profile: Profile;
}

interface PaymentLogWithMember extends PaymentLog {
  member: MemberWithProfile;
}

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [activeCycle, setActiveCycle] = useState<PaymentCycle | null>(null);
  const [paymentLogs, setPaymentLogs] = useState<PaymentLogWithMember[]>([]);
  const [copied, setCopied] = useState(false);
  const [cycleDialogOpen, setCycleDialogOpen] = useState(false);
  const [selectedStartDate, setSelectedStartDate] = useState<Date | undefined>(undefined);
  const [selectedDueDate, setSelectedDueDate] = useState<Date | undefined>(undefined);
  const [startingCycle, setStartingCycle] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState<'all' | PaymentStatus>('all');
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [closingCycle, setClosingCycle] = useState(false);
  const [restoringMemberId, setRestoringMemberId] = useState<string | null>(null);
  const [movingMemberId, setMovingMemberId] = useState<string | null>(null);

  const isPresident = group?.president_id === user?.id;

  // Filter payment logs based on selected filter
  const filteredPaymentLogs = useMemo(() => {
    if (paymentFilter === 'all') return paymentLogs;
    return paymentLogs.filter(log => log.status === paymentFilter);
  }, [paymentLogs, paymentFilter]);

  // Calculate default due date based on group frequency
  const getDefaultDueDate = () => {
    const today = new Date();
    if (group?.frequency === 'weekly') {
      return addWeeks(today, 1);
    } else {
      return addMonths(today, 1);
    }
  };

  // Calculate cycle countdown
  const cycleCountdown = useMemo(() => {
    if (!activeCycle) return null;
    const startDate = new Date(activeCycle.start_date);
    const dueDate = new Date(activeCycle.due_date);
    const now = new Date();
    
    // Check if cycle hasn't started yet
    const daysUntilStart = differenceInDays(startDate, now);
    const hoursUntilStart = differenceInHours(startDate, now) % 24;
    
    if (daysUntilStart > 0 || (daysUntilStart === 0 && hoursUntilStart > 0)) {
      return { 
        text: daysUntilStart === 0 ? `Starts in ${hoursUntilStart}h` : `Starts in ${daysUntilStart}d ${hoursUntilStart}h`,
        isOverdue: false,
        isPending: true,
        daysLeft: daysUntilStart
      };
    }
    
    // Cycle has started, calculate time until due
    const daysLeft = differenceInDays(dueDate, now);
    const hoursLeft = differenceInHours(dueDate, now) % 24;
    
    if (daysLeft < 0) {
      return { text: 'Overdue', isOverdue: true, isPending: false, daysLeft: Math.abs(daysLeft) };
    }
    return { 
      text: daysLeft === 0 ? `${hoursLeft}h left` : `${daysLeft}d ${hoursLeft}h left`,
      isOverdue: false,
      isPending: false,
      daysLeft 
    };
  }, [activeCycle]);

  // Calculate payment progress
  const paymentProgress = useMemo(() => {
    if (!paymentLogs.length) return { verified: 0, pending: 0, unpaid: 0, total: 0, percentage: 0 };
    const verified = paymentLogs.filter(l => l.status === 'verified').length;
    const pending = paymentLogs.filter(l => l.status === 'pending').length;
    const unpaid = paymentLogs.filter(l => l.status === 'unpaid').length;
    const total = paymentLogs.length;
    const percentage = Math.round((verified / total) * 100);
    return { verified, pending, unpaid, total, percentage };
  }, [paymentLogs]);

  useEffect(() => {
    if (id) {
      fetchGroupData();
    }
  }, [id]);

  // Real-time subscription for payment updates (president only)
  useEffect(() => {
    if (!activeCycle || !isPresident) return;

    // Request notification permission when president visits group page
    requestNotificationPermission();

    const subscription = supabase
      .channel(`payment_logs_${activeCycle.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'payment_logs',
          filter: `cycle_id=eq.${activeCycle.id}`,
        },
        async (payload) => {
          const newLog = payload.new as PaymentLog;
          
          // Only notify when payment changes to 'pending'
          if (newLog.status === 'pending') {
            // Find member info for this payment
            const member = members.find(m => m.id === newLog.member_id);
            const memberName = member?.profile?.name || 'A member';
            
            // Add in-app notification
            addNotification({
              type: 'payment_pending',
              title: 'Payment Submitted',
              message: `${memberName} has marked their payment as sent and is awaiting verification.`,
              groupId: id,
            });

            // Show browser notification
            showNotification('Payment Submitted', {
              body: `${memberName} has marked their payment as sent.`,
              tag: `payment-${newLog.id}`,
            });

            // Refresh payment logs
            fetchGroupData();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [activeCycle?.id, isPresident, members]);

  const fetchGroupData = async () => {
    try {
      // Fetch group
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', id)
        .single();

      if (groupError) throw groupError;
      setGroup(groupData);

      // Fetch members
      const { data: membersData, error: membersError } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', id)
        .order('queue_position');

      if (membersError) throw membersError;

      // Fetch profiles for all members
      if (membersData && membersData.length > 0) {
        const userIds = membersData.map(m => m.user_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds);

        // Combine members with their profiles
        const membersWithProfiles = membersData.map(member => ({
          ...member,
          profile: profilesData?.find(p => p.id === member.user_id) || null
        }));
        
        setMembers(membersWithProfiles as MemberWithProfile[]);
      } else {
        setMembers([]);
      }

      // Fetch active cycle
      const { data: cycleData } = await supabase
        .from('payment_cycles')
        .select('*')
        .eq('group_id', id)
        .eq('status', 'active')
        .maybeSingle();

      setActiveCycle(cycleData);

      // Fetch payment logs for active cycle
      if (cycleData) {
        const { data: logsData } = await supabase
          .from('payment_logs')
          .select('*')
          .eq('cycle_id', cycleData.id);

        // Fetch member data for each log
        if (logsData && logsData.length > 0) {
          const memberIds = logsData.map(log => log.member_id);
          const { data: logMembersData } = await supabase
            .from('group_members')
            .select('*')
            .in('id', memberIds);

          const logUserIds = logMembersData?.map(m => m.user_id) || [];
          const { data: logProfilesData } = await supabase
            .from('profiles')
            .select('*')
            .in('id', logUserIds);

          const logsWithMembers = logsData.map(log => {
            const member = logMembersData?.find(m => m.id === log.member_id);
            const profile = member ? logProfilesData?.find(p => p.id === member.user_id) : null;
            return {
              ...log,
              member: member ? { ...member, profile } : null
            };
          });

          setPaymentLogs(logsWithMembers as PaymentLogWithMember[]);
        } else {
          setPaymentLogs([]);
        }
      } else {
        setPaymentLogs([]);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load group data",
        variant: "destructive",
      });
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const copyInviteCode = async () => {
    if (group?.invite_code) {
      await navigator.clipboard.writeText(group.invite_code);
      setCopied(true);
      toast({ title: "Invite code copied!" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getStatusBadge = (status: MemberStatus) => {
    const variants = {
      active: { variant: 'default' as const, icon: CheckCircle, label: 'Active' },
      pending: { variant: 'secondary' as const, icon: Clock, label: 'Pending' },
      locked: { variant: 'destructive' as const, icon: AlertCircle, label: 'Locked' },
    };
    const { variant, icon: Icon, label } = variants[status];
    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  const getPaymentStatusBadge = (status: PaymentStatus) => {
    const variants = {
      unpaid: { className: 'bg-muted text-muted-foreground', icon: Clock, label: 'Unpaid' },
      pending: { className: 'bg-warning/10 text-warning border-warning/20', icon: Clock, label: 'Pending' },
      verified: { className: 'bg-primary/10 text-primary border-primary/20', icon: CheckCircle, label: 'Verified' },
      rejected: { className: 'bg-destructive/10 text-destructive border-destructive/20', icon: XCircle, label: 'Rejected' },
    };
    const { className, icon: Icon, label } = variants[status];
    return (
      <Badge variant="outline" className={`gap-1 ${className}`}>
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  const getRoleBadge = (role: MemberRole) => {
    const variants = {
      president: { className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', icon: Crown, label: 'President' },
      vice_president: { className: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: Shield, label: 'Vice President' },
      member: { className: 'bg-gray-500/10 text-gray-600 border-gray-500/20', icon: User, label: 'Member' },
    };
    const { className, icon: Icon, label } = variants[role] || variants.member;
    return (
      <Badge variant="outline" className={`gap-1 ${className}`}>
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  const verifyPayment = async (logId: string, memberId: string) => {
    setVerifyingId(logId);
    try {
      // Update payment log status
      const { error: logError } = await supabase
        .from('payment_logs')
        .update({ status: 'verified', verified_at: new Date().toISOString() })
        .eq('id', logId);

      if (logError) throw logError;

      // Reset missed_payment_count to 0 for this member
      const { error: memberError } = await supabase
        .from('group_members')
        .update({ missed_payment_count: 0 })
        .eq('id', memberId);

      if (memberError) throw memberError;
      
      toast({ 
        title: "Payment verified!",
        description: "Member's missed payment count has been reset."
      });
      fetchGroupData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to verify payment";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setVerifyingId(null);
    }
  };

  const rejectPayment = async (logId: string) => {
    setRejectingId(logId);
    try {
      const { error } = await supabase
        .from('payment_logs')
        .update({ status: 'rejected' })
        .eq('id', logId);

      if (error) throw error;
      
      toast({ 
        title: "Payment rejected",
        description: "The member will need to re-submit their payment."
      });
      fetchGroupData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to reject payment";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setRejectingId(null);
    }
  };

  const startNewCycle = async () => {
    if (!group || !selectedStartDate || !selectedDueDate) {
      toast({
        title: "Error",
        description: "Please select both start and end dates",
        variant: "destructive",
      });
      return;
    }

    if (selectedStartDate >= selectedDueDate) {
      toast({
        title: "Error",
        description: "Start date must be before end date",
        variant: "destructive",
      });
      return;
    }

    setStartingCycle(true);
    try {
      // 1. Create the new payment cycle
      const { data: cycleData, error: cycleError } = await supabase
        .from('payment_cycles')
        .insert({
          group_id: group.id,
          start_date: selectedStartDate.toISOString(),
          due_date: selectedDueDate.toISOString(),
          status: 'active'
        })
        .select()
        .single();

      if (cycleError) throw cycleError;

      // 2. Get all active members
      const activeMembers = members.filter(m => m.status === 'active');
      
      if (activeMembers.length === 0) {
        toast({
          title: "Warning",
          description: "No active members to create payment logs for",
          variant: "destructive",
        });
        return;
      }

      // 3. Create payment logs for all active members with status 'unpaid'
      const paymentLogsToCreate = activeMembers.map(member => ({
        cycle_id: cycleData.id,
        member_id: member.id,
        status: 'unpaid' as PaymentStatus
      }));

      const { error: logsError } = await supabase
        .from('payment_logs')
        .insert(paymentLogsToCreate);

      if (logsError) throw logsError;

      toast({ 
        title: "Cycle Started!",
        description: `Payment cycle created with ${activeMembers.length} members. ${format(selectedStartDate, 'MMM d')} → ${format(selectedDueDate, 'MMM d')}`
      });
      
      setCycleDialogOpen(false);
      setSelectedStartDate(undefined);
      setSelectedDueDate(undefined);
      fetchGroupData();
    } catch (error: any) {
      console.error('Error starting cycle:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to start cycle",
        variant: "destructive",
      });
    } finally {
      setStartingCycle(false);
    }
  };

  // Set default dates when dialog opens
  const handleOpenCycleDialog = () => {
    setSelectedStartDate(new Date()); // Start date defaults to today
    setSelectedDueDate(getDefaultDueDate()); // End date based on frequency
    setCycleDialogOpen(true);
  };

  // Close the current cycle and handle missed payments
  const handleCloseCycle = async () => {
    if (!activeCycle || !group) return;

    setClosingCycle(true);
    try {
      const result = await closeCycle(activeCycle.id, group.id);

      if (!result.success) {
        throw new Error(result.error);
      }

      const messages = [];
      if (result.missedPayments > 0) {
        messages.push(`${result.missedPayments} missed payment(s) recorded`);
      }
      if (result.lockedMembers.length > 0) {
        messages.push(`${result.lockedMembers.length} member(s) locked due to 3+ missed payments`);
      }

      toast({
        title: "Cycle Closed",
        description: messages.length > 0 ? messages.join('. ') : "All payments were verified!",
      });

      fetchGroupData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to close cycle";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setClosingCycle(false);
    }
  };

  // Restore a locked member
  const handleRestoreMember = async (memberId: string) => {
    if (!group) return;

    setRestoringMemberId(memberId);
    try {
      const result = await restoreMember(memberId, group.id);

      if (!result.success) {
        throw new Error(result.error);
      }

      toast({
        title: "Member Restored",
        description: `Member has been restored and moved to position #${result.newPosition} in the queue.`,
      });

      fetchGroupData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to restore member";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setRestoringMemberId(null);
    }
  };

  // Move member up or down in the queue
  const handleMoveQueuePosition = async (memberId: string, direction: 'up' | 'down') => {
    const activeMembers = members.filter(m => m.status === 'active').sort((a, b) => a.queue_position - b.queue_position);
    const memberIndex = activeMembers.findIndex(m => m.id === memberId);
    
    if (memberIndex === -1) return;
    if (direction === 'up' && memberIndex === 0) return;
    if (direction === 'down' && memberIndex === activeMembers.length - 1) return;

    const targetIndex = direction === 'up' ? memberIndex - 1 : memberIndex + 1;
    const currentMember = activeMembers[memberIndex];
    const swapMember = activeMembers[targetIndex];

    setMovingMemberId(memberId);
    try {
      const tempPosition = -1; // Temporary position to avoid unique constraint
      const currentPos = currentMember.queue_position;
      const swapPos = swapMember.queue_position;

      // Step 1: Move current member to temporary position
      const { error: error1 } = await supabase
        .from('group_members')
        .update({ queue_position: tempPosition })
        .eq('id', currentMember.id);

      if (error1) throw error1;

      // Step 2: Move swap member to current member's original position
      const { error: error2 } = await supabase
        .from('group_members')
        .update({ queue_position: currentPos })
        .eq('id', swapMember.id);

      if (error2) throw error2;

      // Step 3: Move current member to swap member's original position
      const { error: error3 } = await supabase
        .from('group_members')
        .update({ queue_position: swapPos })
        .eq('id', currentMember.id);

      if (error3) throw error3;

      toast({
        title: "Queue Updated",
        description: `${currentMember.profile?.name || 'Member'} moved ${direction} to position #${swapPos}`,
      });

      fetchGroupData();
    } catch (error: any) {
      console.error('Queue position error:', error);
      const errorMessage = error?.message || error?.details || "Failed to update queue position";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setMovingMemberId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4 flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-6 w-48" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <div className="grid gap-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </main>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Group not found</h2>
          <Button asChild>
            <Link to="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/dashboard">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                {group.name}
                {isPresident && <Crown className="h-4 w-4 text-warning" />}
              </h1>
              <p className="text-sm text-muted-foreground">
                {group.frequency === 'weekly' ? 'Weekly' : 'Monthly'} • ${group.contribution_amount} contribution
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate(`/groups/${id}/settings`)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6">
          {/* Invite Code Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-primary" />
                Invite Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-muted rounded-lg px-4 py-3 font-mono text-lg tracking-wider">
                  {group.invite_code}
                </div>
                <Button variant="outline" size="icon" onClick={copyInviteCode}>
                  {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Share this code with people you want to invite to the group
              </p>
            </CardContent>
          </Card>

          {/* Stats Cards */}
          <div className="grid sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{members.length}</p>
                    <p className="text-sm text-muted-foreground">Members</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">${(members.filter(m => m.status === 'active').length * group.contribution_amount).toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">Expected Per Cycle</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className={cn(
              activeCycle && cycleCountdown?.isOverdue && 'border-destructive',
              activeCycle && cycleCountdown?.isPending && 'border-blue-500'
            )}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-lg",
                    activeCycle 
                      ? cycleCountdown?.isOverdue 
                        ? "bg-destructive/10" 
                        : cycleCountdown?.isPending
                          ? "bg-blue-500/10"
                          : "bg-primary/10"
                      : "bg-muted"
                  )}>
                    <Timer className={cn(
                      "h-5 w-5",
                      activeCycle 
                        ? cycleCountdown?.isOverdue 
                          ? "text-destructive" 
                          : cycleCountdown?.isPending
                            ? "text-blue-500"
                            : "text-primary"
                        : "text-muted-foreground"
                    )} />
                  </div>
                  <div>
                    {activeCycle ? (
                      <>
                        <p className={cn(
                          "text-2xl font-bold",
                          cycleCountdown?.isOverdue && "text-destructive",
                          cycleCountdown?.isPending && "text-blue-500"
                        )}>
                          {cycleCountdown?.text}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(activeCycle.start_date), 'MMM d')} → {format(new Date(activeCycle.due_date), 'MMM d')}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-2xl font-bold text-muted-foreground">No Cycle</p>
                        <p className="text-sm text-muted-foreground">Start a new cycle</p>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Next Payout Recipient Card */}
          {members.filter(m => m.status === 'active').length > 0 && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-primary/10">
                      <Crown className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Next Payout Recipient</p>
                      <p className="text-xl font-bold">
                        {(() => {
                          const activeMembers = members.filter(m => m.status === 'active');
                          const nextRecipient = activeMembers.sort((a, b) => a.queue_position - b.queue_position)[0];
                          return nextRecipient?.profile?.name || 'Unknown';
                        })()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Queue Position #1 • Receives ${(members.filter(m => m.status === 'active').length * group.contribution_amount).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      {group.frequency === 'weekly' ? 'Every Week' : 'Every Month'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment Progress Bar - Only show when cycle is active */}
          {activeCycle && paymentLogs.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      <span className="font-medium">Payment Progress</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {paymentProgress.verified} of {paymentProgress.total} verified
                    </span>
                  </div>
                  <Progress value={paymentProgress.percentage} className="h-2" />
                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span className="text-muted-foreground">{paymentProgress.verified} Verified</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-yellow-500" />
                      <span className="text-muted-foreground">{paymentProgress.pending} Pending</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                      <span className="text-muted-foreground">{paymentProgress.unpaid} Unpaid</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* View Invoice Card - Show for all members (including president) when cycle is active */}
          {activeCycle && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Your Payment Due</p>
                    <p className="text-sm text-muted-foreground">
                      ${group.contribution_amount} by {format(new Date(activeCycle.due_date), 'MMM d, yyyy')}
                    </p>
                    {/* Show current payment status for president */}
                    {isPresident && (() => {
                      const currentMember = members.find(m => m.user_id === user?.id);
                      const myPaymentLog = paymentLogs.find(pl => pl.member_id === currentMember?.id);
                      if (myPaymentLog) {
                        const statusColors: Record<string, string> = {
                          unpaid: 'text-muted-foreground',
                          pending: 'text-yellow-600',
                          verified: 'text-green-600',
                          rejected: 'text-red-600'
                        };
                        return (
                          <p className={`text-sm font-medium ${statusColors[myPaymentLog.status]}`}>
                            Status: {myPaymentLog.status.charAt(0).toUpperCase() + myPaymentLog.status.slice(1)}
                          </p>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <Button asChild>
                    <Link to={`/groups/${id}/invoice/${activeCycle.id}`}>
                      <DollarSign className="mr-2 h-4 w-4" />
                      {isPresident ? 'Make Payment' : 'View Invoice'}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabs for Members and Payments */}
          <Tabs defaultValue="members" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
            </TabsList>

            <TabsContent value="members" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Member Queue</CardTitle>
                  <CardDescription>
                    Members receive the pot in order of their queue position
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="divide-y divide-border">
                    {members.map((member) => {
                      const isLocked = member.status === 'locked';
                      return (
                        <div 
                          key={member.id} 
                          className={cn(
                            "py-4 flex items-center justify-between",
                            isLocked && "opacity-60 bg-destructive/5 -mx-6 px-6"
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                              isLocked 
                                ? "bg-destructive/10 text-destructive" 
                                : "bg-primary/10 text-primary"
                            )}>
                              {isLocked ? <Lock className="h-4 w-4" /> : member.queue_position}
                            </div>
                            <div>
                              <p className="font-medium flex items-center gap-2">
                                {member.profile?.name || member.profile?.email}
                                {isLocked && <span className="text-xs text-destructive">(Locked)</span>}
                              </p>
                              <p className="text-sm text-muted-foreground">{member.profile?.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {/* Queue Position Controls (President Only, Active Members Only) */}
                            {isPresident && !isLocked && (
                              <div className="flex flex-col gap-0.5">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  disabled={movingMemberId === member.id || member.queue_position === 1}
                                  onClick={() => handleMoveQueuePosition(member.id, 'up')}
                                >
                                  <ChevronUp className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  disabled={movingMemberId === member.id || member.queue_position === members.filter(m => m.status === 'active').length}
                                  onClick={() => handleMoveQueuePosition(member.id, 'down')}
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                            {getRoleBadge(member.role)}
                            {member.missed_payment_count > 0 && (
                              <Badge variant="outline" className="text-warning border-warning/20">
                                {member.missed_payment_count} missed
                              </Badge>
                            )}
                            {getStatusBadge(member.status)}
                            
                            {/* Restore Button for Locked Members (President Only) */}
                            {isPresident && isLocked && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    className="text-primary"
                                    disabled={restoringMemberId === member.id}
                                  >
                                    {restoringMemberId === member.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <>
                                        <RotateCcw className="h-4 w-4 mr-1" />
                                        Restore
                                      </>
                                    )}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Restore Member</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to restore{' '}
                                      <strong>{member.profile?.name || member.profile?.email}</strong>?
                                      <br /><br />
                                      This will:
                                      <ul className="list-disc list-inside mt-2 space-y-1">
                                        <li>Set their status back to Active</li>
                                        <li>Reset their missed payment count to 0</li>
                                        <li>Move them to the end of the queue</li>
                                      </ul>
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleRestoreMember(member.id)}
                                    >
                                      <RotateCcw className="mr-2 h-4 w-4" />
                                      Restore Member
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="payments" className="mt-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Payment Status</CardTitle>
                      <CardDescription>
                        {activeCycle 
                          ? `Cycle: ${format(new Date(activeCycle.start_date), 'MMM d')} → ${format(new Date(activeCycle.due_date), 'MMM d, yyyy')}`
                          : 'No active payment cycle'
                        }
                      </CardDescription>
                    </div>
                    {/* Close Cycle Button - Only for president when cycle is active */}
                    {isPresident && activeCycle && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={closingCycle}
                          >
                            {closingCycle ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <StopCircle className="h-4 w-4 mr-2" />
                            )}
                            Close Cycle
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Close Payment Cycle</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to close this payment cycle?
                              <br /><br />
                              This will:
                              <ul className="list-disc list-inside mt-2 space-y-1">
                                <li>Mark the cycle as closed</li>
                                <li>Increment missed payment count for unpaid/rejected members</li>
                                <li>Lock any members with 3+ missed payments</li>
                              </ul>
                              <br />
                              <strong className="text-destructive">
                                {paymentLogs.filter(l => l.status === 'unpaid' || l.status === 'rejected').length} member(s) 
                                have unpaid/rejected payments.
                              </strong>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleCloseCycle}
                              className="bg-destructive hover:bg-destructive/90"
                            >
                              <StopCircle className="mr-2 h-4 w-4" />
                              Close Cycle
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {!activeCycle ? (
                    <div className="text-center py-8">
                      <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground mb-4">No active payment cycle</p>
                      {isPresident && (
                        <Dialog open={cycleDialogOpen} onOpenChange={setCycleDialogOpen}>
                          <DialogTrigger asChild>
                            <Button onClick={handleOpenCycleDialog}>
                              <Play className="mr-2 h-4 w-4" />
                              Start New Cycle
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                              <DialogTitle>Start New Payment Cycle</DialogTitle>
                              <DialogDescription>
                                Create a new payment cycle for {group.name}. All active members will receive a payment request.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="py-4">
                              <div className="space-y-4">
                                <div>
                                  <p className="text-sm font-medium mb-2">Contribution Amount</p>
                                  <p className="text-2xl font-bold text-primary">${group.contribution_amount}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium mb-2">Active Members</p>
                                  <p className="text-lg">{members.filter(m => m.status === 'active').length} members</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-sm font-medium mb-2">Start Date</p>
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant="outline"
                                          className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !selectedStartDate && "text-muted-foreground"
                                          )}
                                        >
                                          <Calendar className="mr-2 h-4 w-4" />
                                          {selectedStartDate ? format(selectedStartDate, 'MMM d') : 'Select'}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0" align="start">
                                        <CalendarComponent
                                          mode="single"
                                          selected={selectedStartDate}
                                          onSelect={setSelectedStartDate}
                                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                                          initialFocus
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium mb-2">End Date (Due)</p>
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant="outline"
                                          className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !selectedDueDate && "text-muted-foreground"
                                          )}
                                        >
                                          <Calendar className="mr-2 h-4 w-4" />
                                          {selectedDueDate ? format(selectedDueDate, 'MMM d') : 'Select'}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0" align="start">
                                        <CalendarComponent
                                          mode="single"
                                          selected={selectedDueDate}
                                          onSelect={setSelectedDueDate}
                                          disabled={(date) => date < (selectedStartDate || new Date())}
                                          initialFocus
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                </div>
                                {selectedStartDate && selectedDueDate && (
                                  <div className="p-3 bg-muted rounded-lg">
                                    <p className="text-sm text-center">
                                      Cycle: <span className="font-medium">{format(selectedStartDate, 'MMM d')}</span>
                                      {' → '}
                                      <span className="font-medium">{format(selectedDueDate, 'MMM d, yyyy')}</span>
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setCycleDialogOpen(false)}>
                                Cancel
                              </Button>
                              <Button 
                                onClick={startNewCycle} 
                                disabled={startingCycle || !selectedStartDate || !selectedDueDate || selectedStartDate >= selectedDueDate}
                              >
                                {startingCycle ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Starting...
                                  </>
                                ) : (
                                  <>
                                    <Play className="mr-2 h-4 w-4" />
                                    Start Cycle
                                  </>
                                )}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Filter Buttons */}
                      {isPresident && paymentLogs.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant={paymentFilter === 'all' ? 'default' : 'outline'}
                            onClick={() => setPaymentFilter('all')}
                          >
                            All ({paymentLogs.length})
                          </Button>
                          <Button
                            size="sm"
                            variant={paymentFilter === 'unpaid' ? 'default' : 'outline'}
                            onClick={() => setPaymentFilter('unpaid')}
                            className={paymentFilter !== 'unpaid' ? 'text-muted-foreground' : ''}
                          >
                            <Clock className="mr-1 h-3 w-3" />
                            Unpaid ({paymentLogs.filter(l => l.status === 'unpaid').length})
                          </Button>
                          <Button
                            size="sm"
                            variant={paymentFilter === 'pending' ? 'default' : 'outline'}
                            onClick={() => setPaymentFilter('pending')}
                            className={paymentFilter !== 'pending' ? 'text-yellow-600' : ''}
                          >
                            <Clock className="mr-1 h-3 w-3" />
                            Pending ({paymentLogs.filter(l => l.status === 'pending').length})
                          </Button>
                          <Button
                            size="sm"
                            variant={paymentFilter === 'verified' ? 'default' : 'outline'}
                            onClick={() => setPaymentFilter('verified')}
                            className={paymentFilter !== 'verified' ? 'text-green-600' : ''}
                          >
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Verified ({paymentLogs.filter(l => l.status === 'verified').length})
                          </Button>
                        </div>
                      )}

                      {/* Payment List */}
                      <div className="divide-y divide-border">
                        {filteredPaymentLogs.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            No payments match this filter
                          </div>
                        ) : (
                          filteredPaymentLogs.map((log) => {
                            // Color-coded background based on status
                            const bgColor = {
                              unpaid: 'bg-muted/30',
                              pending: 'bg-yellow-500/10 border-l-4 border-l-yellow-500',
                              verified: 'bg-green-500/10 border-l-4 border-l-green-500',
                              rejected: 'bg-red-500/10 border-l-4 border-l-red-500',
                            }[log.status];

                            return (
                              <div key={log.id} className={cn("py-4 px-3 -mx-3 flex items-center justify-between rounded-lg", bgColor)}>
                                <div className="flex items-center gap-4">
                                  <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                                    log.status === 'verified' ? 'bg-green-500/20 text-green-700' :
                                    log.status === 'pending' ? 'bg-yellow-500/20 text-yellow-700' :
                                    log.status === 'rejected' ? 'bg-red-500/20 text-red-700' :
                                    'bg-muted text-muted-foreground'
                                  )}>
                                    {log.member?.queue_position}
                                  </div>
                                  <div>
                                    <p className="font-medium">
                                      {log.member?.profile?.name || log.member?.profile?.email}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      ${group.contribution_amount}
                                      {log.marked_at && log.status === 'pending' && (
                                        <span className="ml-2">• Sent {format(new Date(log.marked_at), 'MMM d, h:mm a')}</span>
                                      )}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  {getPaymentStatusBadge(log.status)}
                                  {isPresident && log.status === 'pending' && (
                                    <div className="flex gap-2">
                                      {/* Verify Button with Confirmation */}
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button 
                                            size="sm" 
                                            variant="outline"
                                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                            disabled={verifyingId === log.id}
                                          >
                                            {verifyingId === log.id ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                              <CheckCircle className="h-4 w-4" />
                                            )}
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Verify Payment</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              Confirm that you received ${group.contribution_amount} from{' '}
                                              <strong>{log.member?.profile?.name || log.member?.profile?.email}</strong>?
                                              This will mark their payment as verified and reset their missed payment count.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                              onClick={() => verifyPayment(log.id, log.member?.id || '')}
                                              className="bg-green-600 hover:bg-green-700"
                                            >
                                              <CheckCircle className="mr-2 h-4 w-4" />
                                              Verify Payment
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>

                                      {/* Reject Button with Confirmation */}
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button 
                                            size="sm" 
                                            variant="outline"
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                            disabled={rejectingId === log.id}
                                          >
                                            {rejectingId === log.id ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                              <XCircle className="h-4 w-4" />
                                            )}
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Reject Payment</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              Are you sure you want to reject the payment from{' '}
                                              <strong>{log.member?.profile?.name || log.member?.profile?.email}</strong>?
                                              They will need to re-submit their payment.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                              onClick={() => rejectPayment(log.id)}
                                              className="bg-destructive hover:bg-destructive/90"
                                            >
                                              <XCircle className="mr-2 h-4 w-4" />
                                              Reject Payment
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
