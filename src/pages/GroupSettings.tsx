import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Group, GroupMember, MemberRole } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Settings } from 'lucide-react';
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!group || !membership) {
    return null;
  }

  const isPresident = membership.role === 'president';

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto py-6 px-4">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/groups/${id}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Settings className="h-6 w-6" />
            <h1 className="text-2xl font-bold">{group.name} - Settings</h1>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="analytics" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="personal">My Stats</TabsTrigger>
            {isPresident && (
              <>
                <TabsTrigger value="members">Members</TabsTrigger>
                <TabsTrigger value="reports">Reports</TabsTrigger>
                <TabsTrigger value="general">General</TabsTrigger>
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
