import { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationCenter from '@/components/NotificationCenter';
import { GroupSwitcher } from '@/components/GroupSwitcher';
import { ResponsibilityHeader } from '@/components/ResponsibilityHeader';
import { ActivityFeed } from '@/components/ActivityFeed';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { StatusDot } from '@/components/ui/status-dot';
import { RoleBadge } from '@/components/ui/role-badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Users, 
  Plus, 
  LogOut, 
  DollarSign, 
  Calendar, 
  ChevronRight,
  User,
  UserPlus,
  Archive,
  RotateCcw,
  Trash2,
  ChevronDown,
  ChevronUp,
  PiggyBank,
  Clock,
  Bell,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow, differenceInDays } from 'date-fns';
import type { Group, MemberRole, PaymentStatus } from '@/types/database';
import { cn } from '@/lib/utils';
import { sendBulkReminders } from '@/lib/activity';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface GroupWithStatus extends Group {
  memberRole: MemberRole;
  cycleStatus?: {
    hasCycle: boolean;
    cycleId?: string;
    dueDate?: Date;
    daysUntilDue?: number;
    paidCount: number;
    pendingCount: number;
    unpaidCount: number;
    totalMembers: number;
    myPaymentStatus?: PaymentStatus;
  };
}

interface MemberBehind {
  name: string;
  status: 'pending' | 'unpaid' | 'late';
  daysBehind?: number;
}

