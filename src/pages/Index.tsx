import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { 
  Shield, 
  Users, 
  Bell, 
  CheckCircle, 
  ArrowRight,
  Wallet,
  Lock,
  Clock,
  PiggyBank,
  TrendingUp,
  UserPlus,
  CalendarCheck,
  BarChart3,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function IndexPage() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <PiggyBank className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">ConLify</span>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {!loading && (
              user ? (
                <Button asChild className="shadow-soft">
                  <Link to="/dashboard">Dashboard</Link>
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" asChild>
                    <Link to="/login">Sign In</Link>
                  </Button>
                  <Button asChild className="shadow-soft">
                    <Link to="/signup">Get Started</Link>
                  </Button>
                </div>
              )
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
          </div>
          
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
            <div className="max-w-4xl mx-auto text-center">
              <div className="animate-fade-in">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-8 shadow-soft">
                  <Sparkles className="h-4 w-4" />
                  Trusted by 1,000+ savings groups
                </div>
                
                {/* Headline */}
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 tracking-tight text-foreground">
                  Manage Your Savings Circle{' '}
                  <span className="text-gradient">with Confidence</span>
                </h1>
                
                {/* Subheadline */}
                <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
                  ConLify is the modern digital ledger for ROSCA groups. Automate reminders, 
                  track contributions, and bring complete transparency to your savings circle.
                </p>
                
                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
                  <Button size="lg" asChild className="shadow-soft-md hover:shadow-soft-lg transition-shadow text-base px-8">
                    <Link to="/signup">
                      Start Free Today
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild className="text-base px-8">
                    <Link to="/login">Sign In to Dashboard</Link>
                  </Button>
                </div>
                
                {/* Trust indicators */}
                <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-success" />
                    <span>Free to use</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-success" />
                    <span>Secure and private</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-success" />
                    <span>Unlimited members</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="border-y border-border/50 bg-card/50">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              <StatItem value="$2.5M+" label="Contributions Tracked" />
              <StatItem value="1,000+" label="Active Groups" />
              <StatItem value="15,000+" label="Members" />
              <StatItem value="99.9%" label="Uptime" />
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 lg:py-28">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">
                Everything you need to run your group
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                ConLify handles the tedious parts so you can focus on what matters - building trust within your savings circle.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              <FeatureCard
                icon={Bell}
                title="Smart Reminders"
                description="Automatic payment reminders keep everyone on track. No more awkward follow-ups."
                gradient="from-blue-500/10 to-cyan-500/10"
                iconColor="text-blue-500"
              />
              <FeatureCard
                icon={CheckCircle}
                title="Payment Verification"
                description="Members mark payments as sent, presidents verify against bank records. Simple and transparent."
                gradient="from-green-500/10 to-emerald-500/10"
                iconColor="text-green-500"
              />
              <FeatureCard
                icon={Lock}
                title="Automatic Lockouts"
                description="Three missed payments triggers lockout. Fair enforcement without uncomfortable conversations."
                gradient="from-red-500/10 to-orange-500/10"
                iconColor="text-red-500"
              />
              <FeatureCard
                icon={Users}
                title="Queue Management"
                description="Transparent payout order visible to all members. Everyone knows exactly when their turn comes."
                gradient="from-purple-500/10 to-pink-500/10"
                iconColor="text-purple-500"
              />
              <FeatureCard
                icon={BarChart3}
                title="Real-time Analytics"
                description="Track contributions, view payment history, and monitor group health with detailed dashboards."
                gradient="from-amber-500/10 to-yellow-500/10"
                iconColor="text-amber-500"
              />
              <FeatureCard
                icon={Clock}
                title="Flexible Scheduling"
                description="Weekly or monthly contribution cycles. Customize dates and amounts to fit your group's needs."
                gradient="from-indigo-500/10 to-violet-500/10"
                iconColor="text-indigo-500"
              />
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-20 lg:py-28 bg-card/50 border-y border-border/50">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">
                Get started in minutes
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Setting up your savings group has never been easier. Follow these simple steps.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 lg:gap-12 max-w-5xl mx-auto">
              <StepCard
                number={1}
                icon={UserPlus}
                title="Create Your Group"
                description="Sign up free and create your savings group in seconds. Set your contribution amount and schedule."
              />
              <StepCard
                number={2}
                icon={Users}
                title="Invite Members"
                description="Share your unique invite code with trusted friends and family. They join with one click."
              />
              <StepCard
                number={3}
                icon={CalendarCheck}
                title="Start Saving"
                description="Begin your first cycle. ConLify handles reminders, tracking, and verification automatically."
              />
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 lg:py-28">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto text-center">
              <div className="card-elevated p-8 sm:p-12 lg:p-16 bg-gradient-to-br from-primary/5 via-card to-accent/5">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <TrendingUp className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">
                  Ready to transform your savings group?
                </h2>
                <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
                  Join thousands of groups who trust ConLify to manage their contributions. 
                  Create your account and invite members in under 5 minutes.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button size="lg" asChild className="shadow-soft-md text-base px-8">
                    <Link to="/signup">
                      Create Your Group Free
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-card/50 py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <PiggyBank className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-foreground">ConLify</span>
            </div>
            <p className="text-sm text-muted-foreground text-center md:text-left max-w-md">
              ConLify is a record-keeping tool and not a financial institution. 
              It does not hold or transfer funds.
            </p>
            <p className="text-sm text-muted-foreground">
              © 2026 ConLify. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Stat Item Component
function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-3xl sm:text-4xl font-bold text-foreground mb-1">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

// Feature Card Component
function FeatureCard({ 
  icon: Icon, 
  title, 
  description,
  gradient,
  iconColor
}: { 
  icon: React.ComponentType<{ className?: string }>;
  title: string; 
  description: string;
  gradient?: string;
  iconColor?: string;
}) {
  return (
    <div className={cn(
      "group p-6 rounded-2xl border border-border/50 bg-card",
      "hover:shadow-soft-md hover:border-border transition-all duration-300",
      "hover:-translate-y-1"
    )}>
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center mb-4",
        "bg-gradient-to-br",
        gradient || "from-primary/10 to-primary/5"
      )}>
        <Icon className={cn("h-6 w-6", iconColor || "text-primary")} />
      </div>
      <h3 className="text-lg font-semibold mb-2 text-foreground">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

// Step Card Component
function StepCard({
  number,
  icon: Icon,
  title,
  description
}: {
  number: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="relative text-center">
      {/* Connection line (hidden on mobile and last item) */}
      <div className="hidden md:block absolute top-8 left-1/2 w-full h-0.5 bg-gradient-to-r from-primary/20 to-primary/5 -z-10 last:hidden" />
      
      <div className="inline-flex flex-col items-center">
        <div className="relative mb-6">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Icon className="h-7 w-7 text-primary" />
          </div>
          <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center shadow-soft">
            {number}
          </div>
        </div>
        <h3 className="text-lg font-semibold mb-2 text-foreground">{title}</h3>
        <p className="text-muted-foreground leading-relaxed max-w-xs">{description}</p>
      </div>
    </div>
  );
}
