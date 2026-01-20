import { useState, useRef } from 'react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Save, Archive, AlertTriangle, Camera, Upload, Loader2, Users, Eye, Trash2 } from 'lucide-react';
import { uploadGroupPhoto, deleteOldGroupPhotos } from '@/lib/storage';

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
  const [photoUrl, setPhotoUrl] = useState<string | null>(group.photo_url);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [viewPhotoOpen, setViewPhotoOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);

    try {
      const { url, error } = await uploadGroupPhoto(group.id, file);

      if (error) {
        toast({
          title: 'Upload failed',
          description: error,
          variant: 'destructive',
        });
        return;
      }

      if (url) {
        // Update group with new photo URL
        const { data, error: updateError } = await supabase
          .from('groups')
          .update({
            photo_url: url,
            updated_at: new Date().toISOString(),
          })
          .eq('id', group.id)
          .select()
          .single();

        if (updateError) throw updateError;

        // Clean up old photos
        await deleteOldGroupPhotos(group.id, url);

        setPhotoUrl(url);
        onUpdate(data);
        toast({
          title: 'Photo updated',
          description: 'Group photo has been updated successfully.',
        });
      }
    } catch (error) {
      console.error('Photo upload error:', error);
      toast({
        title: 'Error',
        description: 'Failed to update group photo',
        variant: 'destructive',
      });
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeletePhoto = async () => {
    if (!photoUrl) return;

    setDeletingPhoto(true);

    try {
      // Delete all photos for this group
      await deleteOldGroupPhotos(group.id);

      // Update group to remove photo URL
      const { data, error: updateError } = await supabase
        .from('groups')
        .update({
          photo_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', group.id)
        .select()
        .single();

      if (updateError) throw updateError;

      setPhotoUrl(null);
      onUpdate(data);
      toast({
        title: 'Photo deleted',
        description: 'Group photo has been removed.',
      });
    } catch (error) {
      console.error('Delete photo error:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete photo',
        variant: 'destructive',
      });
    } finally {
      setDeletingPhoto(false);
    }
  };

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
      {/* Group Photo */}
      <Card className="card-elevated overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
        <CardHeader className="relative">
          <CardTitle>Group Photo</CardTitle>
          <CardDescription>Upload a photo to represent your group</CardDescription>
        </CardHeader>
        <CardContent className="relative">
          <div className="flex items-center gap-6">
            <div className="relative group">
              {photoUrl ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild disabled={uploadingPhoto || deletingPhoto}>
                    <button className="relative focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-full">
                      <Avatar className="h-24 w-24 text-2xl ring-4 ring-primary/10 transition-all group-hover:ring-primary/30 cursor-pointer">
                        <AvatarImage src={photoUrl} alt={group.name} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          <Users className="h-10 w-10" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                        {(uploadingPhoto || deletingPhoto) ? (
                          <Loader2 className="h-6 w-6 text-white animate-spin" />
                        ) : (
                          <Camera className="h-6 w-6 text-white" />
                        )}
                      </div>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuItem onClick={() => setViewPhotoOpen(true)}>
                      <Eye className="h-4 w-4 mr-2" />
                      View photo
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handlePhotoClick}>
                      <Upload className="h-4 w-4 mr-2" />
                      Change photo
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={handleDeletePhoto}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete photo
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <button
                  type="button"
                  onClick={handlePhotoClick}
                  disabled={uploadingPhoto}
                  className="relative focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-full"
                >
                  <Avatar className="h-24 w-24 text-2xl ring-4 ring-primary/10 transition-all group-hover:ring-primary/30 cursor-pointer">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      <Users className="h-10 w-10" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    {uploadingPhoto ? (
                      <Loader2 className="h-6 w-6 text-white animate-spin" />
                    ) : (
                      <Camera className="h-6 w-6 text-white" />
                    )}
                  </div>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handlePhotoChange}
                className="hidden"
              />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{group.name}</h3>
              <p className="text-sm text-muted-foreground">
                {photoUrl ? 'Click on the image for options' : 'Click on the image to upload a photo'}
              </p>
              <button
                type="button"
                onClick={handlePhotoClick}
                disabled={uploadingPhoto || deletingPhoto}
                className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
              >
                <Upload className="h-4 w-4" />
                {photoUrl ? 'Change photo' : 'Upload photo'}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* View Photo Dialog */}
      <Dialog open={viewPhotoOpen} onOpenChange={setViewPhotoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Group Photo</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-4">
            <img 
              src={photoUrl || ''} 
              alt={group.name} 
              className="max-w-full max-h-[60vh] rounded-lg object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>

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
