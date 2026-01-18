import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Users, Loader2, CheckCircle, Crown, Shield, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MemberRole } from '@/types/database';

export default function JoinGroup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [selectedRole, setSelectedRole] = useState<MemberRole>('member');
  const [groupPreview, setGroupPreview] = useState<{
    id: string;
    name: string;
    frequency: string;
    contribution_amount: number;
    memberCount: number;
  } | null>(null);

  const lookupGroup = async () => {
    if (!inviteCode.trim()) {
      toast({
        title: "Enter invite code",
        description: "Please enter the invite code to find the group",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Use ilike for case-insensitive matching
      const { data: group, error } = await supabase
        .from('groups')
        .select('id, name, frequency, contribution_amount')
        .ilike('invite_code', inviteCode.trim())
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
      console.error('Error looking up group:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to find group",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const joinGroup = async () => {
    if (!user || !groupPreview) return;

    setLoading(true);
    try {
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
      console.error('Error joining group:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to join group",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-xl font-semibold">Join a Group</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Enter Invite Code
            </CardTitle>
            <CardDescription>
              Enter the invite code shared by the group president to join their savings group.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!groupPreview ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="inviteCode">Invite Code</Label>
                  <Input
                    id="inviteCode"
                    placeholder="e.g., abc12def"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    disabled={loading}
                    className="font-mono text-lg tracking-wider"
                  />
                </div>

                <Button 
                  onClick={lookupGroup} 
                  className="w-full" 
                  size="lg" 
                  disabled={loading || !inviteCode.trim()}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 rounded-full bg-primary/10">
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
                    <div>
                      <p className="text-sm text-muted-foreground">Frequency</p>
                      <p className="font-medium capitalize">{groupPreview.frequency}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Contribution</p>
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
                    className="flex-1"
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
                    className="flex-1" 
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
