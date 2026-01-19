import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, AlertTriangle } from 'lucide-react';

interface MemberPerformanceProps {
  groupId: string;
}

interface MemberStats {
  memberId: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  queuePosition: number;
  totalPayments: number;
  verifiedPayments: number;
  pendingPayments: number;
  missedPayments: number;
  paymentRate: number;
}

const MemberPerformance = ({ groupId }: MemberPerformanceProps) => {
  const [memberStats, setMemberStats] = useState<MemberStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMemberStats = async () => {
      setLoading(true);
      try {
        // Fetch all members with profiles
        const { data: members } = await supabase
          .from('group_members')
          .select('id, user_id, role, status, queue_position, missed_payment_count')
          .eq('group_id', groupId)
          .order('queue_position');

        if (!members) return;

        // Fetch profiles for all members
        const userIds = members.map(m => m.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        // Fetch all cycles
        const { data: cycles } = await supabase
          .from('payment_cycles')
          .select('id')
          .eq('group_id', groupId);

        const cycleIds = cycles?.map(c => c.id) || [];

        // Fetch all payment logs
        let allLogs: any[] = [];
        if (cycleIds.length > 0) {
          const { data: logs } = await supabase
            .from('payment_logs')
            .select('member_id, status')
            .in('cycle_id', cycleIds);
          allLogs = logs || [];
        }

        // Group logs by member
        const logsByMember = new Map<string, any[]>();
        allLogs.forEach(log => {
          const existing = logsByMember.get(log.member_id) || [];
          existing.push(log);
          logsByMember.set(log.member_id, existing);
        });

        // Build stats for each member
        const stats: MemberStats[] = members.map(member => {
          const profile = profileMap.get(member.user_id);
          const logs = logsByMember.get(member.id) || [];
          
          const verifiedCount = logs.filter(l => l.status === 'verified').length;
          const pendingCount = logs.filter(l => l.status === 'pending').length;
          const missedCount = logs.filter(l => l.status === 'unpaid' || l.status === 'rejected').length;
          const totalCount = logs.length;
          
          return {
            memberId: member.id,
            userId: member.user_id,
            name: profile?.name || 'Unknown',
            email: profile?.email || '',
            role: member.role,
            status: member.status,
            queuePosition: member.queue_position,
            totalPayments: totalCount,
            verifiedPayments: verifiedCount,
            pendingPayments: pendingCount,
            missedPayments: missedCount,
            paymentRate: totalCount > 0 ? Math.round((verifiedCount / totalCount) * 100) : 0,
          };
        });

        setMemberStats(stats);
      } catch (error) {
        console.error('Error fetching member stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMemberStats();
  }, [groupId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const getRoleBadge = (role: string) => {
    if (role === 'president') {
      return <Badge className="bg-yellow-500 hover:bg-yellow-600">President</Badge>;
    }
    if (role === 'vice_president') {
      return <Badge className="bg-blue-500 hover:bg-blue-600">Vice President</Badge>;
    }
    return null;
  };

  const getStatusBadge = (status: string) => {
    if (status === 'locked') {
      return <Badge variant="destructive">Locked</Badge>;
    }
    if (status === 'pending') {
      return <Badge variant="secondary">Pending</Badge>;
    }
    return <Badge variant="outline">Active</Badge>;
  };

  // Chart data - top 10 members by payment rate
  const chartData = memberStats
    .filter(m => m.totalPayments > 0)
    .sort((a, b) => b.paymentRate - a.paymentRate)
    .slice(0, 10)
    .map(m => ({
      name: m.name.split(' ')[0] || m.email.split('@')[0],
      rate: m.paymentRate,
    }));

  // Members with issues (missed payments)
  const membersWithIssues = memberStats.filter(m => m.missedPayments > 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{memberStats.length}</div>
            <p className="text-xs text-muted-foreground">
              {memberStats.filter(m => m.status === 'active').length} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Payment Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {memberStats.length > 0
                ? Math.round(memberStats.reduce((sum, m) => sum + m.paymentRate, 0) / memberStats.length)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">Across all members</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Members with Issues</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{membersWithIssues.length}</div>
            <p className="text-xs text-muted-foreground">Have missed payments</p>
          </CardContent>
        </Card>
      </div>

      {/* Payment Rate Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Member Payment Rates</CardTitle>
            <CardDescription>Verified payment percentage by member</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" domain={[0, 100]} unit="%" />
                  <YAxis type="category" dataKey="name" width={80} />
                  <Tooltip formatter={(value: number) => [`${value}%`, 'Payment Rate']} />
                  <Bar 
                    dataKey="rate" 
                    fill="hsl(var(--primary))" 
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Member Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Members</CardTitle>
          <CardDescription>Detailed payment performance for each member</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Position</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Verified</TableHead>
                  <TableHead className="text-center">Pending</TableHead>
                  <TableHead className="text-center">Missed</TableHead>
                  <TableHead>Payment Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberStats.map((member) => (
                  <TableRow key={member.memberId}>
                    <TableCell className="font-medium">#{member.queuePosition}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{getRoleBadge(member.role)}</TableCell>
                    <TableCell>{getStatusBadge(member.status)}</TableCell>
                    <TableCell className="text-center">
                      <span className="text-green-600 font-medium">{member.verifiedPayments}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-yellow-600 font-medium">{member.pendingPayments}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={member.missedPayments > 0 ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                        {member.missedPayments}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={member.paymentRate} className="w-16 h-2" />
                        <span className="text-sm font-medium">{member.paymentRate}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MemberPerformance;
