import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Users, DollarSign, Calendar, Loader2, Crown, Shield, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { GroupFrequency, MemberRole } from '@/types/database';
import { 
  validateSchema, 
  SCHEMAS, 
  checkRateLimit, 
  RATE_LIMITS, 
  getRateLimitIdentifier,
  RateLimitError,
  ValidationError,
  sanitizeString,
  sanitizeNumber
} from '@/lib/security';

export default function CreateGroup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: '',
    frequency: 'monthly' as GroupFrequency,
    contributionAmount: '',
    role: 'president' as MemberRole,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to create a group",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Rate limiting check
      const identifier = getRateLimitIdentifier(user.id);
      const { allowed, retryAfterMs } = checkRateLimit(identifier, RATE_LIMITS.createGroup);
      
      if (!allowed) {
        throw new RateLimitError(retryAfterMs!);
      }

      // Validate and sanitize input
      const validation = validateSchema({
        name: formData.name,
        contributionAmount: parseFloat(formData.contributionAmount) || 0,
        frequency: formData.frequency,
      }, SCHEMAS.createGroup);
      
      if (!validation.valid) {
        throw new ValidationError(validation.errors);
      }

      const sanitizedData = validation.sanitized as { 
        name: string; 
        contributionAmount: number; 
        frequency: string 
      };

      // Debug: Log user info
      console.log('Creating group with user:', {
        userId: user.id,
        userEmail: user.email,
      });

      // Debug: Verify the session is valid
      const { data: sessionData } = await supabase.auth.getSession();
      console.log('Current session:', sessionData?.session?.user?.id);

      if (!sessionData?.session) {
        toast({
          title: "Session expired",
          description: "Please log in again",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const { data: group, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: sanitizedData.name,
          president_id: user.id,
          frequency: sanitizedData.frequency as GroupFrequency,
          contribution_amount: sanitizedData.contributionAmount,
          president_email: user.email!,
        })
        .select()
        .single();

      if (groupError) {
        console.error('Group creation error details:', {
          code: groupError.code,
          message: groupError.message,
          details: groupError.details,
          hint: groupError.hint,
        });
        throw groupError;
      }

      // Add creator as first member with queue position 1 and their chosen role
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          user_id: user.id,
          queue_position: 1,
          status: 'active',
          role: formData.role,
        });

      if (memberError) throw memberError;

      toast({
        title: "Group created!",
        description: `${sanitizedData.name} has been created successfully.`,
      });

      navigate(`/groups/${group.id}`);
    } catch (error: any) {
      if (error instanceof RateLimitError) {
        toast({
          title: "Rate limited",
          description: error.message,
          variant: "destructive",
        });
      } else if (error instanceof ValidationError) {
        // Map errors to fields for display
        const errors: Record<string, string> = {};
        error.fieldErrors.forEach(err => {
          const errLower = err.toLowerCase();
          if (errLower.includes('name')) errors.name = err;
          if (errLower.includes('amount') || errLower.includes('contribution')) errors.contributionAmount = err;
          if (errLower.includes('frequency')) errors.frequency = err;
        });
        setFieldErrors(errors);
        toast({
          title: "Validation error",
          description: "Please fix the errors below",
          variant: "destructive",
        });
      } else {
        console.error('Error creating group:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to create group",
          variant: "destructive",
        });
      }
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
          <h1 className="text-xl font-semibold">Create New Group</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Group Details
            </CardTitle>
            <CardDescription>
              Set up your savings group. You'll be the president and can invite members after creation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Group Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Group Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Family Savings Circle"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={loading}
                  maxLength={100}
                  className={fieldErrors.name ? 'border-destructive' : ''}
                  aria-invalid={!!fieldErrors.name}
                />
                {fieldErrors.name && (
                  <p className="text-sm text-destructive">{fieldErrors.name}</p>
                )}
              </div>

              {/* Contribution Frequency */}
              <div className="space-y-2">
                <Label htmlFor="frequency">Contribution Frequency *</Label>
                <Select
                  value={formData.frequency}
                  onValueChange={(value: GroupFrequency) => setFormData({ ...formData, frequency: value })}
                  disabled={loading}
                >
                  <SelectTrigger id="frequency">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Weekly
                      </div>
                    </SelectItem>
                    <SelectItem value="monthly">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Monthly
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Contribution Amount */}
              <div className="space-y-2">
                <Label htmlFor="amount">Contribution Amount *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="100.00"
                    className="pl-9"
                    value={formData.contributionAmount}
                    onChange={(e) => setFormData({ ...formData, contributionAmount: e.target.value })}
                    disabled={loading}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Each member will contribute this amount per {formData.frequency === 'weekly' ? 'week' : 'month'}
                </p>
              </div>

              {/* Your Role */}
              <div className="space-y-2">
                <Label htmlFor="role">Your Role in the Group *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: MemberRole) => setFormData({ ...formData, role: value })}
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
                  As the group creator, you'll have admin rights regardless of role
                </p>
              </div>

              {/* Info Box */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <h4 className="font-medium text-primary mb-2">How it works</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• You'll be the group president and first in the queue</li>
                  <li>• Share the invite code with members to join</li>
                  <li>• Track payments and verify contributions</li>
                  <li>• Members receive the pot based on queue position</li>
                </ul>
              </div>

              {/* Submit Button */}
              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Group...
                  </>
                ) : (
                  <>
                    <Users className="mr-2 h-4 w-4" />
                    Create Group
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