export default function DashboardPage() {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<GroupWithStatus[]>([]);
  const [archivedGroups, setArchivedGroups] = useState<Group[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sendingReminders, setSendingReminders] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchGroupsWithStatus();
    }
  }, [user]);

  const fetchGroupsWithStatus = async () => {
    try {
      // Fetch user's memberships with group data
      const { data: memberships, error: memberError } = await supabase
        .from('group_members')
        .select(`
          role,
          group_id,
          groups!inner(*)
        `)
        .eq('user_id', user!.id);

      if (memberError) throw memberError;

      // Also fetch groups where user is president (in case not in group_members)
      const { data: presidentGroups, error: presidentError } = await supabase
        .from('groups')
        .select('*')
        .eq('president_id', user!.id);

      if (presidentError) throw presidentError;

      // Combine and deduplicate
      const groupsFromMemberships = memberships?.map(m => ({
        ...(m.groups as unknown as Group),
        memberRole: m.role as MemberRole,
      })) || [];

      const presidentGroupsWithRole = presidentGroups?.map(g => ({
        ...g,
        memberRole: 'president' as MemberRole,
      })) || [];

      const allGroups = [...groupsFromMemberships, ...presidentGroupsWithRole];
      const uniqueGroups = Array.from(
        new Map(allGroups.map((g) => [g.id, g])).values()
      ) as GroupWithStatus[];

      // Separate active and archived
      const active = uniqueGroups.filter(g => !g.archived_at);
      const archived = uniqueGroups.filter(g => g.archived_at) as Group[];

      // Fetch cycle status for each active group
      const groupsWithStatus = await Promise.all(
        active.map(async (group) => {
          const cycleStatus = await fetchGroupCycleStatus(group.id, user!.id);
          return { ...group, cycleStatus };
        })
      );

      setGroups(groupsWithStatus);
      setArchivedGroups(archived);
    } catch (error: any) {
      console.error('Error fetching groups:', error);
      if (error.code === '42P01') {
        setGroups([]);
      } else {
        toast.error('Failed to load groups');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupCycleStatus = async (groupId: string, userId: string) => {
    try {
      // Get active cycle
      const { data: cycle } = await supabase
        .from('payment_cycles')
        .select('*')
        .eq('group_id', groupId)
        .eq('status', 'active')
        .maybeSingle();

      if (!cycle) {
        return {
          hasCycle: false,
          paidCount: 0,
          pendingCount: 0,
          unpaidCount: 0,
          totalMembers: 0,
        };
      }

      // Get payment logs for this cycle
      const { data: logs } = await supabase
        .from('payment_logs')
        .select(`
          status,
          member_id,
          group_members!inner(user_id)
        `)
        .eq('cycle_id', cycle.id);

      const paidCount = logs?.filter(l => l.status === 'verified').length || 0;
      const pendingCount = logs?.filter(l => l.status === 'pending').length || 0;
      const unpaidCount = logs?.filter(l => l.status === 'unpaid' || l.status === 'rejected').length || 0;
      const totalMembers = logs?.length || 0;

      // Find user's payment status
      const myLog = logs?.find(l => (l.group_members as any)?.user_id === userId);
      const myPaymentStatus = myLog?.status as PaymentStatus | undefined;

      const dueDate = new Date(cycle.due_date);
      const daysUntilDue = differenceInDays(dueDate, new Date());

      return {
        hasCycle: true,
        cycleId: cycle.id,
        dueDate,
        daysUntilDue,
        paidCount,
        pendingCount,
        unpaidCount,
        totalMembers,
        myPaymentStatus,
      };
    } catch (error) {
      console.error('Error fetching cycle status:', error);
      return {
        hasCycle: false,
        paidCount: 0,
        pendingCount: 0,
        unpaidCount: 0,
        totalMembers: 0,
      };
    }
  };

  // Calculate aggregated stats across all groups
  const aggregatedStats = useMemo(() => {
    let totalUnpaid = 0;
    let totalPending = 0;
    let nearestDueDate: Date | null = null;
    let nearestDueGroup: string | null = null;
    let nearestDaysUntilDue: number | undefined;

    groups.forEach(group => {
      if (group.cycleStatus?.hasCycle) {
        totalUnpaid += group.cycleStatus.unpaidCount;
        totalPending += group.cycleStatus.pendingCount;

        if (group.cycleStatus.dueDate) {
          if (!nearestDueDate || group.cycleStatus.dueDate < nearestDueDate) {
            nearestDueDate = group.cycleStatus.dueDate;
            nearestDueGroup = group.name;
            nearestDaysUntilDue = group.cycleStatus.daysUntilDue;
          }
        }
      }
    });

    return {
      totalUnpaid,
      totalPending,
      nearestDueDate,
      nearestDueGroup,
      nearestDaysUntilDue,
    };
  }, [groups]);

  // Determine primary role (highest role across all groups)
  const primaryRole = useMemo(() => {
    if (groups.some(g => g.memberRole === 'president')) return 'president';
    if (groups.some(g => g.memberRole === 'vice_president')) return 'vice_president';
    return 'member';
  }, [groups]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleSendReminders = async (group: GroupWithStatus) => {
    if (!group.cycleStatus?.cycleId || !user) return;

    setSendingReminders(group.id);
    try {
      const userName = user.user_metadata?.name || user.email?.split('@')[0] || 'President';
      const result = await sendBulkReminders(
        group.id,
        group.cycleStatus.cycleId,
        user.id,
        userName,
        group.name,
        group.contribution_amount
      );

      if (result.success) {
        if (result.remindedCount > 0) {
          toast.success(`Sent reminders to ${result.remindedCount} member(s)`);
        }
        if (result.skippedCount > 0) {
          toast.info(`${result.skippedCount} member(s) already reminded recently`);
        }
        if (result.remindedCount === 0 && result.skippedCount === 0) {
          toast.info('No unpaid members to remind');
        }
      } else {
        toast.error(result.error || 'Failed to send reminders');
      }
    } catch (error) {
      toast.error('Failed to send reminders');
    } finally {
      setSendingReminders(null);
    }
  };

  const handleRestoreGroup = async (groupId: string) => {
    try {
      const { error } = await supabase
        .from('groups')
        .update({ archived_at: null, updated_at: new Date().toISOString() })
        .eq('id', groupId);

      if (error) throw error;

      toast.success('Group restored successfully');
      fetchGroupsWithStatus();
    } catch (error) {
      console.error('Error restoring group:', error);
      toast.error('Failed to restore group');
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      const { data: cycles } = await supabase
        .from('payment_cycles')
        .select('id')
        .eq('group_id', groupId);

      const cycleIds = cycles?.map(c => c.id) || [];

      if (cycleIds.length > 0) {
        await supabase
          .from('payment_logs')
          .delete()
          .in('cycle_id', cycleIds);
      }

      await supabase
        .from('payment_cycles')
        .delete()
        .eq('group_id', groupId);

      await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId);

      const { error } = await supabase
        .from('groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;

      toast.success('Group permanently deleted');
      fetchGroupsWithStatus();
    } catch (error) {
      console.error('Error deleting group:', error);
      toast.error('Failed to delete group');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const userName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
  const userInitials = userName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Get the primary group (first one with active cycle, or first one)
  const primaryGroup = groups.find(g => g.cycleStatus?.hasCycle) || groups[0];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
                <PiggyBank className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground hidden sm:inline">ConLify</span>
            </Link>
            
            {/* Group Switcher */}
            {groups.length > 0 && (
              <GroupSwitcher
                groups={groups}
                currentGroupId={primaryGroup?.id}
                userId={user?.id || ''}
              />
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <NotificationCenter />
            <ThemeToggle />
            
            {/* Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full ring-2 ring-border hover:ring-primary/50 transition-all">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{userName}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Profile Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/groups/join" className="cursor-pointer">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Join a Group
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <DashboardSkeleton />
        ) : groups.length === 0 ? (
          <div className="space-y-6">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-foreground">
                Welcome, {userName}!
              </h2>
              <p className="text-muted-foreground mt-1">
                Get started by creating or joining a savings group.
              </p>
            </div>
            <EmptyState
              type="groups"
              title="No groups yet"
              description="Create a savings group or ask a friend for their invite code to join one."
              action={{
                label: 'Create Your First Group',
                onClick: () => navigate('/groups/create')
              }}
              className="card-elevated"
            />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Responsibility Header */}
            <ResponsibilityHeader
              userName={userName}
              role={primaryRole}
              hasCycle={aggregatedStats.nearestDueDate !== null}
              unpaidCount={aggregatedStats.totalUnpaid}
              pendingCount={aggregatedStats.totalPending}
              daysUntilDue={aggregatedStats.nearestDaysUntilDue}
              cycleDueDate={aggregatedStats.nearestDueDate ? format(aggregatedStats.nearestDueDate, 'MMM d') : undefined}
              personalStatus={primaryGroup?.cycleStatus?.myPaymentStatus === 'verified' ? 'paid' : 
                             primaryGroup?.cycleStatus?.myPaymentStatus === 'pending' ? 'pending' : 'unpaid'}
            />

            {/* Main Content Grid */}
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Left Column: Groups & Status */}
              <div className="lg:col-span-2 space-y-6">
                {/* Group Cards with Cycle Status */}
                {groups.map((group) => (
                  <GroupStatusCard
                    key={group.id}
                    group={group}
                    userId={user?.id || ''}
                    onSendReminders={() => handleSendReminders(group)}
                    sendingReminders={sendingReminders === group.id}
                  />
                ))}

                {/* Quick Actions */}
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => navigate('/groups/join')} className="flex-1">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Join a Group
                  </Button>
                  <Button onClick={() => navigate('/groups/create')} className="flex-1">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Group
                  </Button>
                </div>
              </div>

              {/* Right Column: Activity Feed */}
              <div className="space-y-6">
                {primaryGroup && (
                  <ActivityFeed 
                    groupId={primaryGroup.id} 
                    limit={8}
                    maxHeight="400px"
                  />
                )}
              </div>
            </div>

            {/* Archived Groups */}
            {archivedGroups.length > 0 && (
              <div className="pt-4">
                <button
                  onClick={() => setShowArchived(!showArchived)}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors group"
                >
                  <div className="p-1.5 rounded-lg bg-muted group-hover:bg-muted/80 transition-colors">
                    <Archive className="h-4 w-4" />
                  </div>
                  <span className="font-medium">Archived Groups</span>
                  <Badge variant="secondary" className="ml-1">{archivedGroups.length}</Badge>
                  {showArchived ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {showArchived && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {archivedGroups.map((group) => (
                      <Card key={group.id} className="border-dashed opacity-75 hover:opacity-100 transition-opacity">
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-base text-muted-foreground">{group.name}</CardTitle>
                              <CardDescription className="capitalize text-xs">
                                {group.frequency} • ${group.contribution_amount}
                              </CardDescription>
                            </div>
                            <Archive className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <p className="text-xs text-muted-foreground mb-3">
                            Archived {formatDistanceToNow(new Date(group.archived_at!), { addSuffix: true })}
                          </p>
                          
                          {group.president_id === user?.id && (
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRestoreGroup(group.id)}
                                className="flex-1 h-8"
                              >
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Restore
                              </Button>
                              
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="sm" className="flex-1 h-8">
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Delete
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete "{group.name}"?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This cannot be undone. All members, payment cycles, and history will be permanently deleted.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteGroup(group.id)}
                                      className="bg-destructive hover:bg-destructive/90"
                                    >
                                      Delete Forever
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// Group Status Card - Shows people-first status
function GroupStatusCard({
  group,
  userId,
  onSendReminders,
  sendingReminders,
}: {
  group: GroupWithStatus;
  userId: string;
  onSendReminders: () => void;
  sendingReminders: boolean;
}) {
  const navigate = useNavigate();
  const isPresident = group.memberRole === 'president' || group.memberRole === 'vice_president';
  const cycle = group.cycleStatus;
  const hasUnpaid = (cycle?.unpaidCount || 0) > 0;
  const hasPending = (cycle?.pendingCount || 0) > 0;
  const needsAttention = isPresident && (hasUnpaid || hasPending);

  const progressPercentage = cycle?.totalMembers 
    ? Math.round((cycle.paidCount / cycle.totalMembers) * 100) 
    : 0;

  return (
    <Card className={cn(
      'card-elevated overflow-hidden transition-all hover:shadow-soft-lg',
      needsAttention && 'border-amber-500/30'
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 ring-2 ring-primary/10">
              <AvatarImage src={group.photo_url || undefined} alt={group.name} />
              <AvatarFallback className="bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                {group.name}
                <RoleBadge role={group.memberRole} size="sm" />
              </CardTitle>
              <CardDescription className="flex items-center gap-2 mt-0.5">
                <span>${group.contribution_amount} {group.frequency}</span>
                {cycle?.dueDate && (
                  <>
                    <span className="text-muted-foreground/50">•</span>
                    <span className={cn(
                      cycle.daysUntilDue !== undefined && cycle.daysUntilDue < 0 && 'text-red-600',
                      cycle.daysUntilDue !== undefined && cycle.daysUntilDue <= 3 && cycle.daysUntilDue >= 0 && 'text-amber-600'
                    )}>
                      {cycle.daysUntilDue === undefined ? '' :
                       cycle.daysUntilDue < 0 ? `Overdue ${Math.abs(cycle.daysUntilDue)}d` :
                       cycle.daysUntilDue === 0 ? 'Due today' :
                       `Due in ${cycle.daysUntilDue}d`}
                    </span>
                  </>
                )}
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/groups/${group.id}`)}
            className="rounded-xl"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {cycle?.hasCycle ? (
          <>
            {/* Payment Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {cycle.paidCount} of {cycle.totalMembers} members paid
                </span>
                <span className="font-medium">{progressPercentage}%</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>

            {/* Status Summary */}
            <div className="flex flex-wrap gap-3 text-sm">
              <div className="flex items-center gap-1.5">
                <StatusDot status="paid" size="sm" />
                <span className="text-muted-foreground">{cycle.paidCount} paid</span>
              </div>
              {cycle.pendingCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <StatusDot status="pending" size="sm" />
                  <span className="text-muted-foreground">{cycle.pendingCount} pending</span>
                </div>
              )}
              {cycle.unpaidCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <StatusDot status="unpaid" size="sm" />
                  <span className="text-muted-foreground">{cycle.unpaidCount} unpaid</span>
                </div>
              )}
            </div>

            {/* President Actions */}
            {isPresident && hasUnpaid && (
              <div className="pt-2 border-t border-border/50">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSendReminders}
                  disabled={sendingReminders}
                  className="w-full"
                >
                  <Bell className="h-4 w-4 mr-2" />
                  {sendingReminders ? 'Sending...' : 'Remind unpaid members'}
                </Button>
              </div>
            )}

            {/* Member View: Personal Status */}
            {!isPresident && cycle.myPaymentStatus && (
              <div className="pt-2 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusDot 
                      status={cycle.myPaymentStatus === 'verified' ? 'paid' : 
                              cycle.myPaymentStatus === 'pending' ? 'pending' : 'unpaid'} 
                    />
                    <span className="text-sm">
                      {cycle.myPaymentStatus === 'verified' ? 'Your payment is verified' :
                       cycle.myPaymentStatus === 'pending' ? 'Awaiting verification' :
                       'Payment due'}
                    </span>
                  </div>
                  {cycle.myPaymentStatus !== 'verified' && (
                    <Button
                      size="sm"
                      onClick={() => navigate(`/groups/${group.id}/invoice/${cycle.cycleId}`)}
                    >
                      <DollarSign className="h-4 w-4 mr-1" />
                      Pay Now
                    </Button>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No active payment cycle</p>
            {isPresident && (
              <Button
                variant="link"
                size="sm"
                onClick={() => navigate(`/groups/${group.id}`)}
                className="mt-1"
              >
                Start a cycle →
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Loading skeleton
function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
        <div>
          <Skeleton className="h-80 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
