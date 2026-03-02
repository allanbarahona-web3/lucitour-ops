"use client";

import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "default" | "outline" | "secondary";

type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantStyles: Record<ButtonVariant, string> = {
  default: "bg-slate-900 text-white hover:bg-slate-800",
  outline: "border border-slate-300 text-slate-900 hover:bg-slate-100",
  secondary: "bg-slate-200 text-slate-900 hover:bg-slate-300",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};

export const Button = ({
  className = "",
  variant = "default",
  size = "md",
  ...props
}: ButtonProps) => (
  <button
    className={`inline-flex items-center justify-center rounded-md font-medium transition ${
      variantStyles[variant]
    } ${sizeStyles[size]} ${className}`}
    {...props}
  />
);
