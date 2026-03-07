"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useSession } from "../../lib/auth/sessionContext";
import { getOpsRepo } from "../../lib/data/opsRepo";
import {
  ContractModificationStatus,
  QuoteStatus,
  Role,
  TimePunchType,
  UpsellOrderStatus,
} from "../../lib/types/ops";
import { Button } from "../ui/button";

interface AppShellProps {
  children: ReactNode;
}

export const AppShell = ({ children }: AppShellProps) => {
  const { user, isAuthenticated, isReady } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const repo = useMemo(() => getOpsRepo(), []);
  const [modificationCount, setModificationCount] = useState(0);
  const [quoteCount, setQuoteCount] = useState(0);
  const [wonQuoteCount, setWonQuoteCount] = useState(0);
  const [upsellPendingCount, setUpsellPendingCount] = useState(0);
  const [showUpsellAlert, setShowUpsellAlert] = useState(false);
  const [hasStartedShift, setHasStartedShift] = useState(true);
  const [isCheckingShift, setIsCheckingShift] = useState(false);
  const [isPunching, setIsPunching] = useState(false);
  const [punchError, setPunchError] = useState<string | null>(null);
  const lastUpsellPendingRef = useRef(0);

  const getHomeRoute = (role: Role) => {
    switch (role) {
      case Role.ADMIN:
        return "/admin/dashboard";
      case Role.CONTRACTS:
        return "/contracts";
      case Role.ACCOUNTING:
        return "/accounting";
      case Role.QUOTES:
        return "/quotes";
      case Role.BILLING:
        return "/billing";
      case Role.PURCHASES:
        return "/purchases";
      case Role.AGENT:
      case Role.SUPERVISOR:
      case Role.VIEWER:
      default:
        return "/my-queue";
    }
  };

  useEffect(() => {
    if (!isReady) {
      return;
    }
    if (!isAuthenticated) {
      router.replace("/auth/login");
    }
  }, [isAuthenticated, isReady, router]);

  const canAccessRoute = (path: string, role: Role) => {
    if (role === Role.AGENT) {
      if (path.startsWith("/my-queue")) {
        return true;
      }
      if (path.startsWith("/won-quotes")) {
        return true;
      }
      if (path.startsWith("/clients")) {
        return true;
      }
      if (path === "/trips") {
        return true;
      }
      if (path.startsWith("/trips/") && path !== "/trips") {
        return true;
      }
      return false;
    }
    if (path.startsWith("/admin")) {
      return role === Role.ADMIN;
    }
    if (path.startsWith("/contracts")) {
      return role === Role.ADMIN || role === Role.CONTRACTS;
    }
    if (path.startsWith("/accounting")) {
      return role === Role.ADMIN || role === Role.ACCOUNTING;
    }
    if (path.startsWith("/quotes")) {
      return role === Role.ADMIN || role === Role.QUOTES;
    }
    if (path.startsWith("/won-quotes")) {
      return true;
    }
    if (path.startsWith("/billing")) {
      return role === Role.ADMIN || role === Role.BILLING || role === Role.ACCOUNTING;
    }
    if (path.startsWith("/purchases")) {
      return role === Role.ADMIN || role === Role.PURCHASES;
    }
    if (path.startsWith("/trips")) {
      return role === Role.ADMIN || role === Role.SUPERVISOR;
    }
    if (path.startsWith("/leads")) {
      return role === Role.ADMIN || role === Role.SUPERVISOR;
    }
    if (path.startsWith("/clients")) {
      return true;
    }
    if (path.startsWith("/my-queue")) {
      return role === Role.ADMIN || role === Role.SUPERVISOR || role === Role.VIEWER;
    }
    if (path.startsWith("/time-tracking")) {
      return true;
    }
    return true;
  };

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    const checkShift = async () => {
      setIsCheckingShift(true);
      const punches = await repo.listTimePunches();
      const todayKey = new Date().toISOString().split("T")[0];
      const hasEntry = punches.some(
        (punch) =>
          punch.userId === user.id &&
          punch.type === TimePunchType.ENTRY &&
          punch.occurredAt.startsWith(todayKey),
      );
      setHasStartedShift(hasEntry);
      setIsCheckingShift(false);
    };

    void checkShift();
    const interval = setInterval(checkShift, 15000);
    return () => clearInterval(interval);
  }, [isAuthenticated, repo, user.id]);

  useEffect(() => {
    if (!isAuthenticated || !isReady) {
      return;
    }
    if (!canAccessRoute(pathname, user.role)) {
      router.replace(getHomeRoute(user.role));
    }
  }, [isAuthenticated, isReady, pathname, router, user.role]);

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

  useEffect(() => {
    if (user.role !== Role.QUOTES && user.role !== Role.ADMIN) {
      setQuoteCount(0);
      return;
    }

    const loadQuotes = async () => {
      const leads = await repo.listLeads();
      const pendingCount = leads.filter((lead) => lead.quoteStatus === QuoteStatus.SENT).length;
      setQuoteCount(pendingCount);
    };

    void loadQuotes();
    const interval = setInterval(loadQuotes, 15000);
    return () => clearInterval(interval);
  }, [repo, user.role]);

  useEffect(() => {
    if (!isAuthenticated || !isReady) {
      return;
    }

    const loadWonQuotes = async () => {
      const leads = await repo.listLeads();
      const wonCount = leads.filter((lead) => lead.quoteStatus === QuoteStatus.WON).length;
      setWonQuoteCount(wonCount);
    };

    void loadWonQuotes();
    const interval = setInterval(loadWonQuotes, 15000);
    return () => clearInterval(interval);
  }, [isAuthenticated, isReady, repo]);

  useEffect(() => {
    if (!isAuthenticated || !isReady) {
      return;
    }

    const loadUpsellQueue = async () => {
      const orders = await repo.listUpsellOrders();
      const pendingCount = orders.filter(
        (order) =>
          order.status === UpsellOrderStatus.SENT_TO_PURCHASES ||
          order.status === UpsellOrderStatus.IN_PROGRESS,
      ).length;
      if (
        (user.role === Role.PURCHASES || user.role === Role.ADMIN) &&
        pendingCount > lastUpsellPendingRef.current
      ) {
        setShowUpsellAlert(true);
      }
      lastUpsellPendingRef.current = pendingCount;
      setUpsellPendingCount(pendingCount);
    };

    void loadUpsellQueue();
    const interval = setInterval(loadUpsellQueue, 15000);
    return () => clearInterval(interval);
  }, [isAuthenticated, isReady, repo, user.role]);

  useEffect(() => {
    if (!showUpsellAlert) {
      return;
    }
    const timer = setTimeout(() => setShowUpsellAlert(false), 5000);
    return () => clearTimeout(timer);
  }, [showUpsellAlert]);

  const handleStartShift = async () => {
    if (isPunching) {
      return;
    }
    setIsPunching(true);
    setPunchError(null);
    try {
      await repo.createTimePunch({
        userId: user.id,
        type: TimePunchType.ENTRY,
        occurredAt: new Date().toISOString(),
      });
      setHasStartedShift(true);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("ops-time-punch"));
      }
    } catch (err) {
      setPunchError(err instanceof Error ? err.message : "No se pudo registrar la entrada.");
    } finally {
      setIsPunching(false);
    }
  };

  return (
    <>
      {!isReady || !isAuthenticated ? null : (
        <div className="flex min-h-screen flex-col bg-slate-50 md:flex-row">
          <Sidebar
            role={user.role}
            modificationCount={modificationCount}
            quoteCount={quoteCount}
            wonQuoteCount={wonQuoteCount}
            upsellPendingCount={upsellPendingCount}
          />
          <div className="flex flex-1 flex-col">
            <Topbar user={user} />
            <main className="flex-1 p-6">{children}</main>
          </div>
          {!hasStartedShift ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6">
              <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Marcaje
                </div>
                <h2 className="mt-2 text-lg font-semibold text-slate-900">
                  Marca tu entrada al shift
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Debes registrar tu entrada para continuar usando el sistema.
                </p>
                {punchError ? (
                  <p className="mt-3 text-xs text-rose-600">{punchError}</p>
                ) : null}
                <div className="mt-5 flex justify-end">
                  <Button onClick={() => void handleStartShift()} disabled={isPunching}>
                    {isPunching ? "Marcando..." : "Marcar entrada"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
          {showUpsellAlert ? (
            <div className="fixed right-6 top-20 z-50 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-lg animate-pulse">
              Nuevos upsells pendientes en Compras.
            </div>
          ) : null}
        </div>
      )}
    </>
  );
};
