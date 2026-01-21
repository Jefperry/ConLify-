import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Users, CreditCard, Settings, Activity,
  ArrowLeft, Copy, Check, Calendar, DollarSign, 
  Crown, AlertCircle, CheckCircle, Clock, XCircle, Loader2,
  UserPlus, Shield, User, Play, Timer, StopCircle, RotateCcw, Lock,
  ChevronUp, ChevronDown, PiggyBank, TrendingUp, Wallet, Bell,
  Eye, Download, MoreHorizontal, Send, Image as ImageIcon,
  BarChart3, Trash2, LogOut, Upload, Camera, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ActivityFeed } from '@/components/ActivityFeed';
import { ThemeToggle } from '@/components/ThemeToggle';
import { format, differenceInDays, differenceInHours, addWeeks, addMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { closeCycle, restoreMember } from '@/lib/cycleManagement';
import { requestNotificationPermission, addNotification, showNotification } from '@/lib/notifications';
import { logActivity, sendMemberReminder, sendBulkReminders } from '@/lib/activity';
import { exportToCsv, type CsvColumn } from '@/lib/exportCsv';
import { uploadGroupPhoto, deleteGroupPhoto } from '@/lib/storage';
import { Group, GroupMember, Profile, PaymentCycle, PaymentLog, MemberStatus, PaymentStatus, MemberRole } from '@/types/database';

// Import settings components
import AnalyticsDashboard from '@/components/settings/AnalyticsDashboard';
import PersonalStats from '@/components/settings/PersonalStats';
import MemberPerformance from '@/components/settings/MemberPerformance';
import CycleReports from '@/components/settings/CycleReports';
import GeneralSettings from '@/components/settings/GeneralSettings';

import { LucideIcon } from 'lucide-react';

// Types
interface MemberWithProfile extends GroupMember {
  profile: Profile;
}

interface PaymentLogWithMember extends PaymentLog {
  member: MemberWithProfile;
}

type NavTab = 'dashboard' | 'members' | 'payments' | 'analytics' | 'notifications' | 'settings';

// Sidebar Navigation Item Component
const NavItem = ({ 
  icon: Icon, 
  label, 
  active, 
  onClick 
}: { 
  icon: LucideIcon; 
  label: string; 
  active: boolean; 
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-300",
      active 
        ? "bg-green-500 text-white shadow-lg shadow-green-500/25 dark:bg-amber-500 dark:shadow-[0_0_15px_rgba(245,158,11,0.3)]" 
        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
    )}
  >
    <Icon className="w-5 h-5" strokeWidth={1.5} />
    <span className="font-medium">{label}</span>
  </button>
);

// Stats Card Component (Zendenta Style)
const StatsCard = ({ 
  title, 
  value, 
  subtitle,
  icon: Icon,
  trend,
  trendUp
}: { 
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: number;
  trendUp?: boolean;
}) => (
  <Card className="bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl rounded-[24px] border border-slate-100 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] dark:shadow-none dark:hover:bg-slate-900/50 transition-all duration-300">
    <CardContent className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 bg-slate-100 dark:bg-white/5 rounded-xl">
          <Icon className="w-5 h-5 text-slate-600 dark:text-slate-400" strokeWidth={1.5} />
        </div>
        {trend !== undefined && (
          <div className={cn(
            "flex items-center gap-1 text-sm font-medium",
            trendUp ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"
          )}>
            <TrendingUp className={cn("w-4 h-4", !trendUp && "rotate-180")} />
            {trend}%
          </div>
        )}
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">{title}</p>
      <p className="text-2xl font-semibold text-slate-900 dark:text-white">{value}</p>
      {subtitle && (
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>
      )}
    </CardContent>
  </Card>
);

// Payment Status Badge (Pill Style)
const PaymentStatusBadge = ({ status }: { status: PaymentStatus }) => {
  const config = {
    unpaid: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400', label: 'Unpaid' },
    pending: { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-400', label: 'Pending' },
    verified: { bg: 'bg-green-100 dark:bg-green-500/20', text: 'text-green-700 dark:text-green-400', label: 'Paid' },
    rejected: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-400', label: 'Rejected' },
  };
  const { bg, text, label } = config[status];
  return (
    <span className={cn("px-3 py-1 rounded-full text-xs font-medium", bg, text)}>
      {label}
    </span>
  );
};

// Member Role Badge
const MemberRoleBadge = ({ role }: { role: MemberRole }) => {
  const config = {
    president: { bg: 'bg-yellow-100 dark:bg-yellow-500/20', text: 'text-yellow-700 dark:text-yellow-400', icon: Crown, label: 'President' },
    vice_president: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-400', icon: Shield, label: 'Vice President' },
    member: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400', icon: User, label: 'Member' },
  };
  const { bg, text, icon: RoleIcon, label } = config[role] || config.member;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium", bg, text)}>
      <RoleIcon className="w-3 h-3" />
      {label}
    </span>
  );
};

// Floating Alert Banner
const AlertBanner = ({ 
  type, 
  message, 
  action 
}: { 
  type: 'warning' | 'info' | 'success';
  message: string;
  action?: { label: string; onClick: () => void };
}) => {
  const config = {
    warning: { bg: 'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20', text: 'text-amber-800 dark:text-amber-400', icon: AlertCircle },
    info: { bg: 'bg-blue-50 border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/20', text: 'text-blue-800 dark:text-blue-400', icon: Bell },
    success: { bg: 'bg-green-50 border-green-200 dark:bg-green-500/10 dark:border-green-500/20', text: 'text-green-800 dark:text-green-400', icon: CheckCircle },
  };
  const { bg, text, icon: AlertIcon } = config[type];
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={cn("flex items-center justify-between p-4 rounded-2xl border", bg)}
    >
      <div className="flex items-center gap-3">
        <AlertIcon className={cn("w-5 h-5", text)} />
        <span className={cn("text-sm font-medium", text)}>{message}</span>
      </div>
      {action && (
        <Button 
          size="sm" 
          variant="ghost" 
          onClick={action.onClick}
          className={cn("text-xs", text)}
        >
          {action.label}
        </Button>
      )}
    </motion.div>
  );
};

