import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { exportToCsv } from '@/lib/exportCsv';

interface CycleReportsProps {
  groupId: string;
  groupName: string;
}

interface CycleReport {
  cycleId: string;
  dueDate: string;
  status: string;
  recipientName: string;
  recipientEmail: string;
  totalExpected: number;
  totalCollected: number;
  verifiedCount: number;
  pendingCount: number;
  unpaidCount: number;
  rejectedCount: number;
  contributionAmount: number;
}

const CycleReports = ({ groupId, groupName }: CycleReportsProps) => {
  const [reports, setReports] = useState<CycleReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      try {
        // Get group contribution amount
        const { data: group } = await supabase
          .from('groups')
          .select('contribution_amount')
          .eq('id', groupId)
          .single();

        const contributionAmount = group?.contribution_amount || 0;

        // Get all cycles
        const { data: cycles } = await supabase
          .from('payment_cycles')
          .select('id, due_date, status, created_at')
          .eq('group_id', groupId)
          .order('due_date', { ascending: false });

        if (!cycles || cycles.length === 0) {
          setReports([]);
          setLoading(false);
          return;
        }

        // Get all members with profiles
        const { data: members } = await supabase
          .from('group_members')
          .select('id, user_id, queue_position')
          .eq('group_id', groupId);

        const memberMap = new Map(members?.map(m => [m.id, m]) || []);

        // Get profiles
        const userIds = members?.map(m => m.user_id) || [];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        // Get all payment logs
        const cycleIds = cycles.map(c => c.id);
        const { data: allLogs } = await supabase
          .from('payment_logs')
          .select('cycle_id, member_id, status')
          .in('cycle_id', cycleIds);

        // Group logs by cycle
        const logsByCycle = new Map<string, any[]>();
        allLogs?.forEach(log => {
          const existing = logsByCycle.get(log.cycle_id) || [];
          existing.push(log);
          logsByCycle.set(log.cycle_id, existing);
        });

        // Build reports
        const cycleReports: CycleReport[] = cycles.map((cycle, index) => {
          const logs = logsByCycle.get(cycle.id) || [];
          
          // Find recipient (queue position matches cycle number - closed cycles count)
          const closedBefore = cycles.slice(index).filter(c => c.status === 'closed').length;
          const recipientPosition = closedBefore;
          const recipientMember = members?.find(m => m.queue_position === recipientPosition);
          const recipientProfile = recipientMember ? profileMap.get(recipientMember.user_id) : null;

          const verifiedCount = logs.filter(l => l.status === 'verified').length;
          const pendingCount = logs.filter(l => l.status === 'pending').length;
          const unpaidCount = logs.filter(l => l.status === 'unpaid').length;
          const rejectedCount = logs.filter(l => l.status === 'rejected').length;

          return {
            cycleId: cycle.id,
            dueDate: cycle.due_date,
            status: cycle.status,
            recipientName: recipientProfile?.name || 'Unknown',
            recipientEmail: recipientProfile?.email || '',
            totalExpected: logs.length * contributionAmount,
            totalCollected: verifiedCount * contributionAmount,
            verifiedCount,
            pendingCount,
            unpaidCount,
            rejectedCount,
            contributionAmount,
          };
        });

        setReports(cycleReports);
      } catch (error) {
        console.error('Error fetching cycle reports:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [groupId]);

  const handleExportCsv = () => {
    const filename = `${groupName.replace(/\s+/g, '_')}_cycle_reports_${format(new Date(), 'yyyy-MM-dd')}`;
    
    exportToCsv(
      reports,
      [
        { header: 'Due Date', accessor: (r) => format(new Date(r.dueDate), 'yyyy-MM-dd') },
        { header: 'Status', accessor: 'status' },
        { header: 'Recipient Name', accessor: 'recipientName' },
        { header: 'Recipient Email', accessor: 'recipientEmail' },
        { header: 'Expected Amount', accessor: 'totalExpected' },
        { header: 'Collected Amount', accessor: 'totalCollected' },
        { header: 'Verified Payments', accessor: 'verifiedCount' },
        { header: 'Pending Payments', accessor: 'pendingCount' },
        { header: 'Unpaid', accessor: 'unpaidCount' },
        { header: 'Rejected', accessor: 'rejectedCount' },
      ],
      filename
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    if (status === 'closed') {
      return <Badge variant="default">Completed</Badge>;
    }
    return <Badge variant="secondary">Active</Badge>;
  };

  // Summary stats
  const totalCollected = reports.reduce((sum, r) => sum + r.totalCollected, 0);
  const totalExpected = reports.reduce((sum, r) => sum + r.totalExpected, 0);
  const completedCycles = reports.filter(r => r.status === 'closed').length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Cycles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reports.length}</div>
            <p className="text-xs text-muted-foreground">{completedCycles} completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${totalCollected.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              of ${totalExpected.toLocaleString()} expected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">Overall success rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Reports Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Cycle Reports</CardTitle>
            <CardDescription>Historical payment cycle data</CardDescription>
          </div>
          <Button onClick={handleExportCsv} disabled={reports.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {reports.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead className="text-right">Expected</TableHead>
                    <TableHead className="text-right">Collected</TableHead>
                    <TableHead className="text-center">Verified</TableHead>
                    <TableHead className="text-center">Pending</TableHead>
                    <TableHead className="text-center">Missed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.cycleId}>
                      <TableCell className="font-medium">
                        {format(new Date(report.dueDate), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>{getStatusBadge(report.status)}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{report.recipientName}</p>
                          <p className="text-xs text-muted-foreground">{report.recipientEmail}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        ${report.totalExpected.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-green-600 font-medium">
                        ${report.totalCollected.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-green-600">{report.verifiedCount}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-yellow-600">{report.pendingCount}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-red-600">{report.unpaidCount + report.rejectedCount}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mb-4 opacity-50" />
              <p>No payment cycles yet</p>
              <p className="text-sm">Start a cycle to see reports here</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CycleReports;
