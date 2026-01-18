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
  Clock
} from 'lucide-react';

export default function IndexPage() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">ConLify</h1>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {!loading && (
              user ? (
                <Button asChild>
                  <Link to="/dashboard">Dashboard</Link>
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" asChild>
                    <Link to="/login">Sign In</Link>
                  </Button>
                  <Button asChild>
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
        <section className="container mx-auto px-4 py-20 text-center">
          <div className="max-w-3xl mx-auto animate-fade-in">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Shield className="h-4 w-4" />
              Trusted by savings groups worldwide
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">
              Simplify Your{' '}
              <span className="text-primary">Social Savings</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              A digital ledger for ROSCA groups that automates reminders, tracks contributions, 
              and brings transparency to your savings circle.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild>
                <Link to="/signup">
                  Start Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/login">Sign In</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="bg-card border-y py-20">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">
              Everything you need to manage your group
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <FeatureCard
                icon={<Bell className="h-6 w-6" />}
                title="Automated Reminders"
                description="Never chase payments again. Members get notified 24 hours before each due date."
              />
              <FeatureCard
                icon={<CheckCircle className="h-6 w-6" />}
                title="Honor System Tracking"
                description="Members mark payments as sent, presidents verify against their bank records."
              />
              <FeatureCard
                icon={<Lock className="h-6 w-6" />}
                title="Automatic Lockouts"
                description="Three missed payments triggers automatic lockout. Fair enforcement without awkward conversations."
              />
              <FeatureCard
                icon={<Users className="h-6 w-6" />}
                title="Queue Management"
                description="Transparent payout order visible to all members. No disputes about who's next."
              />
              <FeatureCard
                icon={<Wallet className="h-6 w-6" />}
                title="Contribution Tracking"
                description="Real-time dashboard showing total savings, pending payments, and verification status."
              />
              <FeatureCard
                icon={<Clock className="h-6 w-6" />}
                title="Flexible Cycles"
                description="Support for weekly or monthly contribution schedules to match your group's needs."
              />
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 py-20 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold mb-4">Ready to simplify your savings group?</h2>
            <p className="text-muted-foreground mb-8">
              Create your free account and invite your group members in minutes.
            </p>
            <Button size="lg" asChild>
              <Link to="/signup">
                Create Your Group
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-card py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p className="mb-2">
            ConLify is a record-keeping tool and not a financial institution. 
            It does not hold or transfer funds.
          </p>
          <p>© 2026 ConLify. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ 
  icon, 
  title, 
  description 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string;
}) {
  return (
    <div className="p-6 rounded-lg border bg-background hover:shadow-md transition-shadow">
      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
