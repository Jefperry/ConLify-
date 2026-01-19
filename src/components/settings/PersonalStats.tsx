import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { CheckCircle, Clock, XCircle, AlertCircle, DollarSign, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface PersonalStatsProps {
  groupId: string;
  userId: string;
}

interface PaymentHistoryItem {
  cycleId: string;
  dueDate: string;
  status: string;
  verifiedAt: string | null;
}

interface PersonalStatsData {
  totalVerifiedPayments: number;
  totalContributed: number;
  contributionAmount: number;
  paymentHistory: PaymentHistoryItem[];
  statusBreakdown: { name: string; value: number; color: string }[];
  memberSince: string;
  queuePosition: number;
}

const PersonalStats = ({ groupId, userId }: PersonalStatsProps) => {
  const [stats, setStats] = useState<PersonalStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        // Get group info
        const { data: group } = await supabase
          .from('groups')
          .select('contribution_amount')
          .eq('id', groupId)
          .single();

        const contributionAmount = group?.contribution_amount || 0;

        // Get member info
        const { data: member } = await supabase
          .from('group_members')
          .select('id, queue_position, created_at')
          .eq('group_id', groupId)
          .eq('user_id', userId)
          .single();

        if (!member) throw new Error('Member not found');

        // Get all cycles for this group
        const { data: cycles } = await supabase
          .from('payment_cycles')
          .select('id, due_date')
          .eq('group_id', groupId)
          .order('due_date', { ascending: false });

        // Get payment logs for this member
        const { data: paymentLogs } = await supabase
          .from('payment_logs')
          .select('cycle_id, status, verified_at')
          .eq('member_id', member.id);

        // Build payment history
        const paymentHistory: PaymentHistoryItem[] = [];
        const cycleMap = new Map(cycles?.map(c => [c.id, c]) || []);
        
        paymentLogs?.forEach(log => {
          const cycle = cycleMap.get(log.cycle_id);
          if (cycle) {
            paymentHistory.push({
              cycleId: log.cycle_id,
              dueDate: cycle.due_date,
              status: log.status,
              verifiedAt: log.verified_at,
            });
          }
        });

        // Sort by due date descending
        paymentHistory.sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());

        // Calculate stats
        const verifiedCount = paymentLogs?.filter(l => l.status === 'verified').length || 0;
        const pendingCount = paymentLogs?.filter(l => l.status === 'pending').length || 0;
        const unpaidCount = paymentLogs?.filter(l => l.status === 'unpaid').length || 0;
        const rejectedCount = paymentLogs?.filter(l => l.status === 'rejected').length || 0;

        const statusBreakdown = [
          { name: 'Verified', value: verifiedCount, color: '#22c55e' },
          { name: 'Pending', value: pendingCount, color: '#f59e0b' },
          { name: 'Unpaid', value: unpaidCount, color: '#6b7280' },
          { name: 'Rejected', value: rejectedCount, color: '#ef4444' },
        ].filter(item => item.value > 0);

        setStats({
          totalVerifiedPayments: verifiedCount,
          totalContributed: verifiedCount * contributionAmount,
          contributionAmount,
          paymentHistory,
          statusBreakdown,
          memberSince: member.created_at,
          queuePosition: member.queue_position,
        });
      } catch (error) {
        console.error('Error fetching personal stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [groupId, userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!stats) {
    return <div className="text-center text-muted-foreground">Failed to load stats</div>;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      verified: 'default',
      pending: 'secondary',
      rejected: 'destructive',
      unpaid: 'outline',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contributed</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${stats.totalContributed.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.totalVerifiedPayments} verified payments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contribution Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.contributionAmount}</div>
            <p className="text-xs text-muted-foreground">Per cycle</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Queue Position</CardTitle>
            <span className="text-lg font-bold text-primary">#{stats.queuePosition}</span>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Your payout position</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Member Since</CardTitle>
            <Calendar className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {format(new Date(stats.memberSince), 'MMM d, yyyy')}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart and History Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Status Chart */}
        <Card>
          <CardHeader>
            <CardTitle>My Payment Status</CardTitle>
            <CardDescription>Breakdown of all your payments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {stats.statusBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.statusBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {stats.statusBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No payment data yet
                </div>
              )}
            </div>
            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-4 mt-2">
              {stats.statusBreakdown.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm">{item.name}: {item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Payment History */}
        <Card>
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
            <CardDescription>Your payment history in this group</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {stats.paymentHistory.length > 0 ? (
                stats.paymentHistory.map((payment) => (
                  <div
                    key={payment.cycleId}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(payment.status)}
                      <div>
                        <p className="font-medium">
                          Due: {format(new Date(payment.dueDate), 'MMM d, yyyy')}
                        </p>
                        {payment.verifiedAt && (
                          <p className="text-xs text-muted-foreground">
                            Verified: {format(new Date(payment.verifiedAt), 'MMM d, yyyy')}
                          </p>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(payment.status)}
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No payment history yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PersonalStats;
