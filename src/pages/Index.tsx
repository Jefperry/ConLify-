import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FloatingCards } from '@/components/landing/FloatingCards';
import { 
  ArrowRight,
  PiggyBank,
  Bell,
  CheckCircle,
  Lock,
  Users,
  BarChart3,
  Clock,
  Twitter,
  Linkedin,
  Github
} from 'lucide-react';

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 50 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' }
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

export default function IndexPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');

  const handleGetStarted = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/signup${email ? `?email=${encodeURIComponent(email)}` : ''}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      {/* Header */}
      <header className="bg-[#F8FAFC] sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-5 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-green-500 flex items-center justify-center">
              <PiggyBank className="h-5 w-5 text-white" strokeWidth={1.5} />
            </div>
            <span className="text-xl font-bold text-black">ConLify</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-slate-600 hover:text-black transition-colors text-sm font-medium">Features</a>
            <a href="#how-it-works" className="text-slate-600 hover:text-black transition-colors text-sm font-medium">How it Works</a>
          </nav>

          <div className="flex items-center gap-3">
            {loading ? null : user ? (
              <Button asChild className="bg-green-500 hover:bg-green-600 text-white rounded-full px-6">
                <Link to="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="ghost" asChild className="text-slate-600 hover:text-black">
                  <Link to="/login">Login</Link>
                </Button>
                <Button asChild className="bg-green-500 hover:bg-green-600 text-white rounded-full px-6">
                  <Link to="/signup">Sign Up</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section - Asymmetric Layout */}
        <section className="relative overflow-hidden pt-16 pb-24 lg:pt-24 lg:pb-32">
          {/* Subtle background gradient */}
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-bl from-green-50 to-transparent rounded-full blur-3xl -z-10" />
          
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
              {/* Left Column - Text & CTA */}
              <motion.div
                initial="hidden"
                animate="visible"
                variants={fadeInUp}
                className="max-w-xl"
              >
                <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-bold text-black leading-[1.1] tracking-tight mb-6">
                  Keep your savings group on track{' '}
                  <span className="text-green-500">automatically.</span>
                </h1>
                
                <p className="text-lg text-slate-600 leading-relaxed mb-10">
                  Manage contributions, send reminders, and keep everyone accountable 
                  with simple tools designed for savings circles and ROSCAs.
                </p>
                
                {/* Pill-style Email Input */}
                <form onSubmit={handleGetStarted} className="flex gap-0 mb-8">
                  <div className="relative flex-1 max-w-md">
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-14 pl-5 pr-36 rounded-full border-slate-200 bg-white text-black placeholder:text-slate-400 focus-visible:ring-green-500"
                    />
                    <Button 
                      type="submit"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-green-500 hover:bg-green-600 text-white rounded-full px-6 h-11"
                    >
                      Get Started
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </form>

                {/* Trust indicators */}
                <div className="flex items-center gap-6 text-sm text-slate-500">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" strokeWidth={1.5} />
                    <span>Free to use</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" strokeWidth={1.5} />
                    <span>No credit card</span>
                  </div>
                </div>
              </motion.div>

              {/* Right Column - Floating Cards */}
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="relative hidden lg:block"
              >
                <FloatingCards />
              </motion.div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 lg:py-32 bg-white">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeInUp}
              className="max-w-3xl mb-16"
            >
              <span className="text-green-500 text-sm font-semibold uppercase tracking-wider mb-4 block">
                Features
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-black leading-tight mb-4">
                Experience that grows with your group.
              </h2>
              <p className="text-lg text-slate-600 leading-relaxed">
                Design a savings system that works for your community with intuitive tools and streamlined contribution management.
              </p>
            </motion.div>
            
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainer}
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-12"
            >
              <FeatureCard
                icon={Bell}
                title="Automatic reminders"
                description="Create a seamless experience and automate payment reminders by scheduling them before each due date."
              />
              <FeatureCard
                icon={Users}
                title="Multiple groups"
                description="Run multiple savings circles from one account and manage contributions across all your communities."
              />
              <FeatureCard
                icon={Lock}
                title="Fair accountability"
                description="Securely manage your groups with automatic lockouts, member verification, and transparent payment tracking."
              />
              <FeatureCard
                icon={BarChart3}
                title="Track everything"
                description="See payment history at a glance. Know exactly where you stand with detailed analytics and reports."
              />
              <FeatureCard
                icon={Clock}
                title="Flexible scheduling"
                description="Weekly or monthly — your group decides. Customize contribution amounts and dates that work for everyone."
              />
              <FeatureCard
                icon={CheckCircle}
                title="Payment verification"
                description="Members mark payments as sent, presidents verify them. Simple, transparent, and builds trust."
              />
            </motion.div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-24 lg:py-32 bg-[#F8FAFC]">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeInUp}
              className="text-center mb-16"
            >
              <span className="text-green-500 text-sm font-semibold uppercase tracking-wider mb-4 block">
                How It Works
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-black mb-4">
                Get started in minutes
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Setting up your savings group has never been easier.
              </p>
            </motion.div>
            
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainer}
              className="grid md:grid-cols-3 gap-8 lg:gap-12 max-w-5xl mx-auto"
            >
              <StepCard
                number="01"
                title="Create Your Group"
                description="Sign up free and create your savings group in seconds. Set your contribution amount and schedule."
              />
              <StepCard
                number="02"
                title="Invite Members"
                description="Share your unique invite code with trusted friends and family. They join with one click."
              />
              <StepCard
                number="03"
                title="Start Saving"
                description="Begin your first cycle. ConLify handles reminders, tracking, and verification automatically."
              />
            </motion.div>
          </div>
        </section>

        {/* Dark CTA Section */}
        <section className="py-20 lg:py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeInUp}
              className="bg-gradient-to-br from-black via-slate-900 to-black rounded-3xl p-12 lg:p-16 relative overflow-hidden"
            >
              {/* Subtle gradient overlay */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-green-500/10 rounded-full blur-3xl" />
              
              <div className="relative z-10 max-w-2xl">
                <span className="text-green-400 text-sm font-semibold uppercase tracking-wider mb-4 block">
                  Start Now
                </span>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-4">
                  Ready to level up your savings group?
                </h2>
                <p className="text-lg text-slate-400 mb-8 leading-relaxed">
                  Join groups who trust ConLify to manage their contributions. Create your account and invite members in under 5 minutes.
                </p>
                <Button 
                  size="lg"
                  asChild 
                  className="bg-green-500 hover:bg-green-600 text-white rounded-full px-8 h-12 text-base"
                >
                  <Link to="/signup">
                    Get Started Now
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer - Multi-column */}
      <footer className="bg-[#F8FAFC] border-t border-slate-100 py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12 mb-12">
            {/* Logo Column */}
            <div className="col-span-2 md:col-span-1">
              <Link to="/" className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl bg-green-500 flex items-center justify-center">
                  <PiggyBank className="h-5 w-5 text-white" strokeWidth={1.5} />
                </div>
                <span className="text-xl font-bold text-black">ConLify</span>
              </Link>
              <p className="text-sm text-slate-500 leading-relaxed">
                Simple tools for savings groups.
              </p>
            </div>

            {/* Product Column */}
            <div>
              <h4 className="font-semibold text-black mb-4 text-sm">Product</h4>
              <ul className="space-y-3 text-sm text-slate-500">
                <li><a href="#features" className="hover:text-green-500 transition-colors">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-green-500 transition-colors">How it Works</a></li>
                <li><Link to="/signup" className="hover:text-green-500 transition-colors">Get Started</Link></li>
              </ul>
            </div>

            {/* Company Column */}
            <div>
              <h4 className="font-semibold text-black mb-4 text-sm">Company</h4>
              <ul className="space-y-3 text-sm text-slate-500">
                <li><a href="#" className="hover:text-green-500 transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-green-500 transition-colors">Contact</a></li>
              </ul>
            </div>

            {/* Legal Column */}
            <div>
              <h4 className="font-semibold text-black mb-4 text-sm">Legal</h4>
              <ul className="space-y-3 text-sm text-slate-500">
                <li><a href="#" className="hover:text-green-500 transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-green-500 transition-colors">Terms</a></li>
              </ul>
            </div>

            {/* Social Column */}
            <div>
              <h4 className="font-semibold text-black mb-4 text-sm">Follow us</h4>
              <div className="flex items-center gap-4">
                <a href="#" className="text-slate-400 hover:text-green-500 transition-colors">
                  <Twitter className="h-5 w-5" strokeWidth={1.5} />
                </a>
                <a href="#" className="text-slate-400 hover:text-green-500 transition-colors">
                  <Linkedin className="h-5 w-5" strokeWidth={1.5} />
                </a>
                <a href="#" className="text-slate-400 hover:text-green-500 transition-colors">
                  <Github className="h-5 w-5" strokeWidth={1.5} />
                </a>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              © ConLify 2026. All Rights Reserved.
            </p>
            <p className="text-xs text-slate-400 max-w-md text-center sm:text-right">
              ConLify is a record-keeping tool and not a financial institution. It does not hold or transfer funds.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Feature Card Component - Finpay Style
function FeatureCard({ 
  icon: Icon, 
  title, 
  description
}: { 
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string; 
  description: string;
}) {
  return (
    <motion.div variants={fadeInUp} className="group">
      <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-5 group-hover:bg-green-50 group-hover:border-green-100 transition-colors">
        <Icon className="h-6 w-6 text-slate-700 group-hover:text-green-600 transition-colors" strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-semibold text-black mb-2">{title}</h3>
      <p className="text-slate-600 leading-relaxed">{description}</p>
    </motion.div>
  );
}

// Step Card Component - Finpay Style
function StepCard({
  number,
  title,
  description
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <motion.div variants={fadeInUp} className="text-center">
      <div className="text-6xl font-bold text-green-500/20 mb-4">{number}</div>
      <h3 className="text-xl font-semibold text-black mb-3">{title}</h3>
      <p className="text-slate-600 leading-relaxed">{description}</p>
    </motion.div>
  );
}
