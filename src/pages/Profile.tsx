import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, User, Mail, Phone, Loader2, Save, Check, PiggyBank, Camera, Upload, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ThemeToggle } from '@/components/ThemeToggle';
import { uploadAvatar, deleteOldAvatars } from '@/lib/storage';
import type { Profile } from '@/types/database';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [viewPhotoOpen, setViewPhotoOpen] = useState(false);
  const [deletingAvatar, setDeletingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user!.id)
        .single();

      if (error) throw error;

      setProfile(data);
      setFormData({
        name: data.name || '',
        phone: data.phone || '',
      });
      setAvatarUrl(data.avatar_url || null);
    } catch (error) {
      console.error('Error fetching profile:', error);
      // If profile doesn't exist, use email from auth
      setFormData({
        name: user?.user_metadata?.name || '',
        phone: '',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingAvatar(true);

    try {
      const { url, error } = await uploadAvatar(user.id, file);

      if (error) {
        toast({
          title: 'Upload failed',
          description: error,
          variant: 'destructive',
        });
        return;
      }

      if (url) {
        // Update profile with new avatar URL
        const { error: updateError } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            email: user.email!,
            avatar_url: url,
            updated_at: new Date().toISOString(),
          });

        if (updateError) throw updateError;

        // Clean up old avatars
        await deleteOldAvatars(user.id, url);

        setAvatarUrl(url);
        toast({
          title: 'Avatar updated',
          description: 'Your profile photo has been updated successfully.',
        });
      }
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast({
        title: 'Error',
        description: 'Failed to update avatar',
        variant: 'destructive',
      });
    } finally {
      setUploadingAvatar(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteAvatar = async () => {
    if (!user || !avatarUrl) return;

    setDeletingAvatar(true);

    try {
      // Delete all avatars for this user
      await deleteOldAvatars(user.id);

      // Update profile to remove avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          avatar_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setAvatarUrl(null);
      toast({
        title: 'Photo deleted',
        description: 'Your profile photo has been removed.',
      });
    } catch (error) {
      console.error('Delete avatar error:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete photo',
        variant: 'destructive',
      });
    } finally {
      setDeletingAvatar(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    setSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email!,
          name: formData.name.trim() || null,
          phone: formData.phone.trim() || null,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      // Also update user metadata in auth
      await supabase.auth.updateUser({
        data: { name: formData.name.trim() },
      });

      toast({
        title: 'Profile updated',
        description: 'Your changes have been saved successfully.',
      });

      setHasChanges(false);
      fetchProfile();
    } catch (error) {
      console.error('Error updating profile:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update profile';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const userInitials = formData.name
    ? formData.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.charAt(0).toUpperCase() || 'U';

  const emailVerified = user?.email_confirmed_at != null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild className="rounded-xl hover:bg-muted">
              <Link to="/dashboard">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Profile Settings</h1>
              <p className="text-sm text-muted-foreground">Manage your account details</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-2xl">
        <div className="space-y-6">
          {/* Profile Avatar Card */}
          <Card className="animate-fade-in card-elevated overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
            <CardContent className="pt-6 relative">
              <div className="flex items-center gap-6">
                <div className="relative group">
                  {avatarUrl ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild disabled={uploadingAvatar || deletingAvatar}>
                        <button className="relative focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-full">
                          <Avatar className="h-24 w-24 text-2xl ring-4 ring-primary/10 transition-all group-hover:ring-primary/30 cursor-pointer">
                            <AvatarImage src={avatarUrl} alt={formData.name || 'Profile'} />
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xl">
                              {userInitials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                            {(uploadingAvatar || deletingAvatar) ? (
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
                        <DropdownMenuItem onClick={handleAvatarClick}>
                          <Upload className="h-4 w-4 mr-2" />
                          Change photo
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={handleDeleteAvatar}
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
                      onClick={handleAvatarClick}
                      disabled={uploadingAvatar}
                      className="relative focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-full"
                    >
                      <Avatar className="h-24 w-24 text-2xl ring-4 ring-primary/10 transition-all group-hover:ring-primary/30 cursor-pointer">
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xl">
                          {userInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                        {uploadingAvatar ? (
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
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-foreground">
                    {formData.name || 'No name set'}
                  </h2>
                  <p className="text-muted-foreground">{user?.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {emailVerified ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-green-500/10 text-green-600 px-2.5 py-1 rounded-full font-medium">
                        <Check className="h-3 w-3" />
                        Email verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs bg-amber-500/10 text-amber-600 px-2.5 py-1 rounded-full font-medium">
                        Email not verified
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleAvatarClick}
                    disabled={uploadingAvatar || deletingAvatar}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {avatarUrl ? 'Change photo' : 'Upload photo'}
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* View Photo Dialog */}
          <Dialog open={viewPhotoOpen} onOpenChange={setViewPhotoOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Profile Photo</DialogTitle>
              </DialogHeader>
              <div className="flex items-center justify-center p-4">
                <img 
                  src={avatarUrl || ''} 
                  alt="Profile" 
                  className="max-w-full max-h-[60vh] rounded-lg object-contain"
                />
              </div>
            </DialogContent>
          </Dialog>

          {/* Profile Form */}
          <Card className="animate-fade-in card-elevated" style={{ animationDelay: '0.1s' }}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>
                    Update your personal details. This information will be visible to group members.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      placeholder="Enter your full name"
                      className="pl-9"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      disabled={saving}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    This name will be displayed to other group members
                  </p>
                </div>

                {/* Email (Read-only) */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      className="pl-9 bg-muted"
                      value={user?.email || ''}
                      disabled
                      readOnly
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Email cannot be changed. Contact support if you need to update it.
                  </p>
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="Enter your phone number"
                      className="pl-9"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      disabled={saving}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Optional. Used for group communication.
                  </p>
                </div>

                <Separator />

                {/* Submit Button */}
                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/dashboard')}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving || !hasChanges} className="shadow-soft">
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Account Info */}
          <Card className="animate-fade-in card-elevated" style={{ animationDelay: '0.2s' }}>
            <CardHeader>
              <CardTitle className="text-base text-foreground">Account Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Account ID</span>
                  <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{user?.id?.slice(0, 8)}...</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Member since</span>
                  <span className="text-foreground font-medium">
                    {user?.created_at
                      ? new Date(user.created_at).toLocaleDateString('en-US', {
                          month: 'long',
                          year: 'numeric',
                        })
                      : 'Unknown'}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Last sign in</span>
                  <span className="text-foreground font-medium">
                    {user?.last_sign_in_at
                      ? new Date(user.last_sign_in_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'Unknown'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
