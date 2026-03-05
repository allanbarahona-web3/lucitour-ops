import type { HTMLAttributes } from "react";

export const Card = ({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={`rounded-xl border border-slate-200/80 bg-white shadow-sm ${className}`}
    {...props}
  />
);

export const CardHeader = ({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={`border-b border-slate-100/80 px-4 py-3 ${className}`} {...props} />
);

export const CardTitle = ({
  className = "",
  ...props
}: HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={`text-base font-semibold text-slate-900 ${className}`} {...props} />
);

export const CardContent = ({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={`px-4 py-4 ${className}`} {...props} />
);
