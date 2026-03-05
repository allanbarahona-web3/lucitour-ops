import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => (
    <input
      ref={ref}
      className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none ${className}`}
      {...props}
    />
  ),
);

Input.displayName = "Input";
