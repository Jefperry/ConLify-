import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, DollarSign, CheckCircle } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

interface AnalyticsDashboardProps {
  groupId: string;
}

interface GroupAnalytics {
  totalCollectedAllTime: number;
  contributionAmount: number;
  totalMembers: number;
  activeMembers: number;
  totalCycles: number;
  completedCycles: number;
  currentCycleProgress: number;
  onTimePaymentRate: number;
  monthlyData: { month: string; amount: number }[];
  paymentBreakdown: { name: string; value: number; color: string }[];
}

const AnalyticsDashboard = ({ groupId }: AnalyticsDashboardProps) => {
  const [analytics, setAnalytics] = useState<GroupAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        // Fetch group info
        const { data: group } = await supabase
          .from('groups')
          .select('contribution_amount')
          .eq('id', groupId)
          .single();

        const contributionAmount = group?.contribution_amount || 0;

        // Fetch all members
        const { data: members } = await supabase
          .from('group_members')
          .select('id, status')
          .eq('group_id', groupId);

        const totalMembers = members?.length || 0;
        const activeMembers = members?.filter(m => m.status === 'active').length || 0;

        // Fetch all cycles
        const { data: cycles } = await supabase
          .from('payment_cycles')
          .select('id, status, created_at')
          .eq('group_id', groupId)
          .order('created_at', { ascending: true });

        const totalCycles = cycles?.length || 0;
        const completedCycles = cycles?.filter(c => c.status === 'closed').length || 0;

        // Fetch all payment logs
        const cycleIds = cycles?.map(c => c.id) || [];
        let allPaymentLogs: any[] = [];
        
        if (cycleIds.length > 0) {
          const { data: logs } = await supabase
            .from('payment_logs')
            .select('status, cycle_id, verified_at')
            .in('cycle_id', cycleIds);
          
          allPaymentLogs = logs || [];
        }

        // Calculate total collected all time (verified payments)
        const verifiedPayments = allPaymentLogs.filter(l => l.status === 'verified').length;
        const totalCollectedAllTime = verifiedPayments * contributionAmount;

        // Calculate current cycle progress
        const activeCycle = cycles?.find(c => c.status === 'active');
        let currentCycleProgress = 0;
        
        if (activeCycle) {
          const cycleLogs = allPaymentLogs.filter(l => l.cycle_id === activeCycle.id);
          const verifiedInCycle = cycleLogs.filter(l => l.status === 'verified').length;
          currentCycleProgress = cycleLogs.length > 0 
            ? Math.round((verifiedInCycle / cycleLogs.length) * 100) 
            : 0;
        }

        // Calculate on-time payment rate (verified / total expected)
        const totalExpectedPayments = allPaymentLogs.length;
        const onTimePaymentRate = totalExpectedPayments > 0
          ? Math.round((verifiedPayments / totalExpectedPayments) * 100)
          : 0;

        // Monthly data for chart (last 6 months)
        const monthlyData: { month: string; amount: number }[] = [];
        for (let i = 5; i >= 0; i--) {
          const date = subMonths(new Date(), i);
          const start = startOfMonth(date);
          const end = endOfMonth(date);
          
          const monthLogs = allPaymentLogs.filter(l => {
            if (!l.verified_at) return false;
            const verifiedDate = new Date(l.verified_at);
            return verifiedDate >= start && verifiedDate <= end && l.status === 'verified';
          });
          
          monthlyData.push({
            month: format(date, 'MMM'),
            amount: monthLogs.length * contributionAmount,
          });
        }

        // Payment breakdown for pie chart
        const pendingCount = allPaymentLogs.filter(l => l.status === 'pending').length;
        const unpaidCount = allPaymentLogs.filter(l => l.status === 'unpaid').length;
        const rejectedCount = allPaymentLogs.filter(l => l.status === 'rejected').length;

        const paymentBreakdown = [
          { name: 'Verified', value: verifiedPayments, color: '#22c55e' },
          { name: 'Pending', value: pendingCount, color: '#f59e0b' },
          { name: 'Unpaid', value: unpaidCount, color: '#6b7280' },
          { name: 'Rejected', value: rejectedCount, color: '#ef4444' },
        ].filter(item => item.value > 0);

        setAnalytics({
          totalCollectedAllTime,
          contributionAmount,
          totalMembers,
          activeMembers,
          totalCycles,
          completedCycles,
          currentCycleProgress,
          onTimePaymentRate,
          monthlyData,
          paymentBreakdown,
        });
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [groupId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!analytics) {
    return <div className="text-center text-muted-foreground">Failed to load analytics</div>;
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${analytics.totalCollectedAllTime.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">All-time verified payments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Members</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.activeMembers}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.totalMembers - analytics.activeMembers} locked/pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cycles Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.completedCycles} / {analytics.totalCycles}
            </div>
            <p className="text-xs text-muted-foreground">Payment cycles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payment Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.onTimePaymentRate}%</div>
            <p className="text-xs text-muted-foreground">Verified payments</p>
          </CardContent>
        </Card>
      </div>

      {/* Current Cycle Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Current Cycle Progress</CardTitle>
          <CardDescription>Percentage of payments verified in active cycle</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span className="font-medium">{analytics.currentCycleProgress}%</span>
            </div>
            <Progress value={analytics.currentCycleProgress} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Collections Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Collections</CardTitle>
            <CardDescription>Verified payments over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    formatter={(value: number) => [`$${value.toLocaleString()}`, 'Amount']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))' 
                    }}
                  />
                  <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Payment Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Status Breakdown</CardTitle>
            <CardDescription>All-time payment statuses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {analytics.paymentBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.paymentBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {analytics.paymentBreakdown.map((entry, index) => (
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
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {analytics.paymentBreakdown.map((item) => (
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
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