export default function GroupWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Navigation state
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  
  // Data state
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [activeCycle, setActiveCycle] = useState<PaymentCycle | null>(null);
  const [paymentLogs, setPaymentLogs] = useState<PaymentLogWithMember[]>([]);
  const [allCycles, setAllCycles] = useState<PaymentCycle[]>([]);
  
  // UI state
  const [copied, setCopied] = useState(false);
  const [cycleDialogOpen, setCycleDialogOpen] = useState(false);
  const [selectedStartDate, setSelectedStartDate] = useState<Date | undefined>(undefined);
  const [selectedDueDate, setSelectedDueDate] = useState<Date | undefined>(undefined);
  const [startingCycle, setStartingCycle] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [closingCycle, setClosingCycle] = useState(false);
  const [restoringMemberId, setRestoringMemberId] = useState<string | null>(null);
  const [movingMemberId, setMovingMemberId] = useState<string | null>(null);
  const [remindingMemberId, setRemindingMemberId] = useState<string | null>(null);
  const [remindingAll, setRemindingAll] = useState(false);
  const [markingAsSent, setMarkingAsSent] = useState(false);

  const isPresident = group?.president_id === user?.id;
  const currentMember = members.find(m => m.user_id === user?.id);

  // Calculate default due date based on group frequency
  const getDefaultDueDate = () => {
    const today = new Date();
    if (group?.frequency === 'weekly') {
      return addWeeks(today, 1);
    } else {
      return addMonths(today, 1);
    }
  };

  // Cycle countdown calculation
  const cycleCountdown = useMemo(() => {
    if (!activeCycle) return null;
    const startDate = new Date(activeCycle.start_date);
    const dueDate = new Date(activeCycle.due_date);
    const now = new Date();
    
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

  // Payment progress calculation
  const paymentProgress = useMemo(() => {
    if (!paymentLogs.length) return { verified: 0, pending: 0, unpaid: 0, total: 0, percentage: 0 };
    const verified = paymentLogs.filter(l => l.status === 'verified').length;
    const pending = paymentLogs.filter(l => l.status === 'pending').length;
    const unpaid = paymentLogs.filter(l => l.status === 'unpaid').length;
    const total = paymentLogs.length;
    const percentage = total > 0 ? Math.round((verified / total) * 100) : 0;
    return { verified, pending, unpaid, total, percentage };
  }, [paymentLogs]);

  // Calculate historical stats
  const historicalStats = useMemo(() => {
    const completedCycles = allCycles.filter(c => c.status === 'closed').length;
    const totalContributed = completedCycles * (group?.contribution_amount || 0) * members.filter(m => m.status === 'active').length;
    const activeMembers = members.filter(m => m.status === 'active').length;
    const lockedMembers = members.filter(m => m.status === 'locked').length;
    
    return {
      completedCycles,
      totalContributed,
      activeMembers,
      lockedMembers,
      totalMembers: members.length
    };
  }, [allCycles, group, members]);

  // Get current recipient
  const currentRecipient = useMemo(() => {
    if (!activeCycle) return null;
    const activeMembers = members.filter(m => m.status === 'active').sort((a, b) => a.queue_position - b.queue_position);
    return activeMembers[0] || null;
  }, [activeCycle, members]);

  // My payment status for current cycle
  const myPaymentStatus = useMemo(() => {
    if (!currentMember) return null;
    const myLog = paymentLogs.find(l => l.member_id === currentMember.id);
    return myLog?.status || null;
  }, [currentMember, paymentLogs]);

  useEffect(() => {
    if (id) {
      fetchGroupData();
    }
  }, [id]);

  // Real-time subscription for payment updates
  useEffect(() => {
    if (!activeCycle || !isPresident) return;

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
          
          if (newLog.status === 'pending') {
            const member = members.find(m => m.id === newLog.member_id);
            const memberName = member?.profile?.name || 'A member';
            
            addNotification({
              type: 'payment_pending',
              title: 'Payment Submitted',
              message: `${memberName} has marked their payment as sent and is awaiting verification.`,
              groupId: id,
            });

            showNotification('Payment Submitted', {
              body: `${memberName} has marked their payment as sent.`,
              tag: `payment-${newLog.id}`,
            });

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

      // Fetch members with profiles
      const { data: membersData, error: membersError } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', id)
        .order('queue_position');

      if (membersError) throw membersError;

      if (membersData && membersData.length > 0) {
        const userIds = membersData.map(m => m.user_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds);

        const membersWithProfiles = membersData.map(member => ({
          ...member,
          profile: profilesData?.find(p => p.id === member.user_id) || null
        }));
        
        setMembers(membersWithProfiles as MemberWithProfile[]);
      } else {
        setMembers([]);
      }

      // Fetch all cycles for historical stats
      const { data: allCyclesData } = await supabase
        .from('payment_cycles')
        .select('*')
        .eq('group_id', id)
        .order('created_at', { ascending: false });

      setAllCycles(allCyclesData || []);

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

  const handleOpenCycleDialog = () => {
    setSelectedStartDate(new Date());
    setSelectedDueDate(getDefaultDueDate());
    setCycleDialogOpen(true);
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

      const activeMembers = members.filter(m => m.status === 'active');
      
      if (activeMembers.length === 0) {
        toast({
          title: "Warning",
          description: "No active members to create payment logs for",
          variant: "destructive",
        });
        return;
      }

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
        description: `Payment cycle created with ${activeMembers.length} members.`
      });
      
      setCycleDialogOpen(false);
      setSelectedStartDate(undefined);
      setSelectedDueDate(undefined);
      fetchGroupData();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to start cycle";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setStartingCycle(false);
    }
  };

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

  const verifyPayment = async (logId: string, memberId: string) => {
    setVerifyingId(logId);
    try {
      const { error: logError } = await supabase
        .from('payment_logs')
        .update({ status: 'verified', verified_at: new Date().toISOString() })
        .eq('id', logId);

      if (logError) throw logError;

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

  // Mark current user's payment as sent (changes status from unpaid/rejected to pending)
  const handleMarkAsSent = async () => {
    if (!currentMember || !activeCycle) return;
    
    setMarkingAsSent(true);
    try {
      const myLog = paymentLogs.find(l => l.member_id === currentMember.id);
      if (!myLog) throw new Error('No payment log found');
      
      const { error } = await supabase
        .from('payment_logs')
        .update({ 
          status: 'pending', 
          marked_at: new Date().toISOString() 
        })
        .eq('id', myLog.id);

      if (error) throw error;
      
      // Log activity
      await logActivity({
        groupId: id!,
        actorId: user!.id,
        type: 'payment_submitted',
        message: `${currentMember.profile?.name || 'You'} submitted payment for verification`,
      });
      
      toast({ 
        title: "Payment marked as sent!",
        description: "Waiting for the president to verify your payment."
      });
      fetchGroupData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to mark payment";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setMarkingAsSent(false);
    }
  };

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
      const tempPosition = -1;
      const currentPos = currentMember.queue_position;
      const swapPos = swapMember.queue_position;

      const { error: error1 } = await supabase
        .from('group_members')
        .update({ queue_position: tempPosition })
        .eq('id', currentMember.id);
      if (error1) throw error1;

      const { error: error2 } = await supabase
        .from('group_members')
        .update({ queue_position: currentPos })
        .eq('id', swapMember.id);
      if (error2) throw error2;

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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update queue position";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setMovingMemberId(null);
    }
  };

  const handleRemindMember = async (paymentLogId: string, memberId: string, memberName: string) => {
    if (!group || !activeCycle || !user) return;
    
    setRemindingMemberId(memberId);
    try {
      const senderName = currentMember?.profile?.name || user.email || 'Group President';
      
      const targetMember = members.find(m => m.id === memberId);
      if (!targetMember?.user_id) {
        throw new Error('Could not find target member');
      }
      
      const result = await sendMemberReminder(
        group.id,
        paymentLogId,
        targetMember.user_id,
        memberName,
        user.id,
        senderName,
        group.name,
        group.contribution_amount
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to send reminder');
      }

      if (result.alreadyRemindedRecently) {
        toast({
          title: "Already Reminded",
          description: "This member was reminded within the last hour.",
        });
      } else {
        toast({
          title: "Reminder Sent",
          description: `Reminder sent to ${memberName}`,
        });
      }

      fetchGroupData();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to send reminder";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setRemindingMemberId(null);
    }
  };

  const handleRemindAll = async () => {
    if (!group || !activeCycle || !user) return;
    
    const unpaidLogs = paymentLogs.filter(l => l.status === 'unpaid' || l.status === 'rejected');
    if (unpaidLogs.length === 0) {
      toast({
        title: "No Reminders Needed",
        description: "All members have paid or are pending verification.",
      });
      return;
    }

    setRemindingAll(true);
    try {
      const senderName = currentMember?.profile?.name || user.email || 'Group President';
      
      const result = await sendBulkReminders(
        group.id,
        activeCycle.id,
        user.id,
        senderName,
        group.name,
        group.contribution_amount
      );

      toast({
        title: "Reminders Sent",
        description: `Sent ${result.remindedCount} reminder(s). ${result.skippedCount} already reminded recently.`,
      });

      fetchGroupData();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to send reminders";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setRemindingAll(false);
    }
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="flex h-screen bg-slate-50">
        <div className="w-[260px] bg-white border-r border-slate-100 p-6">
          <Skeleton className="h-8 w-32 mb-8" />
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        </div>
        <div className="flex-1 p-8">
          <div className="grid grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32 rounded-[24px]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!group) return null;

  // Content animation variants
  const contentVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.2 } },
    exit: { opacity: 0, x: -20, transition: { duration: 0.15 } }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#020617]">
      {/* Left Sidebar - 260px */}
      <aside className="w-[260px] bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl border-r border-slate-100 dark:border-white/5 flex flex-col">
        {/* Group Header */}
        <div className="p-6 border-b border-slate-100 dark:border-white/5">
          <button 
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Dashboard</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-amber-500/20 rounded-xl flex items-center justify-center">
              <PiggyBank className="w-5 h-5 text-green-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-slate-900 dark:text-white truncate">{group.name}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{members.length} members</p>
            </div>
          </div>
          
          {/* Invite Code */}
          <div className="mt-4 flex items-center gap-2">
            <code className="flex-1 text-xs bg-slate-100 dark:bg-white/5 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-400 truncate">
              {group.invite_code}
            </code>
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-8 w-8"
              onClick={copyInviteCode}
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          <NavItem 
            icon={LayoutDashboard} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <NavItem 
            icon={Users} 
            label="Members" 
            active={activeTab === 'members'} 
            onClick={() => setActiveTab('members')} 
          />
          <NavItem 
            icon={CreditCard} 
            label="Payments" 
            active={activeTab === 'payments'} 
            onClick={() => setActiveTab('payments')} 
          />
          <NavItem 
            icon={BarChart3} 
            label="Analytics" 
            active={activeTab === 'analytics'} 
            onClick={() => setActiveTab('analytics')} 
          />
          <NavItem 
            icon={Bell} 
            label="Notifications" 
            active={activeTab === 'notifications'} 
            onClick={() => setActiveTab('notifications')} 
          />
        </nav>

        {/* Settings Link */}
        <div className="p-4 border-t border-slate-100 dark:border-white/5">
          <NavItem 
            icon={Settings} 
            label="Settings" 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')} 
          />
        </div>
      </aside>

      {/* Main Workspace - Fluid */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-[#020617]">
        {/* Floating Alerts */}
        <div className="p-6 pb-0 space-y-3">
          <AnimatePresence>
            {/* Your payment is due alert */}
            {activeCycle && myPaymentStatus && ['unpaid', 'rejected'].includes(myPaymentStatus) && (
              <AlertBanner 
                type="warning"
                message={`Your payment of $${group.contribution_amount} is due. Don't keep your group waiting!`}
                action={{
                  label: "Mark as Paid",
                  onClick: () => setActiveTab('payments')
                }}
              />
            )}
            
            {/* Pending verifications for president */}
            {isPresident && paymentProgress.pending > 0 && (
              <AlertBanner 
                type="info"
                message={`${paymentProgress.pending} payment(s) awaiting your verification.`}
                action={{
                  label: "Review",
                  onClick: () => setActiveTab('payments')
                }}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                variants={contentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="space-y-6"
              >
                {/* Stats Grid */}
                <div className="grid grid-cols-4 gap-6">
                  <StatsCard 
                    title="Total Collected"
                    value={`$${historicalStats.totalContributed.toLocaleString()}`}
                    subtitle={`${historicalStats.completedCycles} cycles completed`}
                    icon={Wallet}
                  />
                  <StatsCard 
                    title="Current Cycle"
                    value={`${paymentProgress.verified}/${paymentProgress.total}`}
                    subtitle={`${paymentProgress.percentage}% paid`}
                    icon={TrendingUp}
                    trend={paymentProgress.percentage}
                    trendUp={paymentProgress.percentage >= 50}
                  />
                  <StatsCard 
                    title="Active Members"
                    value={historicalStats.activeMembers}
                    subtitle={historicalStats.lockedMembers > 0 ? `${historicalStats.lockedMembers} locked` : 'All members active'}
                    icon={Users}
                  />
                  <StatsCard 
                    title="Contribution"
                    value={`$${group.contribution_amount}`}
                    subtitle={group.frequency === 'weekly' ? 'Weekly' : 'Monthly'}
                    icon={DollarSign}
                  />
                </div>

                {/* Cycle Progress Card */}
                <Card className="bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl rounded-[24px] border border-slate-100 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg text-slate-900 dark:text-white">Current Cycle Progress</CardTitle>
                        <CardDescription className="text-slate-500 dark:text-slate-400">
                          {activeCycle 
                            ? `${format(new Date(activeCycle.start_date), 'MMM d')} - ${format(new Date(activeCycle.due_date), 'MMM d, yyyy')}`
                            : 'No active cycle'
                          }
                        </CardDescription>
                      </div>
                      {cycleCountdown && (
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "px-3 py-1",
                            cycleCountdown.isOverdue ? "bg-red-100 text-red-700 border-red-200" :
                            cycleCountdown.isPending ? "bg-blue-100 text-blue-700 border-blue-200" :
                            "bg-green-100 text-green-700 border-green-200"
                          )}
                        >
                          <Timer className="w-3.5 h-3.5 mr-1.5" />
                          {cycleCountdown.text}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {activeCycle ? (
                      <div className="space-y-4">
                        {/* Progress Bar */}
                        <div className="relative">
                          <Progress 
                            value={paymentProgress.percentage} 
                            className="h-4 rounded-full bg-slate-100"
                          />
                          {/* Target Marker */}
                          <div 
                            className="absolute top-0 bottom-0 w-0.5 bg-slate-400"
                            style={{ left: '100%', transform: 'translateX(-50%)' }}
                          />
                        </div>
                        
                        {/* Status Breakdown */}
                        <div className="flex items-center gap-6 text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-green-500" />
                            <span className="text-slate-600">Paid: {paymentProgress.verified}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-amber-400" />
                            <span className="text-slate-600">Pending: {paymentProgress.pending}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-slate-300" />
                            <span className="text-slate-600">Unpaid: {paymentProgress.unpaid}</span>
                          </div>
                        </div>

                        {/* Current Recipient */}
                        {currentRecipient && (
                          <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-100">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={currentRecipient.profile?.avatar_url || ''} />
                              <AvatarFallback className="bg-green-200 text-green-700">
                                {currentRecipient.profile?.name?.charAt(0) || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-green-900">
                                {currentRecipient.profile?.name || 'Unknown'} receives this cycle's payout
                              </p>
                              <p className="text-xs text-green-700">
                                ${(group.contribution_amount * (paymentProgress.total - 1)).toLocaleString()} expected
                              </p>
                            </div>
                            <Crown className="w-5 h-5 text-green-600" />
                          </div>
                        )}

                        {/* President Actions */}
                        {isPresident && (
                          <div className="flex items-center gap-3 pt-2">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  className="rounded-xl border-slate-200"
                                  disabled={closingCycle}
                                >
                                  {closingCycle ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  ) : (
                                    <StopCircle className="w-4 h-4 mr-2" />
                                  )}
                                  Close Cycle
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Close Current Cycle?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will finalize the current payment cycle. Members who haven't paid will receive a missed payment mark.
                                    After 3 missed payments, members will be locked from participating.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={handleCloseCycle}>
                                    Close Cycle
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            
                            <Button 
                              variant="outline" 
                              className="rounded-xl border-slate-200"
                              onClick={handleRemindAll}
                              disabled={remindingAll || paymentProgress.unpaid === 0}
                            >
                              {remindingAll ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Bell className="w-4 h-4 mr-2" />
                              )}
                              Remind All ({paymentProgress.unpaid})
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Calendar className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="text-slate-600 mb-4">No active cycle</p>
                        {isPresident && (
                          <Button 
                            className="bg-green-500 hover:bg-green-600 text-white rounded-xl dark:bg-amber-500 dark:hover:bg-amber-600 dark:shadow-[0_0_20px_rgba(245,158,11,0.25)] transition-all duration-300"
                            onClick={handleOpenCycleDialog}
                          >
                            <Play className="w-4 h-4 mr-2" />
                            Start New Cycle
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Payout Queue Preview */}
                <Card className="bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl rounded-[24px] border border-slate-100 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none">
                  <CardHeader>
                    <CardTitle className="text-lg text-slate-900 dark:text-white">Payout Queue</CardTitle>
                    <CardDescription className="text-slate-500 dark:text-slate-400">
                      Order in which members receive their payouts
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3 overflow-x-auto pb-2">
                      {members
                        .filter(m => m.status === 'active')
                        .sort((a, b) => a.queue_position - b.queue_position)
                        .slice(0, 6)
                        .map((member, index) => (
                          <div 
                            key={member.id}
                            className={cn(
                              "flex flex-col items-center p-4 rounded-xl min-w-[100px]",
                              index === 0 ? "bg-green-50 border border-green-100" : "bg-slate-50"
                            )}
                          >
                            <div className="relative">
                              <Avatar className="h-12 w-12">
                                <AvatarImage src={member.profile?.avatar_url || ''} />
                                <AvatarFallback className={index === 0 ? "bg-green-200 text-green-700" : "bg-slate-200 text-slate-600"}>
                                  {member.profile?.name?.charAt(0) || '?'}
                                </AvatarFallback>
                              </Avatar>
                              <span className={cn(
                                "absolute -bottom-1 -right-1 w-5 h-5 rounded-full text-xs font-medium flex items-center justify-center",
                                index === 0 ? "bg-green-500 text-white" : "bg-slate-200 text-slate-600"
                              )}>
                                {index + 1}
                              </span>
                            </div>
                            <p className="text-xs font-medium text-slate-900 dark:text-white mt-2 text-center truncate max-w-[80px]">
                              {member.profile?.name?.split(' ')[0] || 'Unknown'}
                            </p>
                            {index === 0 && (
                              <span className="text-[10px] text-green-600 font-medium mt-1">NEXT</span>
                            )}
                          </div>
                        ))}
                      {members.filter(m => m.status === 'active').length > 6 && (
                        <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 min-w-[80px]">
                          <span className="text-sm text-slate-500 dark:text-slate-400">
                            +{members.filter(m => m.status === 'active').length - 6} more
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Members Tab */}
            {activeTab === 'members' && (
              <motion.div
                key="members"
                variants={contentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Members</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{members.length} total members</p>
                  </div>
                </div>

                {/* Members Table */}
                <Card className="bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl rounded-[24px] border border-slate-100 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-white/5">
                        <tr>
                          <th className="text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-4">Member</th>
                          <th className="text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-4">Role</th>
                          <th className="text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-4">Queue Position</th>
                          <th className="text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-4">Status</th>
                          <th className="text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-4">Payment</th>
                          {isPresident && (
                            <th className="text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-4">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {members
                          .sort((a, b) => a.queue_position - b.queue_position)
                          .map((member) => {
                            const memberPaymentLog = paymentLogs.find(l => l.member_id === member.id);
                            const isFirst = members.filter(m => m.status === 'active').sort((a, b) => a.queue_position - b.queue_position)[0]?.id === member.id;
                            
                            return (
                              <tr key={member.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                <td className="px-6 py-5">
                                  <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10">
                                      <AvatarImage src={member.profile?.avatar_url || ''} />
                                      <AvatarFallback className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                        {member.profile?.name?.charAt(0) || '?'}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <p className="font-medium text-slate-900 dark:text-white">{member.profile?.name || 'Unknown'}</p>
                                      <p className="text-xs text-slate-500 dark:text-slate-400">{member.profile?.email}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-5">
                                  <MemberRoleBadge role={member.role} />
                                </td>
                                <td className="px-6 py-5">
                                  <div className="flex items-center gap-2">
                                    <span className={cn(
                                      "inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium",
                                      isFirst ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                                    )}>
                                      #{member.queue_position}
                                    </span>
                                    {isFirst && (
                                      <span className="text-xs text-green-600 dark:text-green-400 font-medium">Next payout</span>
                                    )}
                                    {isPresident && member.status === 'active' && (
                                      <div className="flex items-center gap-1 ml-2">
                                        <Button 
                                          size="icon" 
                                          variant="ghost" 
                                          className="h-6 w-6"
                                          onClick={() => handleMoveQueuePosition(member.id, 'up')}
                                          disabled={movingMemberId === member.id || member.queue_position === 1}
                                        >
                                          <ChevronUp className="w-4 h-4" />
                                        </Button>
                                        <Button 
                                          size="icon" 
                                          variant="ghost" 
                                          className="h-6 w-6"
                                          onClick={() => handleMoveQueuePosition(member.id, 'down')}
                                          disabled={movingMemberId === member.id}
                                        >
                                          <ChevronDown className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-5">
                                  <span className={cn(
                                    "px-3 py-1 rounded-full text-xs font-medium",
                                    member.status === 'active' ? "bg-green-100 text-green-700" :
                                    member.status === 'locked' ? "bg-red-100 text-red-700" :
                                    "bg-slate-100 text-slate-600"
                                  )}>
                                    {member.status === 'active' ? 'Active' :
                                     member.status === 'locked' ? 'Locked' : 'Pending'}
                                  </span>
                                </td>
                                <td className="px-6 py-5">
                                  {memberPaymentLog ? (
                                    <PaymentStatusBadge status={memberPaymentLog.status} />
                                  ) : (
                                    <span className="text-sm text-slate-400">-</span>
                                  )}
                                </td>
                                {isPresident && (
                                  <td className="px-6 py-5 text-right">
                                    {member.status === 'locked' ? (
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        className="rounded-lg"
                                        onClick={() => handleRestoreMember(member.id)}
                                        disabled={restoringMemberId === member.id}
                                      >
                                        {restoringMemberId === member.id ? (
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <>
                                            <RotateCcw className="w-4 h-4 mr-1" />
                                            Restore
                                          </>
                                        )}
                                      </Button>
                                    ) : memberPaymentLog && ['unpaid', 'rejected'].includes(memberPaymentLog.status) ? (
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        className="rounded-lg"
                                        onClick={() => handleRemindMember(memberPaymentLog.id, member.id, member.profile?.name || 'Member')}
                                        disabled={remindingMemberId === member.id}
                                      >
                                        {remindingMemberId === member.id ? (
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <>
                                            <Bell className="w-4 h-4 mr-1" />
                                            Remind
                                          </>
                                        )}
                                      </Button>
                                    ) : null}
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Payments Tab */}
            {activeTab === 'payments' && (
              <motion.div
                key="payments"
                variants={contentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Payments</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {activeCycle 
                        ? `Cycle: ${format(new Date(activeCycle.start_date), 'MMM d')} - ${format(new Date(activeCycle.due_date), 'MMM d')}`
                        : 'No active cycle'
                      }
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {isPresident && !activeCycle && (
                      <Button 
                        className="bg-green-500 hover:bg-green-600 text-white rounded-xl dark:bg-amber-500 dark:hover:bg-amber-600 dark:shadow-[0_0_20px_rgba(245,158,11,0.25)] transition-all duration-300"
                        onClick={handleOpenCycleDialog}
                      >
                        <Play className="w-4 h-4 mr-2" strokeWidth={1.5} />
                        Start Cycle
                      </Button>
                    )}
                    {isPresident && activeCycle && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
                            disabled={closingCycle}
                          >
                            {closingCycle ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <StopCircle className="w-4 h-4 mr-2" strokeWidth={1.5} />
                            )}
                            Close Cycle
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="dark:bg-slate-900/90 dark:backdrop-blur-xl dark:border-white/10">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="dark:text-white">Close Current Cycle?</AlertDialogTitle>
                            <AlertDialogDescription className="dark:text-slate-400">
                              This will finalize the current payment cycle. Members who haven't paid will receive a missed payment mark.
                              After 3 missed payments, members will be locked from participating.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="dark:bg-slate-800 dark:text-white dark:border-white/10">Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleCloseCycle} className="bg-red-500 hover:bg-red-600">
                              Close Cycle
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>

                {/* My Payment Status Card - Show when user has unpaid/rejected payment */}
                {activeCycle && myPaymentStatus && ['unpaid', 'rejected'].includes(myPaymentStatus) && (
                  <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 rounded-[24px] border border-amber-200 dark:border-amber-500/20 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-amber-100 dark:bg-amber-500/20 rounded-full flex items-center justify-center">
                            <DollarSign className="w-6 h-6 text-amber-600 dark:text-amber-400" strokeWidth={1.5} />
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-900 dark:text-white">Your Payment Due</h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              ${group.contribution_amount} · {myPaymentStatus === 'rejected' ? 'Rejected - please resubmit' : 'Awaiting your payment'}
                            </p>
                          </div>
                        </div>
                        <Button 
                          className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-lg dark:shadow-[0_0_20px_rgba(245,158,11,0.25)]"
                          onClick={handleMarkAsSent}
                          disabled={markingAsSent}
                        >
                          {markingAsSent ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4 mr-2" strokeWidth={1.5} />
                          )}
                          Mark as Sent
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Payment Logs */}
                {activeCycle && paymentLogs.length > 0 ? (
                  <Card className="bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl rounded-[24px] border border-slate-100 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overflow-hidden">
                    <div className="p-6 border-b border-slate-100 dark:border-white/5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className={cn("rounded-full", !paymentLogs.some(l => l.status === 'pending') && "opacity-50")}
                            disabled={!paymentLogs.some(l => l.status === 'pending')}
                          >
                            Pending ({paymentLogs.filter(l => l.status === 'pending').length})
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="rounded-full"
                          >
                            All ({paymentLogs.length})
                          </Button>
                        </div>
                        {/* President reminder button */}
                        {isPresident && paymentProgress.unpaid > 0 && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="rounded-xl"
                            onClick={handleRemindAll}
                            disabled={remindingAll}
                          >
                            {remindingAll ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Bell className="w-4 h-4 mr-2" strokeWidth={1.5} />
                            )}
                            Remind Unpaid ({paymentProgress.unpaid})
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-white/5">
                      {paymentLogs
                        .sort((a, b) => {
                          // Show pending first, then unpaid, then verified
                          const order = { pending: 0, unpaid: 1, rejected: 2, verified: 3 };
                          return order[a.status] - order[b.status];
                        })
                        .map((log) => (
                          <div key={log.id} className="p-6 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <Avatar className="h-12 w-12">
                                  <AvatarImage src={log.member?.profile?.avatar_url || ''} />
                                  <AvatarFallback className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                    {log.member?.profile?.name?.charAt(0) || '?'}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-slate-900 dark:text-white">{log.member?.profile?.name || 'Unknown'}</p>
                                  <p className="text-sm text-slate-500 dark:text-slate-400">
                                    ${group.contribution_amount}
                                    {log.marked_at && ` • Submitted ${format(new Date(log.marked_at), 'MMM d, h:mm a')}`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <PaymentStatusBadge status={log.status} />
                                
                                {/* President actions for pending payments */}
                                {isPresident && log.status === 'pending' && (
                                  <div className="flex items-center gap-2">
                                    <Button 
                                      size="sm"
                                      className="bg-green-500 hover:bg-green-600 text-white rounded-lg dark:bg-green-600 dark:hover:bg-green-700"
                                      onClick={() => verifyPayment(log.id, log.member_id)}
                                      disabled={verifyingId === log.id}
                                    >
                                      {verifyingId === log.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <>
                                          <CheckCircle className="w-4 h-4 mr-1" />
                                          Verify
                                        </>
                                      )}
                                    </Button>
                                    <Button 
                                      size="sm"
                                      variant="outline"
                                      className="rounded-lg border-red-200 text-red-600 hover:bg-red-50"
                                      onClick={() => rejectPayment(log.id)}
                                      disabled={rejectingId === log.id}
                                    >
                                      {rejectingId === log.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <>
                                          <XCircle className="w-4 h-4 mr-1" strokeWidth={1.5} />
                                          Reject
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                )}
                                
                                {/* President remind button for unpaid/rejected */}
                                {isPresident && ['unpaid', 'rejected'].includes(log.status) && (
                                  <Button 
                                    size="sm"
                                    variant="outline"
                                    className="rounded-lg"
                                    onClick={() => handleRemindMember(log.id, log.member_id, log.member?.profile?.name || 'Member')}
                                    disabled={remindingMemberId === log.member_id}
                                  >
                                    {remindingMemberId === log.member_id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <>
                                        <Bell className="w-4 h-4 mr-1" strokeWidth={1.5} />
                                        Remind
                                      </>
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </Card>
                ) : (
                  <Card className="bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl rounded-[24px] border border-slate-100 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none">
                    <CardContent className="py-12 text-center">
                      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CreditCard className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-slate-600 dark:text-slate-400">
                        {activeCycle ? 'No payment logs for this cycle' : 'Start a cycle to begin collecting payments'}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Payout History */}
                <Card className="bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl rounded-[24px] border border-slate-100 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none">
                  <CardHeader>
                    <CardTitle className="text-lg text-slate-900 dark:text-white">Cycle History</CardTitle>
                    <CardDescription className="text-slate-500 dark:text-slate-400">Previous payment cycles</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {allCycles.filter(c => c.status === 'closed').length > 0 ? (
                      <div className="space-y-3">
                        {allCycles
                          .filter(c => c.status === 'closed')
                          .slice(0, 5)
                          .map((cycle) => (
                            <div key={cycle.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center">
                                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                                </div>
                                <div>
                                  <p className="font-medium text-slate-900 dark:text-white">
                                    {format(new Date(cycle.start_date), 'MMM d')} - {format(new Date(cycle.due_date), 'MMM d, yyyy')}
                                  </p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">Closed</p>
                                </div>
                              </div>
                              <span className="text-sm font-medium text-green-600 dark:text-green-400">
                                ${(group.contribution_amount * members.filter(m => m.status === 'active').length).toLocaleString()}
                              </span>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="text-center text-slate-500 dark:text-slate-400 py-4">No closed cycles yet</p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && (
              <motion.div
                key="analytics"
                variants={contentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="space-y-6"
              >
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Analytics</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Payment statistics and insights</p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatsCard
                    icon={CheckCircle}
                    title="People Paid"
                    value={paymentLogs.filter(l => l.status === 'verified').length}
                    subtitle={`of ${members.filter(m => m.status === 'active').length} members`}
                    color="green"
                  />
                  <StatsCard
                    icon={Wallet}
                    title="My Payments"
                    value={`$${allCycles.filter(c => c.status === 'closed').length * group.contribution_amount}`}
                    subtitle="Total contributed"
                    color="blue"
                  />
                  <StatsCard
                    icon={Clock}
                    title="Payments Left"
                    value={activeCycle ? members.filter(m => m.status === 'active').length - paymentLogs.filter(l => l.status === 'verified').length : 0}
                    subtitle="This cycle"
                    color="amber"
                  />
                  <StatsCard
                    icon={TrendingUp}
                    title="Completion Rate"
                    value={`${activeCycle && members.filter(m => m.status === 'active').length > 0 
                      ? Math.round((paymentLogs.filter(l => l.status === 'verified').length / members.filter(m => m.status === 'active').length) * 100) 
                      : 0}%`}
                    subtitle="This cycle"
                    color="purple"
                  />
                </div>

                {/* Paid Members List */}
                <Card className="bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl rounded-[24px] border border-slate-100 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none">
                  <CardHeader>
                    <CardTitle className="text-lg text-slate-900 dark:text-white">Who Has Paid</CardTitle>
                    <CardDescription className="text-slate-500 dark:text-slate-400">
                      Members who have completed their payments this cycle
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {paymentLogs.filter(l => l.status === 'verified').length > 0 ? (
                      <div className="space-y-3">
                        {paymentLogs
                          .filter(l => l.status === 'verified')
                          .map((log) => (
                            <div key={log.id} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-500/10 rounded-xl">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                  <AvatarImage src={log.member?.profile?.avatar_url || ''} />
                                  <AvatarFallback className="bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400">
                                    {log.member?.profile?.name?.charAt(0) || '?'}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-slate-900 dark:text-white">{log.member?.profile?.name || 'Unknown'}</p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {log.verified_at && `Verified ${format(new Date(log.verified_at), 'MMM d, yyyy')}`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                                <span className="font-medium text-green-600 dark:text-green-400">${group.contribution_amount}</span>
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="text-center text-slate-500 dark:text-slate-400 py-8">No verified payments yet</p>
                    )}
                  </CardContent>
                </Card>

                {/* Payment Breakdown */}
                <Card className="bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl rounded-[24px] border border-slate-100 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none">
                  <CardHeader>
                    <CardTitle className="text-lg text-slate-900 dark:text-white">Payment Breakdown</CardTitle>
                    <CardDescription className="text-slate-500 dark:text-slate-400">
                      Current cycle payment status
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-green-500"></div>
                          <span className="text-sm text-slate-600 dark:text-slate-400">Paid</span>
                        </div>
                        <span className="font-medium text-slate-900 dark:text-white">
                          {paymentLogs.filter(l => l.status === 'verified').length} (${paymentLogs.filter(l => l.status === 'verified').length * group.contribution_amount})
                        </span>
                      </div>
                      <Progress 
                        value={members.filter(m => m.status === 'active').length > 0 
                          ? (paymentLogs.filter(l => l.status === 'verified').length / members.filter(m => m.status === 'active').length) * 100 
                          : 0} 
                        className="h-2 bg-slate-100 dark:bg-slate-700"
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                          <span className="text-sm text-slate-600 dark:text-slate-400">Pending</span>
                        </div>
                        <span className="font-medium text-slate-900 dark:text-white">
                          {paymentLogs.filter(l => l.status === 'pending').length} (${paymentLogs.filter(l => l.status === 'pending').length * group.contribution_amount})
                        </span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-500"></div>
                          <span className="text-sm text-slate-600 dark:text-slate-400">Unpaid</span>
                        </div>
                        <span className="font-medium text-slate-900 dark:text-white">
                          {paymentLogs.filter(l => l.status === 'unpaid' || l.status === 'rejected').length} (${paymentLogs.filter(l => l.status === 'unpaid' || l.status === 'rejected').length * group.contribution_amount})
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Export CSV Button */}
                <Card className="bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl rounded-[24px] border border-slate-100 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">Export Data</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Download payment records as CSV</p>
                      </div>
                      <Button
                        onClick={() => {
                          const csvData = paymentLogs.map(log => ({
                            name: log.member?.profile?.name || 'Unknown',
                            email: log.member?.profile?.email || '',
                            amount: group.contribution_amount,
                            status: log.status,
                            marked_at: log.marked_at ? format(new Date(log.marked_at), 'yyyy-MM-dd HH:mm') : '',
                            verified_at: log.verified_at ? format(new Date(log.verified_at), 'yyyy-MM-dd HH:mm') : ''
                          }));
                          const columns: CsvColumn<typeof csvData[0]>[] = [
                            { header: 'Name', accessor: 'name' },
                            { header: 'Email', accessor: 'email' },
                            { header: 'Amount', accessor: 'amount' },
                            { header: 'Status', accessor: 'status' },
                            { header: 'Submitted', accessor: 'marked_at' },
                            { header: 'Verified', accessor: 'verified_at' }
                          ];
                          exportToCsv(csvData, columns, `${group.name}-payments-${format(new Date(), 'yyyy-MM-dd')}`);
                          toast({ title: 'CSV Downloaded', description: 'Payment records exported successfully.' });
                        }}
                        className="bg-green-500 hover:bg-green-600 dark:bg-amber-500 dark:hover:bg-amber-600 dark:shadow-[0_0_20px_rgba(245,158,11,0.25)] text-white rounded-xl transition-all duration-300"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Export CSV
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <motion.div
                key="notifications"
                variants={contentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="space-y-6"
              >
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Notifications</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Reminders and group activity</p>
                </div>

                {/* Activity Feed */}
                <Card className="bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl rounded-[24px] border border-slate-100 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none">
                  <CardHeader>
                    <CardTitle className="text-lg text-slate-900 dark:text-white">Recent Activity</CardTitle>
                    <CardDescription className="text-slate-500 dark:text-slate-400">
                      All group notifications and reminders
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ActivityFeed groupId={id || ''} limit={50} showHeader={false} />
                  </CardContent>
                </Card>

                {/* Group Performance - President Only */}
                {isPresident && (
                  <Card className="bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl rounded-[24px] border border-slate-100 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Crown className="w-5 h-5 text-amber-500" />
                        <CardTitle className="text-lg text-slate-900 dark:text-white">Group Performance</CardTitle>
                      </div>
                      <CardDescription className="text-slate-500 dark:text-slate-400">
                        Payment behavior insights (President only)
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                          <p className="text-sm text-slate-500 dark:text-slate-400">On-Time Rate</p>
                          <p className="text-2xl font-bold text-slate-900 dark:text-white">
                            {allCycles.length > 0 
                              ? `${Math.round((allCycles.filter(c => c.status === 'closed').length / allCycles.length) * 100)}%`
                              : 'N/A'
                            }
                          </p>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                          <p className="text-sm text-slate-500 dark:text-slate-400">Total Collected</p>
                          <p className="text-2xl font-bold text-slate-900 dark:text-white">
                            ${allCycles.filter(c => c.status === 'closed').length * group.contribution_amount * members.filter(m => m.status === 'active').length}
                          </p>
                        </div>
                      </div>
                      
                      {/* Members needing reminders */}
                      {paymentLogs.filter(l => l.status === 'unpaid' || l.status === 'rejected').length > 0 && (
                        <div className="p-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl">
                          <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">
                            Members Needing Reminder ({paymentLogs.filter(l => l.status === 'unpaid' || l.status === 'rejected').length})
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {paymentLogs
                              .filter(l => l.status === 'unpaid' || l.status === 'rejected')
                              .map(log => (
                                <Badge key={log.id} variant="outline" className="bg-white dark:bg-slate-800">
                                  {log.member?.profile?.name || 'Unknown'}
                                </Badge>
                              ))
                            }
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                variants={contentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="space-y-6"
              >
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Settings</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Group configuration and preferences</p>
                </div>

                {/* Group Profile Section */}
                <Card className="bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl rounded-[24px] border border-slate-100 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none">
                  <CardHeader>
                    <CardTitle className="text-lg text-slate-900 dark:text-white">Group Profile</CardTitle>
                    <CardDescription className="text-slate-500 dark:text-slate-400">
                      {isPresident ? 'Manage group photo and information' : 'View group information'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Group Photo */}
                    <div className="flex items-center gap-6">
                      <div className="relative group">
                        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center overflow-hidden border-2 border-slate-100 dark:border-white/10">
                          {group.photo_url ? (
                            <img 
                              src={group.photo_url} 
                              alt={group.name} 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Users className="w-10 h-10 text-primary/60" />
                          )}
                        </div>
                        {isPresident && (
                          <div className="absolute inset-0 bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <label className="cursor-pointer p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors">
                              <Camera className="w-4 h-4 text-white" strokeWidth={1.5} />
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    try {
                                      await uploadGroupPhoto(group.id, file);
                                      toast.success('Group photo updated');
                                      refetch();
                                    } catch (error) {
                                      toast.error('Failed to upload photo');
                                    }
                                  }
                                }}
                              />
                            </label>
                            {group.photo_url && (
                              <button 
                                className="p-2 bg-white/20 rounded-full hover:bg-red-500/50 transition-colors"
                                onClick={async () => {
                                  try {
                                    await deleteGroupPhoto(group.id, group.photo_url!);
                                    toast.success('Group photo removed');
                                    refetch();
                                  } catch (error) {
                                    toast.error('Failed to remove photo');
                                  }
                                }}
                              >
                                <X className="w-4 h-4 text-white" strokeWidth={1.5} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{group.name}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {members.filter(m => m.status === 'active').length} active members
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          ${group.contribution_amount} contribution · {group.cycle_frequency}
                        </p>
                      </div>
                    </div>

                    {/* Group Info */}
                    <div className="grid gap-4">
                      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Invite Code</p>
                        <div className="flex items-center gap-2">
                          <code className="text-lg font-mono font-semibold text-slate-900 dark:text-white">{group.invite_code}</code>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 px-2"
                            onClick={() => {
                              navigator.clipboard.writeText(group.invite_code);
                              toast.success('Invite code copied!');
                            }}
                          >
                            <Copy className="w-4 h-4" strokeWidth={1.5} />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">President</p>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {members.find(m => m.role === 'president')?.profile?.name || 'Unknown'}
                          </p>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Created</p>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {format(new Date(group.created_at), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Appearance Section */}
                <Card className="bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl rounded-[24px] border border-slate-100 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none">
                  <CardHeader>
                    <CardTitle className="text-lg text-slate-900 dark:text-white">Appearance</CardTitle>
                    <CardDescription className="text-slate-500 dark:text-slate-400">
                      Customize your theme preference
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">Theme</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Select your preferred appearance</p>
                      </div>
                      <ThemeToggle />
                    </div>
                  </CardContent>
                </Card>

                {/* Danger Zone */}
                <Card className="bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl rounded-[24px] border border-red-200 dark:border-red-500/20 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none">
                  <CardHeader>
                    <CardTitle className="text-lg text-red-600 dark:text-red-400">Danger Zone</CardTitle>
                    <CardDescription className="text-slate-500 dark:text-slate-400">
                      Irreversible actions for your group membership
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Leave Group */}
                    <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-500/10 rounded-xl">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">Leave Group</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {isPresident 
                            ? 'Transfer presidency before leaving'
                            : 'You will lose access to this group'
                          }
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10 rounded-xl"
                        disabled={isPresident}
                        onClick={() => {
                          if (confirm('Are you sure you want to leave this group? This action cannot be undone.')) {
                            // TODO: Implement leave group logic
                            toast.error('Leave group not implemented yet');
                          }
                        }}
                      >
                        <LogOut className="w-4 h-4 mr-2" strokeWidth={1.5} />
                        Leave
                      </Button>
                    </div>

                    {/* Delete Group - President Only */}
                    {isPresident && (
                      <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-500/10 rounded-xl">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">Delete Group</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            Permanently delete this group and all data
                          </p>
                        </div>
                        <Button 
                          variant="destructive" 
                          className="rounded-xl"
                          onClick={() => {
                            if (confirm('Are you sure you want to DELETE this group? All members will be removed and all data will be lost. This action CANNOT be undone.')) {
                              // TODO: Implement delete group logic
                              toast.error('Delete group not implemented yet');
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" strokeWidth={1.5} />
                          Delete Group
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Right Sidebar - Activity Feed - 320px */}
      <aside className="w-[320px] bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl border-l border-slate-100 dark:border-white/5 flex flex-col">
        <div className="p-6 border-b border-slate-100 dark:border-white/5">
          <h3 className="font-semibold text-slate-900 dark:text-white">Activity</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Recent group activity</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <ActivityFeed groupId={id || ''} limit={20} showHeader={false} />
        </div>
      </aside>

      {/* Start Cycle Dialog */}
      <Dialog open={cycleDialogOpen} onOpenChange={setCycleDialogOpen}>
        <DialogContent className="rounded-[24px] dark:bg-slate-900/90 dark:backdrop-blur-xl dark:border-white/10">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Start New Payment Cycle</DialogTitle>
            <DialogDescription className="dark:text-slate-400">
              Set the start and end dates for this payment cycle.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal rounded-xl">
                    <Calendar className="mr-2 h-4 w-4" />
                    {selectedStartDate ? format(selectedStartDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={selectedStartDate}
                    onSelect={setSelectedStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Due Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal rounded-xl">
                    <Calendar className="mr-2 h-4 w-4" />
                    {selectedDueDate ? format(selectedDueDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={selectedDueDate}
                    onSelect={setSelectedDueDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCycleDialogOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button 
              onClick={startNewCycle} 
              disabled={startingCycle || !selectedStartDate || !selectedDueDate}
              className="bg-green-500 hover:bg-green-600 text-white rounded-xl dark:bg-amber-500 dark:hover:bg-amber-600 dark:shadow-[0_0_20px_rgba(245,158,11,0.25)] transition-all duration-300"
            >
              {startingCycle ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Start Cycle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
