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
  <header className="flex w-full items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3">
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
  VIEWER: "bg-slate-200 text-slate-700",
};

const TopbarControls = ({ user }: TopbarProps) => {
  const { users, setUserById } = useSession();
  const repo = useMemo(() => getOpsRepo(), []);
  const [punches, setPunches] = useState<TimePunch[]>([]);
  const [selectedType, setSelectedType] = useState<TimePunchType | "">("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const loadPunches = async () => {
      const data = await repo.listTimePunches();
      setPunches(data);
    };

    void loadPunches();
  }, [repo]);

  const userPunches = useMemo(
    () =>
      punches.filter(
        (item) => item.userId === user.id && item.occurredAt.split("T")[0] === todayKey,
      ),
    [punches, todayKey, user.id],
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
      <div className="text-right">
        <div className="font-medium text-slate-900">{user.name}</div>
        <div className="text-xs uppercase text-slate-500">{user.email}</div>
      </div>
      <Badge className={`px-3 py-1 text-xs font-semibold ${roleStyles[user.role]}`}>
        {user.role === "VIEWER" ? "VIEWER · Solo lectura" : user.role}
      </Badge>
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
    </div>
  );
};
