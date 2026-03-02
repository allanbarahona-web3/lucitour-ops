import type { ReactNode } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { SessionProvider } from "../../lib/auth/sessionContext";

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <SessionProvider>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
