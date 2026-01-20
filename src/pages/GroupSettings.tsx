import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Group, GroupMember, MemberRole } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Settings, PiggyBank } from 'lucide-react';
import AnalyticsDashboard from '@/components/settings/AnalyticsDashboard';
import PersonalStats from '@/components/settings/PersonalStats';
import MemberPerformance from '@/components/settings/MemberPerformance';
import CycleReports from '@/components/settings/CycleReports';
import GeneralSettings from '@/components/settings/GeneralSettings';

const GroupSettings = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [group, setGroup] = useState<Group | null>(null);
  const [membership, setMembership] = useState<GroupMember | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !id) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch group
        const { data: groupData, error: groupError } = await supabase
          .from('groups')
          .select('*')
          .eq('id', id)
          .single();

        if (groupError) throw groupError;
        setGroup(groupData);

        // Fetch user's membership
        const { data: memberData, error: memberError } = await supabase
          .from('group_members')
          .select('*')
          .eq('group_id', id)
          .eq('user_id', user.id)
          .single();

        if (memberError) throw memberError;
        setMembership(memberData);
      } catch (error) {
        console.error('Error fetching settings data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load settings',
          variant: 'destructive',
        });
        navigate(`/groups/${id}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, id, navigate, toast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!group || !membership) {
    return null;
  }

  const isPresident = membership.role === 'president';

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
      
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" className="hover:bg-muted" onClick={() => navigate(`/groups/${id}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <PiggyBank className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">{group.name}</h1>
              <p className="text-sm text-muted-foreground">Group Settings & Analytics</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container max-w-6xl mx-auto py-6 px-4 relative">
        {/* Tabs */}
        <Tabs defaultValue="analytics" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 bg-muted/50 p-1">
            <TabsTrigger value="analytics" className="data-[state=active]:shadow-soft">Analytics</TabsTrigger>
            <TabsTrigger value="personal" className="data-[state=active]:shadow-soft">My Stats</TabsTrigger>
            {isPresident && (
              <>
                <TabsTrigger value="members" className="data-[state=active]:shadow-soft">Members</TabsTrigger>
                <TabsTrigger value="reports" className="data-[state=active]:shadow-soft">Reports</TabsTrigger>
                <TabsTrigger value="general" className="data-[state=active]:shadow-soft">General</TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="analytics">
            <AnalyticsDashboard groupId={group.id} />
          </TabsContent>

          <TabsContent value="personal">
            <PersonalStats groupId={group.id} userId={user!.id} />
          </TabsContent>

          {isPresident && (
            <>
              <TabsContent value="members">
                <MemberPerformance groupId={group.id} />
              </TabsContent>

              <TabsContent value="reports">
                <CycleReports groupId={group.id} groupName={group.name} />
              </TabsContent>

              <TabsContent value="general">
                <GeneralSettings group={group} onUpdate={setGroup} />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default GroupSettings;
