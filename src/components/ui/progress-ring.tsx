import * as React from "react";
import { cn } from "@/lib/utils";

export interface ProgressRingProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Progress value from 0 to 100 */
  value: number;
  /** Size of the ring in pixels */
  size?: number;
  /** Stroke width of the ring */
  strokeWidth?: number;
  /** Color variant */
  variant?: "default" | "primary" | "success" | "warning" | "destructive";
  /** Whether to show the percentage in the center */
  showValue?: boolean;
  /** Custom label to show instead of percentage */
  label?: string;
  /** Secondary label below the main value */
  sublabel?: string;
  /** Whether to animate the progress */
  animated?: boolean;
}

const variantColors = {
  default: "stroke-muted-foreground",
  primary: "stroke-primary",
  success: "stroke-success",
  warning: "stroke-warning",
  destructive: "stroke-destructive",
};

const variantTextColors = {
  default: "text-foreground",
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
};

/**
 * ProgressRing - A circular progress indicator
 * 
 * Features:
 * - Smooth animations
 * - Multiple color variants
 * - Customizable size and stroke width
 * - Optional center label
 */
export function ProgressRing({
  value,
  size = 120,
  strokeWidth = 8,
  variant = "primary",
  showValue = true,
  label,
  sublabel,
  animated = true,
  className,
  ...props
}: ProgressRingProps) {
  const normalizedValue = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (normalizedValue / 100) * circumference;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      {...props}
    >
      {/* Background circle */}
      <svg
        className="absolute inset-0 -rotate-90 transform"
        width={size}
        height={size}
      >
        <circle
          className="stroke-muted"
          fill="none"
          strokeWidth={strokeWidth}
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Progress circle */}
        <circle
          className={cn(
            variantColors[variant],
            animated && "transition-all duration-1000 ease-out"
          )}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: animated ? offset : offset,
          }}
        />
      </svg>

      {/* Center content */}
      {(showValue || label) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              "font-bold",
              variantTextColors[variant],
              size >= 120 ? "text-2xl" : size >= 80 ? "text-lg" : "text-sm"
            )}
          >
            {label || `${Math.round(normalizedValue)}%`}
          </span>
          {sublabel && (
            <span
              className={cn(
                "text-muted-foreground",
                size >= 120 ? "text-xs" : "text-[10px]"
              )}
            >
              {sublabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * MiniProgressRing - A smaller version for inline use
 */
export function MiniProgressRing({
  value,
  variant = "primary",
  className,
}: {
  value: number;
  variant?: ProgressRingProps["variant"];
  className?: string;
}) {
  return (
    <ProgressRing
      value={value}
      size={32}
      strokeWidth={3}
      variant={variant}
      showValue={false}
      animated={true}
      className={className}
    />
  );
}

/**
 * ProgressRingWithLabel - Progress ring with external label
 */
export function ProgressRingWithLabel({
  value,
  title,
  subtitle,
  size = 140,
  variant = "primary",
  className,
}: {
  value: number;
  title: string;
  subtitle?: string;
  size?: number;
  variant?: ProgressRingProps["variant"];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <ProgressRing
        value={value}
        size={size}
        variant={variant}
        showValue={true}
      />
      <div className="text-center">
        <p className="font-semibold text-foreground">{title}</p>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
