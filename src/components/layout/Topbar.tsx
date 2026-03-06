"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { useSession } from "../../lib/auth/sessionContext";
import { getOpsRepo } from "../../lib/data/opsRepo";
import { Role, TimePunchType, type TimePunch, type User } from "../../lib/types/ops";

interface TopbarProps {
  user: User;
}

export const Topbar = ({ user }: TopbarProps) => (
  <header className="flex w-full items-center justify-between gap-4 border-b border-slate-200/70 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
    <div className="text-sm font-semibold text-slate-900">Dashboard</div>
    <TopbarControls user={user} />
  </header>
);

const roleStyles: Record<Role, string> = {
  ADMIN: "bg-emerald-100 text-emerald-800",
  AGENT: "bg-sky-100 text-sky-800",
  SUPERVISOR: "bg-purple-100 text-purple-800",
  ACCOUNTING: "bg-rose-100 text-rose-800",
  CONTRACTS: "bg-amber-100 text-amber-800",
  QUOTES: "bg-indigo-100 text-indigo-800",
  BILLING: "bg-teal-100 text-teal-800",
  PURCHASES: "bg-lime-100 text-lime-800",
  VIEWER: "bg-slate-200 text-slate-700",
};

const statusStyles: Record<string, string> = {
  Working: "bg-emerald-50 text-emerald-700",
  Break: "bg-amber-50 text-amber-700",
  Lunch: "bg-sky-50 text-sky-700",
  Off: "bg-slate-200 text-slate-700",
};

