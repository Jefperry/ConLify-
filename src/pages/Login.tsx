import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Loader2, Eye, EyeOff, PiggyBank, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { 
  validateSchema, 
  SCHEMAS, 
  checkRateLimit, 
  RATE_LIMITS, 
  getRateLimitIdentifier,
  RateLimitError,
  ValidationError 
} from '@/lib/security';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setLoading(true);

    try {
      // Rate limiting check
      const identifier = getRateLimitIdentifier();
      const { allowed, retryAfterMs } = checkRateLimit(identifier, RATE_LIMITS.login);
      
      if (!allowed) {
        throw new RateLimitError(retryAfterMs!);
      }

      // Validate and sanitize input
      const validation = validateSchema({ email, password }, SCHEMAS.login);
      
      if (!validation.valid) {
        throw new ValidationError(validation.errors);
      }

      const sanitizedData = validation.sanitized as { email: string; password: string };
      const { error } = await signIn(sanitizedData.email, sanitizedData.password);

      if (error) {
        toast.error(error.message);
        setLoading(false);
      } else {
        toast.success('Welcome back!');
        navigate('/dashboard');
      }
    } catch (err) {
      if (err instanceof RateLimitError) {
        toast.error(err.message);
      } else if (err instanceof ValidationError) {
        // Map errors to fields for display
        const errors: Record<string, string> = {};
        err.fieldErrors.forEach(error => {
          if (error.toLowerCase().includes('email')) errors.email = error;
          if (error.toLowerCase().includes('password')) errors.password = error;
        });
        setFieldErrors(errors);
        toast.error('Please fix the errors below');
      } else {
        toast.error('An unexpected error occurred');
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Background decoration */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <header className="flex justify-between items-center p-4 sm:p-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <PiggyBank className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground">ConLify</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md animate-fade-in card-elevated">
          <CardHeader className="space-y-1 pb-6">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <PiggyBank className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold text-center text-foreground">Welcome back</CardTitle>
            <CardDescription className="text-center">
              Sign in to manage your savings groups
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  maxLength={254}
                  className={fieldErrors.email ? 'border-destructive' : ''}
                  aria-invalid={!!fieldErrors.email}
                />
                {fieldErrors.email && (
                  <p className="text-sm text-destructive">{fieldErrors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    maxLength={128}
                    className={fieldErrors.password ? 'border-destructive' : ''}
                    aria-invalid={!!fieldErrors.password}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {fieldErrors.password && (
                  <p className="text-sm text-destructive">{fieldErrors.password}</p>
                )}
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4 pt-2">
              <Button type="submit" className="w-full shadow-soft h-11" disabled={loading}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                Sign In
              </Button>

              <p className="text-sm text-muted-foreground text-center">
                Don't have an account?{' '}
                <Link to="/signup" className="text-primary hover:underline font-medium">
                  Sign up
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </main>

      <footer className="p-6 text-center text-sm text-muted-foreground">
        <p>ConLify is a record-keeping tool and not a financial institution.</p>
      </footer>
    </div>
  );
}
