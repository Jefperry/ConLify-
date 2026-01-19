import * as React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon, ArrowUpRight, ArrowDownLeft, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";

export interface TransactionItemProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Transaction title/description */
  title: string;
  /** Optional subtitle (e.g., member name, category) */
  subtitle?: string;
  /** Transaction amount */
  amount: number;
  /** Currency symbol */
  currency?: string;
  /** Transaction type affects the amount color */
  type?: "incoming" | "outgoing" | "neutral";
  /** Transaction status */
  status?: "pending" | "verified" | "rejected" | "unpaid";
  /** Transaction date */
  date?: Date | string;
  /** Custom icon override */
  icon?: LucideIcon;
  /** Icon background color variant */
  iconVariant?: "default" | "primary" | "success" | "warning" | "destructive";
  /** Whether to show the full date or relative time */
  showFullDate?: boolean;
  /** Click handler */
  onClick?: () => void;
}

const statusConfig = {
  pending: {
    icon: Clock,
    color: "bg-warning/10 text-warning",
    label: "Pending",
  },
  verified: {
    icon: CheckCircle2,
    color: "bg-success/10 text-success",
    label: "Verified",
  },
  rejected: {
    icon: XCircle,
    color: "bg-destructive/10 text-destructive",
    label: "Rejected",
  },
  unpaid: {
    icon: AlertCircle,
    color: "bg-muted text-muted-foreground",
    label: "Unpaid",
  },
};

const iconVariantStyles = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
};

/**
 * TransactionItem - A styled list item for transactions/payments
 * 
 * Features:
 * - Status indicators with icons
 * - Amount formatting with color coding
 * - Date display
 * - Hover effects
 */
export function TransactionItem({
  title,
  subtitle,
  amount,
  currency = "$",
  type = "neutral",
  status,
  date,
  icon: CustomIcon,
  iconVariant = "default",
  showFullDate = false,
  onClick,
  className,
  ...props
}: TransactionItemProps) {
  const StatusIcon = status ? statusConfig[status].icon : null;
  const Icon = CustomIcon || (type === "incoming" ? ArrowDownLeft : type === "outgoing" ? ArrowUpRight : null);

  const formattedDate = date
    ? showFullDate
      ? format(new Date(date), "MMM d, yyyy")
      : format(new Date(date), "MMM d")
    : null;

  const formattedAmount = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));

  return (
    <div
      className={cn(
        "flex items-center gap-4 p-4 rounded-xl transition-all duration-200",
        "hover:bg-muted/50",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      {...props}
    >
      {/* Icon */}
      {Icon && (
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            iconVariantStyles[iconVariant]
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-foreground truncate">{title}</p>
          {status && (
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                statusConfig[status].color
              )}
            >
              {StatusIcon && <StatusIcon className="h-3 w-3" />}
              {statusConfig[status].label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {subtitle && (
            <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
          )}
          {formattedDate && (
            <>
              {subtitle && <span className="text-muted-foreground">·</span>}
              <p className="text-sm text-muted-foreground">{formattedDate}</p>
            </>
          )}
        </div>
      </div>

      {/* Amount */}
      <div className="shrink-0 text-right">
        <p
          className={cn(
            "font-semibold",
            type === "incoming" && "text-success",
            type === "outgoing" && "text-destructive",
            type === "neutral" && "text-foreground"
          )}
        >
          {type === "incoming" && "+"}
          {type === "outgoing" && "-"}
          {currency}
          {formattedAmount}
        </p>
      </div>
    </div>
  );
}

/**
 * TransactionList - A container for TransactionItems
 */
export function TransactionList({
  children,
  title,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { title?: string }) {
  return (
    <div className={cn("space-y-1", className)} {...props}>
      {title && (
        <h3 className="text-sm font-medium text-muted-foreground px-4 py-2">
          {title}
        </h3>
      )}
      <div className="divide-y divide-border/50">{children}</div>
    </div>
  );
}

/**
 * TransactionItemSkeleton - Loading state for TransactionItem
 */
export function TransactionItemSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4">
      <div className="skeleton h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-4 w-32 rounded" />
        <div className="skeleton h-3 w-24 rounded" />
      </div>
      <div className="skeleton h-5 w-16 rounded" />
    </div>
  );
}