const formatDuration = (valueMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(valueMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const TopbarControls = ({ user }: TopbarProps) => {
  const { users, setUserById, logout } = useSession();
  const repo = useMemo(() => getOpsRepo(), []);
  const [punches, setPunches] = useState<TimePunch[]>([]);
  const [selectedType, setSelectedType] = useState<TimePunchType | "">("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());

  const punchOrder: Array<{ type: TimePunchType; label: string }> = [
    { type: TimePunchType.ENTRY, label: "Entrada" },
    { type: TimePunchType.BREAK1_START, label: "Break 1" },
    { type: TimePunchType.BREAK1_END, label: "Regreso break 1" },
    { type: TimePunchType.LUNCH_OUT, label: "Salida almuerzo" },
    { type: TimePunchType.LUNCH_IN, label: "Entrada almuerzo" },
    { type: TimePunchType.BREAK2_START, label: "Break 2" },
    { type: TimePunchType.BREAK2_END, label: "Regreso break 2" },
    { type: TimePunchType.EXIT, label: "Salida" },
  ];

  const todayKey = new Date().toISOString().split("T")[0];

  useEffect(() => {
    let isActive = true;
    const loadPunches = async () => {
      const data = await repo.listTimePunches();
      if (isActive) {
        setPunches(data);
      }
    };

    void loadPunches();
    const interval = setInterval(loadPunches, 10000);
    const handlePunchEvent = () => {
      void loadPunches();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("ops-time-punch", handlePunchEvent);
    }
    return () => {
      isActive = false;
      clearInterval(interval);
      if (typeof window !== "undefined") {
        window.removeEventListener("ops-time-punch", handlePunchEvent);
      }
    };
  }, [repo]);

  useEffect(() => {
    const interval = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const userPunches = useMemo(
    () =>
      punches.filter(
        (item) => item.userId === user.id && item.occurredAt.split("T")[0] === todayKey,
      ),
    [punches, todayKey, user.id],
  );

  const sortedPunches = useMemo(
    () =>
      [...userPunches].sort(
        (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
      ),
    [userPunches],
  );

  const timeTotals = useMemo(() => {
    let workingMs = 0;
    let breakMs = 0;
    let lunchMs = 0;

    const addSpan = (from: number, to: number, bucket: "working" | "break" | "lunch") => {
      const delta = Math.max(0, to - from);
      if (bucket === "working") workingMs += delta;
      if (bucket === "break") breakMs += delta;
      if (bucket === "lunch") lunchMs += delta;
    };

    const bucketForPunch = (type: TimePunchType) => {
      if (type === TimePunchType.LUNCH_OUT) return "lunch";
      if (type === TimePunchType.BREAK1_START || type === TimePunchType.BREAK2_START) return "break";
      if (type === TimePunchType.EXIT) return "off";
      return "working";
    };

    for (let i = 0; i < sortedPunches.length; i += 1) {
      const current = sortedPunches[i];
      const next = sortedPunches[i + 1];
      const start = new Date(current.occurredAt).getTime();
      const end = next ? new Date(next.occurredAt).getTime() : nowTs;
      const bucket = bucketForPunch(current.type);
      if (bucket === "off") {
        break;
      }
      addSpan(start, end, bucket as "working" | "break" | "lunch");
    }

    return { workingMs, breakMs, lunchMs };
  }, [nowTs, sortedPunches]);

  const currentStatus = useMemo(() => {
    const last = sortedPunches[sortedPunches.length - 1];
    if (!last) return "Off";
    if (last.type === TimePunchType.EXIT) return "Off";
    if (last.type === TimePunchType.LUNCH_OUT) return "Lunch";
    if (last.type === TimePunchType.BREAK1_START || last.type === TimePunchType.BREAK2_START) {
      return "Break";
    }
    return "Working";
  }, [sortedPunches]);

  const hasEntry = useMemo(
    () => userPunches.some((item) => item.type === TimePunchType.ENTRY),
    [userPunches],
  );
  const hasExit = useMemo(
    () => userPunches.some((item) => item.type === TimePunchType.EXIT),
    [userPunches],
  );

  const nextPunch = useMemo(() => {
    const usedTypes = new Set(userPunches.map((item) => item.type));
    return punchOrder.find((entry) => !usedTypes.has(entry.type)) ?? null;
  }, [punchOrder, userPunches]);

  useEffect(() => {
    setSelectedType(nextPunch?.type ?? "");
  }, [nextPunch]);

  const handlePunch = async () => {
    if (!selectedType || !nextPunch || selectedType !== nextPunch.type || isSaving) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const created = await repo.createTimePunch({
        userId: user.id,
        type: selectedType,
        occurredAt: new Date().toISOString(),
      });
      setPunches((prev) => [created, ...prev]);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("ops-time-punch"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el punch.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-4 text-sm text-slate-700">
      <div className="flex items-center gap-2">
        <select
          className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900"
          value={selectedType}
          onChange={(event) => setSelectedType(event.target.value as TimePunchType)}
        >
          <option value="">Sin punch</option>
          {punchOrder.map((entry) => (
            <option
              key={entry.type}
              value={entry.type}
              disabled={nextPunch?.type !== entry.type}
            >
              {entry.label}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={() => void handlePunch()} disabled={!nextPunch || isSaving}>
          {isSaving ? "Marcando..." : "Marcar"}
        </Button>
        {error ? <span className="text-xs text-rose-600">{error}</span> : null}
      </div>
      <div className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[currentStatus]}`}>
        {currentStatus}
      </div>
      <div className="hidden items-center gap-3 text-xs text-slate-600 md:flex">
        <span>Working: {formatDuration(timeTotals.workingMs)}</span>
        <span>Break: {formatDuration(timeTotals.breakMs)}</span>
        <span>Lunch: {formatDuration(timeTotals.lunchMs)}</span>
      </div>
      <div className="text-right">
        <div className="font-medium text-slate-900">{user.name}</div>
        <div className="text-xs uppercase text-slate-500">{user.email}</div>
      </div>
      <Badge className={`px-3 py-1 text-xs font-semibold ${roleStyles[user.role]}`}>
        {user.role === "VIEWER" ? "VIEWER · Solo lectura" : user.role}
      </Badge>
      {user.role === Role.ADMIN ? (
        <select
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-900"
          value={user.id}
          onChange={(event) => setUserById(event.target.value)}
        >
          {users.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name} ({entry.role})
            </option>
          ))}
        </select>
      ) : null}
      <Button
        size="sm"
        variant="outline"
        onClick={logout}
        disabled={!hasExit}
        title={!hasExit ? "Debes marcar la salida del shift para cerrar sesion." : ""}
      >
        Salir
      </Button>
    </div>
  );
};
