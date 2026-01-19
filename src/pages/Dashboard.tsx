import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationCenter from '@/components/NotificationCenter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StatCard, StatCardGrid } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
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
  TrendingUp,
  Clock,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import type { Group } from '@/types/database';
import { cn } from '@/lib/utils';
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

interface DashboardStats {
  totalContributions: number;
  nextPaymentDue: Date | null;
  nextPaymentGroup: string | null;
}

export default function DashboardPage() {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [archivedGroups, setArchivedGroups] = useState<Group[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalContributions: 0,
    nextPaymentDue: null,
    nextPaymentGroup: null,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchGroups();
    }
  }, [user]);

  const fetchGroups = async () => {
    try {
      // Fetch groups where user is president
      const { data: presidentGroups, error: presidentError } = await supabase
        .from('groups')
        .select('*')
        .eq('president_id', user!.id);

      if (presidentError) throw presidentError;

      // Fetch groups where user is a member
      const { data: memberData, error: memberError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user!.id);

      if (memberError) throw memberError;

      const memberGroupIds = memberData?.map((m) => m.group_id) || [];

      let memberGroups: Group[] = [];
      if (memberGroupIds.length > 0) {
        const { data, error } = await supabase
          .from('groups')
          .select('*')
          .in('id', memberGroupIds);

        if (error) throw error;
        memberGroups = data || [];
      }

      // Combine and deduplicate
      const allGroups = [...(presidentGroups || []), ...memberGroups];
      const uniqueGroups = Array.from(new Map(allGroups.map((g) => [g.id, g])).values()) as Group[];
      
      // Separate active and archived groups
      const active = uniqueGroups.filter(g => !g.archived_at);
      const archived = uniqueGroups.filter(g => g.archived_at);
      
      setGroups(active);
      setArchivedGroups(archived);

      // Calculate dashboard stats (only for active groups)
      await calculateStats(uniqueGroups as Group[]);
    } catch (error: any) {
      console.error('Error fetching groups:', error);
      // If tables don't exist yet, show empty state
      if (error.code === '42P01') {
        setGroups([]);
      } else {
        toast.error('Failed to load groups');
      }
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = async (userGroups: Group[]) => {
    try {
      if (userGroups.length === 0) {
        setStats({ totalContributions: 0, nextPaymentDue: null, nextPaymentGroup: null });
        return;
      }

      const groupIds = userGroups.map(g => g.id);

      // Get all verified payment logs for user's groups
      // First, get user's member IDs
      const { data: memberData } = await supabase
        .from('group_members')
        .select('id, group_id')
        .eq('user_id', user!.id)
        .in('group_id', groupIds);

      if (memberData && memberData.length > 0) {
        const memberIds = memberData.map(m => m.id);

        // Get verified payments for this user
        const { data: verifiedPayments } = await supabase
          .from('payment_logs')
          .select('id')
          .in('member_id', memberIds)
          .eq('status', 'verified');

        // Calculate total contributions
        let totalContributions = 0;
        if (verifiedPayments) {
          // Map member_id back to group to get contribution amount
          for (const payment of verifiedPayments) {
            // For simplicity, we'll calculate based on the groups' contribution amounts
            // In a more complex setup, you'd join this properly
          }
          // For now, count verified payments and multiply by average contribution
          const avgContribution = userGroups.reduce((sum, g) => sum + g.contribution_amount, 0) / userGroups.length;
          totalContributions = verifiedPayments.length * avgContribution;
        }

        // More accurate calculation: Get payments with their cycle info
        const { data: paymentsWithCycles } = await supabase
          .from('payment_logs')
          .select('*, payment_cycles!inner(group_id)')
          .in('member_id', memberIds)
          .eq('status', 'verified');

        if (paymentsWithCycles) {
          totalContributions = 0;
          for (const payment of paymentsWithCycles) {
            const groupId = (payment.payment_cycles as any)?.group_id;
            const group = userGroups.find(g => g.id === groupId);
            if (group) {
              totalContributions += group.contribution_amount;
            }
          }
        }

        setStats(prev => ({ ...prev, totalContributions }));
      }

      // Get next payment due (active cycles for user's groups)
      const { data: activeCycles } = await supabase
        .from('payment_cycles')
        .select('*, groups!inner(name)')
        .in('group_id', groupIds)
        .eq('status', 'active')
        .order('due_date', { ascending: true })
        .limit(1);

      if (activeCycles && activeCycles.length > 0) {
        const nextCycle = activeCycles[0];
        setStats(prev => ({
          ...prev,
          nextPaymentDue: new Date(nextCycle.due_date),
          nextPaymentGroup: (nextCycle.groups as any)?.name || null,
        }));
      }
    } catch (error) {
      console.error('Error calculating stats:', error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleRestoreGroup = async (groupId: string) => {
    try {
      const { error } = await supabase
        .from('groups')
        .update({ archived_at: null, updated_at: new Date().toISOString() })
        .eq('id', groupId);

      if (error) throw error;

      toast.success('Group restored successfully');
      fetchGroups();
    } catch (error) {
      console.error('Error restoring group:', error);
      toast.error('Failed to restore group');
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      // Delete all related data first (in order due to foreign keys)
      // 1. Get all cycles for this group
      const { data: cycles } = await supabase
        .from('payment_cycles')
        .select('id')
        .eq('group_id', groupId);

      const cycleIds = cycles?.map(c => c.id) || [];

      // 2. Delete payment logs for these cycles
      if (cycleIds.length > 0) {
        await supabase
          .from('payment_logs')
          .delete()
          .in('cycle_id', cycleIds);
      }

      // 3. Delete payment cycles
      await supabase
        .from('payment_cycles')
        .delete()
        .eq('group_id', groupId);

      // 4. Delete group members
      await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId);

      // 5. Delete the group
      const { error } = await supabase
        .from('groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;

      toast.success('Group permanently deleted');
      fetchGroups();
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <PiggyBank className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">ConLify</span>
          </Link>
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
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="animate-fade-in">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Welcome back, {userName}!</h2>
                <Sparkles className="h-6 w-6 text-primary animate-pulse-soft" />
              </div>
              <p className="text-muted-foreground">Here's what's happening with your savings groups</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/groups/join')} className="shadow-soft">
                <UserPlus className="mr-2 h-4 w-4" />
                Join Group
              </Button>
              <Button onClick={() => navigate('/groups/create')} className="shadow-soft">
                <Plus className="mr-2 h-4 w-4" />
                Create Group
              </Button>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <StatCardGrid className="mb-8">
          <StatCard
            title="Active Groups"
            value={groups.length}
            icon={Users}
            variant="default"
            loading={loading}
            subtitle={groups.length === 1 ? 'savings circle' : 'savings circles'}
          />
          <StatCard
            title="Total Contributions"
            value={`$${stats.totalContributions.toLocaleString()}`}
            icon={TrendingUp}
            variant="success"
            loading={loading}
            subtitle="verified payments"
          />
          <StatCard
            title="Next Payment Due"
            value={stats.nextPaymentDue ? format(stats.nextPaymentDue, 'MMM d') : '—'}
            icon={Calendar}
            variant={stats.nextPaymentDue ? 'warning' : 'default'}
            loading={loading}
            subtitle={stats.nextPaymentGroup || 'No upcoming payments'}
          />
        </StatCardGrid>

        {/* Groups Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-semibold text-foreground">Your Groups</h3>
              <p className="text-sm text-muted-foreground">Manage and track your savings circles</p>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="card-elevated">
                  <CardHeader>
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-8 w-20" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : groups.length === 0 ? (
            <EmptyState
              type="groups"
              action={{
                label: 'Create Your First Group',
                onClick: () => navigate('/groups/create'),
                icon: Plus
              }}
              className="card-elevated"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {groups.map((group, index) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  isPresident={group.president_id === user?.id}
                  onClick={() => navigate(`/groups/${group.id}`)}
                  delay={index * 0.05}
                />
              ))}
            </div>
          )}
        </div>

        {/* Archived Groups Section */}
        {archivedGroups.length > 0 && (
          <div className="mb-8">
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {archivedGroups.map((group) => (
                  <Card key={group.id} className="border-dashed opacity-75 hover:opacity-100 transition-opacity animate-fade-in">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg text-muted-foreground">{group.name}</CardTitle>
                          <CardDescription className="capitalize">
                            {group.frequency} • ${group.contribution_amount}
                          </CardDescription>
                        </div>
                        <div className="p-2 rounded-lg bg-muted">
                          <Archive className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Archived {formatDistanceToNow(new Date(group.archived_at!), { addSuffix: true })}
                      </p>
                      
                      {group.president_id === user?.id && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRestoreGroup(group.id)}
                            className="flex-1"
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Restore
                          </Button>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm" className="flex-1">
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Permanently Delete "{group.name}"?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. This will permanently delete the group,
                                  all members, payment cycles, and payment history.
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
      </main>
    </div>
  );
}

// Group Card Component
function GroupCard({ 
  group, 
  isPresident, 
  onClick,
  delay = 0 
}: { 
  group: Group; 
  isPresident: boolean;
  onClick: () => void;
  delay?: number;
}) {
  return (
    <Card
      className={cn(
        "card-interactive cursor-pointer animate-fade-in group",
        "hover:shadow-soft-lg hover:border-primary/20"
      )}
      style={{ animationDelay: `${delay}s` }}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-3">
          <Avatar className="h-12 w-12 ring-2 ring-primary/10 flex-shrink-0">
            <AvatarImage src={group.photo_url || undefined} alt={group.name} />
            <AvatarFallback className="bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg truncate group-hover:text-primary transition-colors">
              {group.name}
            </CardTitle>
            <CardDescription className="capitalize flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {group.frequency}
              </span>
              <span className="text-muted-foreground/50">•</span>
              <span className="inline-flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                {group.contribution_amount}
              </span>
            </CardDescription>
          </div>
          <div className="p-2 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors flex-shrink-0">
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-2">
          {isPresident && (
            <Badge variant="default" className="bg-primary/10 text-primary hover:bg-primary/20 border-0">
              <Sparkles className="h-3 w-3 mr-1" />
              President
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}