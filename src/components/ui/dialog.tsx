"use client";

import type { HTMLAttributes } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogContent = ({
  className = "",
  ...props
}: DialogPrimitive.DialogContentProps) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 bg-black/40" />
    <DialogPrimitive.Content
      className={`fixed left-1/2 top-1/2 w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg ${
        className ?? ""
      }`}
      {...props}
    />
  </DialogPrimitive.Portal>
);

export const DialogHeader = ({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={`mb-4 space-y-1 ${className}`} {...props} />
);

export const DialogFooter = ({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={`mt-4 flex items-center justify-end gap-2 ${className}`} {...props} />
);

export const DialogTitle = ({
  className = "",
  ...props
}: DialogPrimitive.DialogTitleProps) => (
  <DialogPrimitive.Title
    className={`text-lg font-semibold text-slate-900 ${className}`}
    {...props}
  />
);
