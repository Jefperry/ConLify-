import * as React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon, FolderOpen, Users, CreditCard, Bell, Search, FileX } from "lucide-react";
import { Button } from "./button";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Icon to display */
  icon?: LucideIcon;
  /** Pre-defined illustration type */
  type?: "groups" | "members" | "payments" | "notifications" | "search" | "default";
  /** Main heading */
  title: string;
  /** Description text */
  description?: string;
  /** Primary action button */
  action?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "outline" | "secondary";
  };
  /** Secondary action button */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Size variant */
  size?: "sm" | "md" | "lg";
}

const typeIcons: Record<string, LucideIcon> = {
  groups: Users,
  members: Users,
  payments: CreditCard,
  notifications: Bell,
  search: Search,
  default: FolderOpen,
};

const sizeStyles = {
  sm: {
    container: "py-8",
    icon: "h-10 w-10",
    iconContainer: "h-16 w-16",
    title: "text-base",
    description: "text-sm",
  },
  md: {
    container: "py-12",
    icon: "h-12 w-12",
    iconContainer: "h-20 w-20",
    title: "text-lg",
    description: "text-sm",
  },
  lg: {
    container: "py-16",
    icon: "h-16 w-16",
    iconContainer: "h-24 w-24",
    title: "text-xl",
    description: "text-base",
  },
};

/**
 * EmptyState - A component to display when there's no data
 * 
 * Features:
 * - Pre-defined illustrations for common empty states
 * - Customizable icon
 * - Action buttons
 * - Multiple size variants
 */
export function EmptyState({
  icon: CustomIcon,
  type = "default",
  title,
  description,
  action,
  secondaryAction,
  size = "md",
  className,
  ...props
}: EmptyStateProps) {
  const Icon = CustomIcon || typeIcons[type];
  const styles = sizeStyles[size];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        styles.container,
        className
      )}
      {...props}
    >
      {/* Illustrated icon */}
      <div
        className={cn(
          "mb-6 flex items-center justify-center rounded-full",
          "bg-gradient-to-br from-muted to-secondary/50",
          styles.iconContainer
        )}
      >
        <Icon className={cn("text-muted-foreground/60", styles.icon)} />
      </div>

      {/* Text content */}
      <h3 className={cn("font-semibold text-foreground", styles.title)}>
        {title}
      </h3>
      {description && (
        <p
          className={cn(
            "mt-2 max-w-md text-muted-foreground",
            styles.description
          )}
        >
          {description}
        </p>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="mt-6 flex items-center gap-3">
          {action && (
            <Button
              onClick={action.onClick}
              variant={action.variant || "default"}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button onClick={secondaryAction.onClick} variant="ghost">
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * EmptyStateCard - EmptyState wrapped in a card
 */
export function EmptyStateCard({
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div className={cn("card-elevated", className)}>
      <EmptyState {...props} />
    </div>
  );
}

/**
 * NoResults - Pre-configured empty state for search results
 */
export function NoResults({
  query,
  onClear,
  className,
}: {
  query?: string;
  onClear?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      type="search"
      title="No results found"
      description={
        query
          ? `We couldn't find anything matching "${query}". Try adjusting your search.`
          : "Try adjusting your filters or search terms."
      }
      action={
        onClear
          ? { label: "Clear search", onClick: onClear, variant: "outline" }
          : undefined
      }
      size="sm"
      className={className}
    />
  );
}
