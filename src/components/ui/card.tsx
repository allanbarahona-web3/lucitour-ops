import type { HTMLAttributes } from "react";

export const Card = ({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={`rounded-lg border border-slate-200 bg-white ${className}`} {...props} />
);

export const CardHeader = ({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={`border-b border-slate-100 px-4 py-3 ${className}`} {...props} />
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
