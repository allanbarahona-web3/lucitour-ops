import type { ReactNode } from "react";
import { SessionProvider } from "../../lib/auth/sessionContext";

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return <SessionProvider>{children}</SessionProvider>;
}
