import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Users, Loader2, CheckCircle, Crown, Shield, User, PiggyBank, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MemberRole } from '@/types/database';
import { 
  checkRateLimit, 
  RATE_LIMITS, 
  getRateLimitIdentifier,
  RateLimitError,
  sanitizeString
} from '@/lib/security';

export default function JoinGroup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [selectedRole, setSelectedRole] = useState<MemberRole>('member');
  const [fieldError, setFieldError] = useState('');
  const [groupPreview, setGroupPreview] = useState<{
    id: string;
    name: string;
    frequency: string;
    contribution_amount: number;
    memberCount: number;
  } | null>(null);

  const lookupGroup = async () => {
    setFieldError('');
    
    // Sanitize and validate invite code
    const sanitizedCode = inviteCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    if (!sanitizedCode) {
      setFieldError('Please enter a valid invite code');
      toast({
        title: "Enter invite code",
        description: "Please enter the invite code to find the group",
        variant: "destructive",
      });
      return;
    }

    if (sanitizedCode.length < 6 || sanitizedCode.length > 20) {
      setFieldError('Invite code must be between 6 and 20 characters');
      return;
    }

    setLoading(true);
    try {
      // Rate limiting check
      const identifier = getRateLimitIdentifier(user?.id);
      const { allowed, retryAfterMs } = checkRateLimit(identifier, RATE_LIMITS.joinGroup);
      
      if (!allowed) {
        throw new RateLimitError(retryAfterMs!);
      }

      // Use ilike for case-insensitive matching
      const { data: group, error } = await supabase
        .from('groups')
        .select('id, name, frequency, contribution_amount')
        .ilike('invite_code', sanitizedCode)
        .maybeSingle();

      if (error) throw error;

      if (!group) {
        toast({
          title: "Group not found",
          description: "No group found with this invite code",
          variant: "destructive",
        });
        return;
      }

      // Get member count
      const { count } = await supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', group.id);

      setGroupPreview({
        ...group,
        memberCount: count || 0,
      });
    } catch (error: any) {
      if (error instanceof RateLimitError) {
        toast({
          title: "Rate limited",
          description: error.message,
          variant: "destructive",
        });
      } else {
        console.error('Error looking up group:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to find group",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const joinGroup = async () => {
    if (!user || !groupPreview) return;

    setLoading(true);
    try {
      // Rate limiting check
      const identifier = getRateLimitIdentifier(user.id);
      const { allowed, retryAfterMs } = checkRateLimit(identifier, RATE_LIMITS.joinGroup);
      
      if (!allowed) {
        throw new RateLimitError(retryAfterMs!);
      }

      // Check if already a member
      const { data: existingMember } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', groupPreview.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingMember) {
        toast({
          title: "Already a member",
          description: "You're already a member of this group",
          variant: "destructive",
        });
        navigate(`/groups/${groupPreview.id}`);
        return;
      }

      // Get next queue position
      const { data: members } = await supabase
        .from('group_members')
        .select('queue_position')
        .eq('group_id', groupPreview.id)
        .order('queue_position', { ascending: false })
        .limit(1);

      const nextPosition = members && members.length > 0 ? members[0].queue_position + 1 : 1;

      // Join the group
      const { data: memberData, error } = await supabase
        .from('group_members')
        .insert({
          group_id: groupPreview.id,
          user_id: user.id,
          queue_position: nextPosition,
          status: 'active',
          role: selectedRole,
        })
        .select()
        .single();

      if (error) throw error;

      // Check if there's an active cycle and create a payment log for the new member
      const { data: activeCycle } = await supabase
        .from('payment_cycles')
        .select('id')
        .eq('group_id', groupPreview.id)
        .eq('status', 'active')
        .maybeSingle();

      if (activeCycle && memberData) {
        await supabase
          .from('payment_logs')
          .insert({
            cycle_id: activeCycle.id,
            member_id: memberData.id,
            status: 'unpaid',
          });
      }

      toast({
        title: "Joined successfully!",
        description: `You've joined ${groupPreview.name}`,
      });

      navigate(`/groups/${groupPreview.id}`);
    } catch (error: any) {
      if (error instanceof RateLimitError) {
        toast({
          title: "Rate limited",
          description: error.message,
          variant: "destructive",
        });
      } else {
        console.error('Error joining group:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to join group",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
      
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" className="hover:bg-muted" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <PiggyBank className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Join a Group</h1>
              <p className="text-sm text-muted-foreground">Enter an invite code to join</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl relative">
        <Card className="card-elevated">
          <CardHeader className="pb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <UserPlus className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Enter Invite Code</CardTitle>
                <CardDescription className="mt-1">
                  Enter the invite code shared by the group president to join their savings group.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {!groupPreview ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="inviteCode">Invite Code</Label>
                  <Input
                    id="inviteCode"
                    placeholder="e.g., ABC12DEF"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    disabled={loading}
                    maxLength={20}
                    className={fieldError ? 'border-destructive' : ''}
                    aria-invalid={!!fieldError}
                  />
                  {fieldError && (
                    <p className="text-sm text-destructive">{fieldError}</p>
                  )}
                </div>

                <Button 
                  onClick={lookupGroup} 
                  className="w-full shadow-soft h-12 text-base" 
                  size="lg" 
                  disabled={loading || !inviteCode.trim()}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Looking up...
                    </>
                  ) : (
                    'Find Group'
                  )}
                </Button>
              </>
            ) : (
              <div className="space-y-6">
                {/* Group Preview */}
                <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 rounded-xl bg-primary/10 ring-2 ring-primary/20">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">{groupPreview.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {groupPreview.memberCount} member{groupPreview.memberCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-background/60 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Frequency</p>
                      <p className="font-medium capitalize">{groupPreview.frequency}</p>
                    </div>
                    <div className="p-3 bg-background/60 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Contribution</p>
                      <p className="font-medium">${groupPreview.contribution_amount}</p>
                    </div>
                  </div>
                </div>

                {/* Role Selection */}
                <div className="space-y-2">
                  <Label htmlFor="role">Your Role in the Group *</Label>
                  <Select
                    value={selectedRole}
                    onValueChange={(value: MemberRole) => setSelectedRole(value)}
                    disabled={loading}
                  >
                    <SelectTrigger id="role">
                      <SelectValue placeholder="Select your role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="president">
                        <div className="flex items-center gap-2">
                          <Crown className="h-4 w-4 text-yellow-500" />
                          President
                        </div>
                      </SelectItem>
                      <SelectItem value="vice_president">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-blue-500" />
                          Vice President
                        </div>
                      </SelectItem>
                      <SelectItem value="member">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-500" />
                          Member
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Select the role you'll have in this group
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    className="flex-1 h-11"
                    onClick={() => {
                      setGroupPreview(null);
                      setInviteCode('');
                      setSelectedRole('member');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={joinGroup} 
                    className="flex-1 h-11 shadow-soft" 
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Joining...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Join Group
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
