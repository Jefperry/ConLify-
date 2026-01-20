import { motion } from 'framer-motion';
import { Users, DollarSign, CheckCircle, Bell, Crown } from 'lucide-react';

// Finpay-style card shadow and styling
const cardStyles = {
  base: "bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-slate-100",
};

// Group Status Card - Shows payment progress
function GroupStatusCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, rotate: -3 }}
      animate={{ opacity: 1, y: 0, rotate: -3 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className={`${cardStyles.base} p-5 w-[280px] absolute top-0 right-12 z-10`}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
          <Users className="h-5 w-5 text-white" strokeWidth={1.5} />
        </div>
        <div>
          <p className="font-semibold text-black text-sm">Family Savings</p>
          <p className="text-xs text-slate-500">8 members</p>
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">This Cycle</span>
          <span className="font-semibold text-black">$2,400</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2">
          <div className="bg-green-500 h-2 rounded-full" style={{ width: '75%' }} />
        </div>
        <div className="flex justify-between text-xs text-slate-500">
          <span>6 of 8 paid</span>
          <span className="text-green-600 font-medium">75%</span>
        </div>
      </div>
    </motion.div>
  );
}

// Payment Card - Shows contribution amount
function PaymentCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, rotate: 2 }}
      animate={{ opacity: 1, y: 0, rotate: 2 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      className={`${cardStyles.base} p-5 w-[260px] absolute top-28 right-0 z-20`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Contribution</span>
        <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Due in 5 days</span>
      </div>
      
      <div className="flex items-baseline gap-1 mb-4">
        <span className="text-3xl font-bold text-black">$300</span>
        <span className="text-slate-500 text-sm">/month</span>
      </div>
      
      <div className="flex items-center gap-2">
        <div className="flex -space-x-2">
          {[...Array(4)].map((_, i) => (
            <div 
              key={i} 
              className="w-7 h-7 rounded-full bg-gradient-to-br from-green-400 to-green-600 border-2 border-white flex items-center justify-center"
            >
              <span className="text-[10px] text-white font-medium">
                {['JD', 'SM', 'AK', 'RB'][i]}
              </span>
            </div>
          ))}
        </div>
        <span className="text-xs text-slate-500">+4 others</span>
      </div>
    </motion.div>
  );
}

// Notification Card - Shows activity
function NotificationCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, rotate: -1 }}
      animate={{ opacity: 1, y: 0, rotate: -1 }}
      transition={{ duration: 0.6, delay: 0.6 }}
      className={`${cardStyles.base} p-4 w-[240px] absolute top-64 right-20 z-30`}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
          <CheckCircle className="h-4 w-4 text-green-600" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-black">Payment Verified</p>
          <p className="text-xs text-slate-500 mt-0.5">Sarah just paid $300</p>
          <p className="text-xs text-slate-400 mt-1">2 min ago</p>
        </div>
      </div>
    </motion.div>
  );
}

// Queue Position Card
function QueueCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, rotate: 3 }}
      animate={{ opacity: 1, y: 0, rotate: 3 }}
      transition={{ duration: 0.6, delay: 0.8 }}
      className={`${cardStyles.base} p-4 w-[220px] absolute top-[340px] right-4 z-20`}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center">
          <Crown className="h-5 w-5 text-yellow-400" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-xs text-slate-500">Next Payout</p>
          <p className="text-sm font-semibold text-black">You're #2 in queue</p>
        </div>
      </div>
    </motion.div>
  );
}

// Main floating cards component
export function FloatingCards() {
  return (
    <div className="relative w-full h-[450px]">
      <GroupStatusCard />
      <PaymentCard />
      <NotificationCard />
      <QueueCard />
    </div>
  );
}
