import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, DollarSign, Mail, Clock, CheckCircle, 
  Send, Loader2, AlertCircle, Calendar, User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { addNotification, showNotification, requestNotificationPermission } from '@/lib/notifications';
import { Group, GroupMember, PaymentCycle, PaymentLog, PaymentStatus } from '@/types/database';
import { format } from 'date-fns';

export default function Invoice() {
  const { groupId, cycleId } = useParams<{ groupId: string; cycleId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [group, setGroup] = useState<Group | null>(null);
  const [cycle, setCycle] = useState<PaymentCycle | null>(null);
  const [member, setMember] = useState<GroupMember | null>(null);
  const [paymentLog, setPaymentLog] = useState<PaymentLog | null>(null);

  const fetchInvoiceData = useCallback(async () => {
    try {
      // Fetch group
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (groupError) throw groupError;
      setGroup(groupData);

      // Fetch cycle
      const { data: cycleData, error: cycleError } = await supabase
        .from('payment_cycles')
        .select('*')
        .eq('id', cycleId)
        .single();

      if (cycleError) throw cycleError;
      setCycle(cycleData);

      // Fetch current user's membership
      const { data: memberData, error: memberError } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupId)
        .eq('user_id', user?.id)
        .single();

      if (memberError) throw memberError;
      setMember(memberData);

      // Fetch payment log for this member and cycle
      const { data: logData, error: logError } = await supabase
        .from('payment_logs')
        .select('*')
        .eq('cycle_id', cycleId)
        .eq('member_id', memberData.id)
        .single();

      if (logError && logError.code !== 'PGRST116') throw logError;
      setPaymentLog(logData);

    } catch (error) {
      console.error('Error fetching invoice data:', error);
      toast({
        title: "Error",
        description: "Failed to load invoice data",
        variant: "destructive",
      });
      navigate(`/groups/${groupId}`);
    } finally {
      setLoading(false);
    }
  }, [groupId, cycleId, user?.id, navigate, toast]);

  useEffect(() => {
    if (groupId && cycleId && user) {
      fetchInvoiceData();
      requestNotificationPermission();
    }
  }, [groupId, cycleId, user, fetchInvoiceData]);

  // Real-time subscription for payment status updates
  useEffect(() => {
    if (!paymentLog) return;

    const paymentLogId = paymentLog.id;
    const groupName = group?.name;

    const subscription = supabase
      .channel(`payment_log_${paymentLogId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'payment_logs',
          filter: `id=eq.${paymentLogId}`,
        },
        (payload) => {
          const newLog = payload.new as PaymentLog;
          setPaymentLog(newLog);

          if (newLog.status === 'verified') {
            addNotification({
              type: 'payment_verified',
              title: 'Payment Verified!',
              message: `Your payment for ${groupName || 'the group'} has been verified by the president.`,
              groupId: groupId,
            });

            showNotification('Payment Verified! ✅', {
              body: `Your payment for ${groupName || 'the group'} has been verified.`,
              tag: `payment-verified-${paymentLogId}`,
            });

            toast({
              title: "Payment Verified! 🎉",
              description: "The president has verified your payment.",
            });
          } else if (newLog.status === 'rejected') {
            addNotification({
              type: 'payment_rejected',
              title: 'Payment Rejected',
              message: `Your payment for ${groupName || 'the group'} was rejected. Please check with the president.`,
              groupId: groupId,
            });

            showNotification('Payment Rejected', {
              body: `Your payment was rejected. Please check with the president.`,
              tag: `payment-rejected-${paymentLogId}`,
            });

            toast({
              title: "Payment Rejected",
              description: "Please check with the president for details.",
              variant: "destructive",
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentLog?.id, group?.name, groupId, toast]);

  const markAsSent = async () => {
    if (!paymentLog) return;

    setMarking(true);
    try {
      const { error } = await supabase
        .from('payment_logs')
        .update({
          status: 'pending',
          marked_at: new Date().toISOString(),
        })
        .eq('id', paymentLog.id);

      if (error) throw error;

      toast({
        title: "Payment Marked as Sent!",
        description: "The president will verify your payment shortly.",
      });

      // Refresh data
      setPaymentLog(prev => prev ? { ...prev, status: 'pending', marked_at: new Date().toISOString() } : null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to mark payment as sent";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setMarking(false);
    }
  };

  const getStatusBadge = (status: PaymentStatus) => {
    const variants = {
      unpaid: { className: 'bg-muted text-muted-foreground', icon: Clock, label: 'Unpaid' },
      pending: { className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', icon: Clock, label: 'Pending Verification' },
      verified: { className: 'bg-green-500/10 text-green-600 border-green-500/20', icon: CheckCircle, label: 'Verified' },
      rejected: { className: 'bg-destructive/10 text-destructive border-destructive/20', icon: AlertCircle, label: 'Rejected' },
    };
    const { className, icon: Icon, label } = variants[status];
    return (
      <Badge variant="outline" className={`gap-1 ${className}`}>
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
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
        <main className="container mx-auto px-4 py-8 max-w-lg">
          <Skeleton className="h-96 w-full" />
        </main>
      </div>
    );
  }

  if (!group || !cycle || !member) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Invoice not found</h2>
          <Button asChild>
            <Link to="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  const isLocked = member.status === 'locked';
  const canMarkAsSent = paymentLog?.status === 'unpaid' && !isLocked;
  const isPending = paymentLog?.status === 'pending';
  const isVerified = paymentLog?.status === 'verified';
  const isRejected = paymentLog?.status === 'rejected';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/groups/${groupId}`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Payment Invoice</h1>
            <p className="text-sm text-muted-foreground">{group.name}</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-lg">
        <div className="space-y-6">
          {/* Locked Member Warning */}
          {isLocked && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Account Locked</AlertTitle>
              <AlertDescription>
                Your account has been locked due to missed payments. Contact the group president to restore your access.
              </AlertDescription>
            </Alert>
          )}

          {/* Payment Status */}
          {paymentLog && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Payment Status</span>
                  {getStatusBadge(paymentLog.status)}
                </div>
                {paymentLog.marked_at && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Marked as sent: {format(new Date(paymentLog.marked_at), 'PPp')}
                  </p>
                )}
                {paymentLog.verified_at && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Verified: {format(new Date(paymentLog.verified_at), 'PPp')}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Amount Card */}
          <Card>
            <CardHeader className="text-center pb-2">
              <CardDescription>Amount Due</CardDescription>
              <CardTitle className="text-5xl font-bold text-primary">
                ${group.contribution_amount.toFixed(2)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-3 border-t">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Due Date</span>
                </div>
                <span className="font-medium">{format(new Date(cycle.due_date), 'PPP')}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-t">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>Your Position</span>
                </div>
                <span className="font-medium">#{member.queue_position} in queue</span>
              </div>
            </CardContent>
          </Card>

          {/* E-Transfer Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                E-Transfer Instructions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Send e-Transfer to:</p>
                <p className="font-medium text-lg">{group.president_email}</p>
              </div>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Important</AlertTitle>
                <AlertDescription>
                  Use your <strong>full name</strong> as the sender name so the president can identify your payment.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Action Button */}
          <div className="space-y-3">
            {canMarkAsSent && (
              <Button 
                onClick={markAsSent} 
                disabled={marking}
                className="w-full h-12 text-lg"
                size="lg"
              >
                {marking ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Marking...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-5 w-5" />
                    Mark as Sent
                  </>
                )}
              </Button>
            )}

            {isPending && (
              <div className="text-center py-4">
                <CheckCircle className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
                <p className="font-medium">Payment Marked as Sent</p>
                <p className="text-sm text-muted-foreground">
                  Waiting for president to verify your payment
                </p>
              </div>
            )}

            {isVerified && (
              <div className="text-center py-4">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <p className="font-medium text-green-600">Payment Verified!</p>
                <p className="text-sm text-muted-foreground">
                  Thank you for your contribution
                </p>
              </div>
            )}

            {isRejected && (
              <div className="space-y-3">
                <div className="text-center py-4">
                  <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
                  <p className="font-medium text-destructive">Payment Rejected</p>
                  <p className="text-sm text-muted-foreground">
                    The president could not verify your payment. Please try again.
                  </p>
                </div>
                <Button 
                  onClick={markAsSent} 
                  disabled={marking}
                  className="w-full"
                  variant="outline"
                >
                  {marking ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Marking...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Mark as Sent Again
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Back Button */}
          <Button variant="outline" className="w-full" asChild>
            <Link to={`/groups/${groupId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Group
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
