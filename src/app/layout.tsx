import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Ops CRM",
  description: "Lucitour Ops",
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="es">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
