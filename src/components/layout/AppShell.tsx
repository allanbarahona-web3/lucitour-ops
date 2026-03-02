"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useSession } from "../../lib/auth/sessionContext";
import { getOpsRepo } from "../../lib/data/opsRepo";
import { ContractModificationStatus, Role } from "../../lib/types/ops";

interface AppShellProps {
  children: ReactNode;
}

export const AppShell = ({ children }: AppShellProps) => {
  const { user } = useSession();
  const repo = useMemo(() => getOpsRepo(), []);
  const [modificationCount, setModificationCount] = useState(0);

  useEffect(() => {
    if (user.role !== Role.CONTRACTS && user.role !== Role.ADMIN) {
      setModificationCount(0);
      return;
    }

    const loadModifications = async () => {
      const requests = await repo.listContractModifications();
      const pendingCount = requests.filter(
        (request) => request.status === ContractModificationStatus.PENDING,
      ).length;
      setModificationCount(pendingCount);
    };

    void loadModifications();
  }, [repo, user.role]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 md:flex-row">
      <Sidebar role={user.role} modificationCount={modificationCount} />
      <div className="flex flex-1 flex-col">
        <Topbar user={user} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
};
