import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationCenter from '@/components/NotificationCenter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Users, 
  Plus, 
  LogOut, 
  DollarSign, 
  Calendar, 
  ChevronRight,
  User,
  Settings,
  UserPlus
} from 'lucide-react';
import { toast } from 'sonner';
import type { Group } from '@/types/database';

export default function DashboardPage() {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchGroups();
    }
  }, [user]);

  const fetchGroups = async () => {
    try {
      // Fetch groups where user is president
      const { data: presidentGroups, error: presidentError } = await supabase
        .from('groups')
        .select('*')
        .eq('president_id', user!.id);

      if (presidentError) throw presidentError;

      // Fetch groups where user is a member
      const { data: memberData, error: memberError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user!.id);

      if (memberError) throw memberError;

      const memberGroupIds = memberData?.map((m) => m.group_id) || [];

      let memberGroups: Group[] = [];
      if (memberGroupIds.length > 0) {
        const { data, error } = await supabase
          .from('groups')
          .select('*')
          .in('id', memberGroupIds);

        if (error) throw error;
        memberGroups = data || [];
      }

      // Combine and deduplicate
      const allGroups = [...(presidentGroups || []), ...memberGroups];
      const uniqueGroups = Array.from(new Map(allGroups.map((g) => [g.id, g])).values());
      
      setGroups(uniqueGroups as Group[]);
    } catch (error: any) {
      console.error('Error fetching groups:', error);
      // If tables don't exist yet, show empty state
      if (error.code === '42P01') {
        setGroups([]);
      } else {
        toast.error('Failed to load groups');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const userName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
  const userInitials = userName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">ConLify</h1>
          <div className="flex items-center gap-2">
            <NotificationCenter />
            <ThemeToggle />
            
            {/* Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{userName}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Profile Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/groups/join" className="cursor-pointer">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Join a Group
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8 animate-fade-in">
          <h2 className="text-3xl font-bold mb-2">Welcome, {userName}!</h2>
          <p className="text-muted-foreground">Manage your savings groups and track contributions</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="animate-fade-in">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Groups
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <p className="text-2xl font-bold">{groups.length}</p>
              )}
            </CardContent>
          </Card>

          <Card className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Contributions
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">$0</p>
            </CardContent>
          </Card>

          <Card className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Next Payment Due
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">—</p>
            </CardContent>
          </Card>
        </div>

        {/* Groups Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">Your Groups</h3>
            <Button onClick={() => navigate('/groups/create')}>
              <Plus className="mr-2 h-4 w-4" />
              Create Group
            </Button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : groups.length === 0 ? (
            <Card className="animate-fade-in">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
                <CardTitle className="mb-2">No groups yet</CardTitle>
                <CardDescription className="text-center mb-4">
                  Create a new savings group or join one using an invite link
                </CardDescription>
                <Button onClick={() => navigate('/groups/create')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Group
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map((group) => (
                <Card
                  key={group.id}
                  className="cursor-pointer hover:shadow-md transition-shadow animate-fade-in"
                  onClick={() => navigate(`/groups/${group.id}`)}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{group.name}</CardTitle>
                        <CardDescription className="capitalize">
                          {group.frequency} • ${group.contribution_amount}
                        </CardDescription>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {group.president_id === user?.id && (
                        <span className="bg-primary/10 text-primary px-2 py-1 rounded-full text-xs font-medium">
                          President
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
