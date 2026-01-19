import * as React from "react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { ChevronRight, ArrowLeft } from "lucide-react";
import { Button } from "./button";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Page title */
  title: string;
  /** Optional description/subtitle */
  description?: string;
  /** Breadcrumb items */
  breadcrumbs?: BreadcrumbItem[];
  /** Back button configuration */
  backButton?: {
    href: string;
    label?: string;
  };
  /** Actions to display on the right side */
  actions?: React.ReactNode;
  /** Whether the header should be sticky */
  sticky?: boolean;
}

/**
 * PageHeader - A consistent page header component
 * 
 * Features:
 * - Breadcrumb navigation
 * - Back button support
 * - Action buttons area
 * - Sticky positioning option
 */
export function PageHeader({
  title,
  description,
  breadcrumbs,
  backButton,
  actions,
  sticky = false,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "border-b border-border bg-background/95 backdrop-blur-sm",
        sticky && "sticky top-0 z-40",
        className
      )}
      {...props}
    >
      <div className="container mx-auto px-4 py-4 sm:py-6">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="mb-3 flex items-center gap-1 text-sm text-muted-foreground">
            {breadcrumbs.map((item, index) => (
              <React.Fragment key={index}>
                {index > 0 && <ChevronRight className="h-4 w-4" />}
                {item.href ? (
                  <Link
                    to={item.href}
                    className="hover:text-foreground transition-colors"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-foreground font-medium">
                    {item.label}
                  </span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}

        {/* Main header row */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            {/* Back button */}
            {backButton && (
              <Button variant="ghost" size="icon" asChild className="-ml-2">
                <Link to={backButton.href}>
                  <ArrowLeft className="h-5 w-5" />
                  <span className="sr-only">{backButton.label || "Go back"}</span>
                </Link>
              </Button>
            )}

            {/* Title and description */}
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {title}
              </h1>
              {description && (
                <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                  {description}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          {actions && (
            <div className="flex items-center gap-2 sm:gap-3">
              {actions}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * PageHeaderSimple - A simpler version with just back button and title
 */
export function PageHeaderSimple({
  title,
  backHref,
  actions,
  className,
}: {
  title: string;
  backHref: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50",
        className
      )}
    >
      <div className="container mx-auto px-4 py-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={backHref}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-xl font-semibold flex-1">{title}</h1>
        {actions}
      </div>
    </header>
  );
}

/**
 * SectionHeader - A header for sections within a page
 */
export function SectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
