import * as React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The main title/label of the stat */
  title: string;
  /** The primary value to display */
  value: string | number;
  /** Optional subtitle or additional context */
  subtitle?: string;
  /** Optional icon component */
  icon?: LucideIcon;
  /** Color variant for the icon background */
  variant?: "default" | "primary" | "success" | "warning" | "destructive" | "accent";
  /** Trend indicator: positive, negative, or neutral */
  trend?: {
    value: string;
    direction: "up" | "down" | "neutral";
  };
  /** Loading state */
  loading?: boolean;
}

const variantStyles = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  accent: "bg-accent/10 text-accent",
};

const trendStyles = {
  up: "text-success",
  down: "text-destructive",
  neutral: "text-muted-foreground",
};

/**
 * StatCard - A card component for displaying key metrics and statistics
 * 
 * Features:
 * - Multiple color variants
 * - Optional icon with colored background
 * - Trend indicators
 * - Loading skeleton state
 */
export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "default",
  trend,
  loading = false,
  className,
  ...props
}: StatCardProps) {
  if (loading) {
    return (
      <div
        className={cn(
          "card-elevated flex flex-col gap-4",
          className
        )}
        {...props}
      >
        <div className="flex items-start justify-between">
          <div className="skeleton h-4 w-24 rounded" />
          <div className="skeleton h-10 w-10 rounded-xl" />
        </div>
        <div className="space-y-2">
          <div className="skeleton h-8 w-32 rounded" />
          <div className="skeleton h-4 w-20 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "card-elevated flex flex-col gap-4 transition-all duration-300",
        "hover:shadow-soft-md hover:border-border",
        className
      )}
      {...props}
    >
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          {title}
        </span>
        {Icon && (
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl",
              variantStyles[variant]
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-2xl font-bold tracking-tight text-foreground">
          {value}
        </p>
        
        <div className="flex items-center gap-2">
          {trend && (
            <span
              className={cn(
                "text-xs font-medium flex items-center gap-1",
                trendStyles[trend.direction]
              )}
            >
              {trend.direction === "up" && (
                <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                  <path d="M6 2L10 6H7V10H5V6H2L6 2Z" fill="currentColor" />
                </svg>
              )}
              {trend.direction === "down" && (
                <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                  <path d="M6 10L2 6H5V2H7V6H10L6 10Z" fill="currentColor" />
                </svg>
              )}
              {trend.value}
            </span>
          )}
          {subtitle && (
            <span className="text-xs text-muted-foreground">
              {subtitle}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * StatCardGrid - A responsive grid container for StatCards
 */
export function StatCardGrid({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
