"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

interface SheetContentProps extends DialogPrimitive.DialogContentProps {
  side?: "left" | "right";
}

export const SheetContent = ({
  className = "",
  side = "right",
  ...props
}: SheetContentProps) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 bg-black/40" />
    <DialogPrimitive.Content
      className={`fixed top-0 h-full w-72 bg-white p-6 shadow-lg transition ${
        side === "left" ? "left-0" : "right-0"
      } ${className}`}
      {...props}
    />
  </DialogPrimitive.Portal>
);
