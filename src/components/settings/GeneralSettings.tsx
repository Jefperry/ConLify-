import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Group, GroupFrequency } from '@/types/database';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Save, Archive, AlertTriangle } from 'lucide-react';

interface GeneralSettingsProps {
  group: Group;
  onUpdate: (group: Group) => void;
}

const GeneralSettings = ({ group, onUpdate }: GeneralSettingsProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [name, setName] = useState(group.name);
  const [contributionAmount, setContributionAmount] = useState(group.contribution_amount.toString());
  const [frequency, setFrequency] = useState<GroupFrequency>(group.frequency);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: 'Error',
        description: 'Group name is required',
        variant: 'destructive',
      });
      return;
    }

    const amount = parseFloat(contributionAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: 'Error',
        description: 'Contribution amount must be a positive number',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('groups')
        .update({
          name: name.trim(),
          contribution_amount: amount,
          frequency,
          updated_at: new Date().toISOString(),
        })
        .eq('id', group.id)
        .select()
        .single();

      if (error) throw error;

      onUpdate(data);
      toast({
        title: 'Settings Saved',
        description: 'Group settings have been updated successfully.',
      });
    } catch (error) {
      console.error('Error updating group:', error);
      toast({
        title: 'Error',
        description: 'Failed to update group settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    setArchiving(true);
    try {
      const { error } = await supabase
        .from('groups')
        .update({
          archived_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', group.id);

      if (error) throw error;

      toast({
        title: 'Group Archived',
        description: 'The group has been archived. You can restore it from the Dashboard.',
      });

      navigate('/dashboard');
    } catch (error) {
      console.error('Error archiving group:', error);
      toast({
        title: 'Error',
        description: 'Failed to archive group',
        variant: 'destructive',
      });
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Edit Group Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Group Details</CardTitle>
          <CardDescription>Update your group's basic information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Group Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter group name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Contribution Amount ($)</Label>
            <Input
              id="amount"
              type="number"
              min="1"
              step="0.01"
              value={contributionAmount}
              onChange={(e) => setContributionAmount(e.target.value)}
              placeholder="Enter contribution amount"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="frequency">Payment Frequency</Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as GroupFrequency)}>
              <SelectTrigger id="frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>

      {/* Group Info (Read-only) */}
      <Card>
        <CardHeader>
          <CardTitle>Group Information</CardTitle>
          <CardDescription>Reference information for this group</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Invite Code</Label>
              <p className="font-mono text-lg font-bold">{group.invite_code}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">President Email</Label>
              <p className="text-sm">{group.president_email}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Created</Label>
              <p className="text-sm">{new Date(group.created_at).toLocaleDateString()}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Last Updated</Label>
              <p className="text-sm">{new Date(group.updated_at).toLocaleDateString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible and destructive actions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border rounded-lg">
            <div>
              <h4 className="font-medium">Archive this group</h4>
              <p className="text-sm text-muted-foreground">
                Move this group to your archived groups. You can restore it later.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="border-orange-500 text-orange-600 hover:bg-orange-50">
                  <Archive className="h-4 w-4 mr-2" />
                  Archive Group
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Archive "{group.name}"?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will move the group to your archived groups. Members will no longer see this group
                    in their dashboard, but all data will be preserved. You can restore the group at any time.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleArchive}
                    disabled={archiving}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    {archiving ? 'Archiving...' : 'Archive Group'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GeneralSettings;
