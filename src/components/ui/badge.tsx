"use client";

import type { HTMLAttributes } from "react";

type BadgeVariant = "default" | "secondary";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-slate-900 text-white",
  secondary: "bg-slate-200 text-slate-800",
};

export const Badge = ({
  className = "",
  variant = "default",
  ...props
}: BadgeProps) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
      variantStyles[variant]
    } ${className}`}
    {...props}
  />
);
