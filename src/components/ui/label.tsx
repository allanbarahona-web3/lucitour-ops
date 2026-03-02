import type { LabelHTMLAttributes } from "react";

export const Label = ({ className = "", ...props }: LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={`text-sm font-medium text-slate-700 ${className}`} {...props} />
);
