import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Users, Copy, Check, Calendar, DollarSign, 
  Crown, AlertCircle, CheckCircle, Clock, XCircle, Loader2,
  UserPlus, Settings, Shield, User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
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

  const isPresident = group?.president_id === user?.id;

  useEffect(() => {
    if (id) {
      fetchGroupData();
    }
  }, [id]);

  const fetchGroupData = async () => {
    try {
      // Fetch group
      console.log('Fetching group with id:', id);
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', id)
        .single();

      if (groupError) {
        console.error('Error fetching group:', groupError);
        throw groupError;
      }
      console.log('Group fetched successfully:', groupData);
      setGroup(groupData);

      // Fetch members
      console.log('Fetching members for group:', id);
      const { data: membersData, error: membersError } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', id)
        .order('queue_position');

      if (membersError) {
        console.error('Error fetching members:', membersError);
        throw membersError;
      }
      console.log('Members fetched:', membersData);

      // Fetch profiles for all members
      if (membersData && membersData.length > 0) {
        const userIds = membersData.map(m => m.user_id);
        console.log('Fetching profiles for users:', userIds);
        
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds);

        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
        }
        console.log('Profiles fetched:', profilesData);

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
      console.log('Fetching active cycle for group:', id);
      const { data: cycleData, error: cycleError } = await supabase
        .from('payment_cycles')
        .select('*')
        .eq('group_id', id)
        .eq('status', 'active')
        .maybeSingle();

      if (cycleError) {
        console.error('Error fetching cycle:', cycleError);
      }
      console.log('Cycle data:', cycleData);
      setActiveCycle(cycleData);

      // Fetch payment logs for active cycle
      if (cycleData) {
        console.log('Fetching payment logs for cycle:', cycleData.id);
        const { data: logsData, error: logsError } = await supabase
          .from('payment_logs')
          .select('*')
          .eq('cycle_id', cycleData.id);

        if (logsError) {
          console.error('Error fetching payment logs:', logsError);
        }
        console.log('Payment logs:', logsData);

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
      }
    } catch (error) {
      console.error('Error fetching group:', error);
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

  const verifyPayment = async (logId: string) => {
    try {
      const { error } = await supabase
        .from('payment_logs')
        .update({ status: 'verified', verified_at: new Date().toISOString() })
        .eq('id', logId);

      if (error) throw error;
      
      toast({ title: "Payment verified!" });
      fetchGroupData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const rejectPayment = async (logId: string) => {
    try {
      const { error } = await supabase
        .from('payment_logs')
        .update({ status: 'rejected' })
        .eq('id', logId);

      if (error) throw error;
      
      toast({ title: "Payment rejected" });
      fetchGroupData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
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
          {isPresident && (
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          )}
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
                    <p className="text-2xl font-bold">${(members.length * group.contribution_amount).toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">Per Cycle</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{activeCycle ? 'Active' : 'None'}</p>
                    <p className="text-sm text-muted-foreground">Current Cycle</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

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
                    {members.map((member) => (
                      <div key={member.id} className="py-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                            {member.queue_position}
                          </div>
                          <div>
                            <p className="font-medium flex items-center gap-2">
                              {member.profile?.name || member.profile?.email}
                            </p>
                            <p className="text-sm text-muted-foreground">{member.profile?.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {getRoleBadge(member.role)}
                          {member.missed_payment_count > 0 && (
                            <Badge variant="outline" className="text-warning border-warning/20">
                              {member.missed_payment_count} missed
                            </Badge>
                          )}
                          {getStatusBadge(member.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="payments" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Payment Status</CardTitle>
                  <CardDescription>
                    {activeCycle 
                      ? `Current cycle due: ${new Date(activeCycle.due_date).toLocaleDateString()}`
                      : 'No active payment cycle'
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!activeCycle ? (
                    <div className="text-center py-8">
                      <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground mb-4">No active payment cycle</p>
                      {isPresident && (
                        <Button>
                          <Calendar className="mr-2 h-4 w-4" />
                          Start New Cycle
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {paymentLogs.map((log) => (
                        <div key={log.id} className="py-4 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                              {log.member?.queue_position}
                            </div>
                            <div>
                              <p className="font-medium">
                                {log.member?.profile?.name || log.member?.profile?.email}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                ${group.contribution_amount}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {getPaymentStatusBadge(log.status)}
                            {isPresident && log.status === 'pending' && (
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="text-primary"
                                  onClick={() => verifyPayment(log.id)}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="text-destructive"
                                  onClick={() => rejectPayment(log.id)}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
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
