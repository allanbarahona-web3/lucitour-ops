"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/button";
import { getOpsRepo } from "../../lib/data/opsRepo";
import { useSession } from "../../lib/auth/sessionContext";
import { Role, TimePunchType, type TimePunch } from "../../lib/types/ops";

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

const formatDate = (value: string) => {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
};

const dateToKey = (value: Date) => value.toISOString().split("T")[0];

const getPunchDayKey = (value: string) => {
  if (!value) {
    return "";
  }
  return value.split("T")[0] ?? "";
};

interface TimeTrackingPanelProps {
  title: string;
  helper?: string;
  userScope?: "agents" | "all";
  restrictToCurrentUser?: boolean;
}

export const TimeTrackingPanel = ({
  title,
  helper,
  userScope = "agents",
  restrictToCurrentUser = false,
}: TimeTrackingPanelProps) => {
  const repo = useMemo(() => getOpsRepo(), []);
  const { users, user } = useSession();
  const [selectedDate, setSelectedDate] = useState(dateToKey(new Date()));
  const [selectedUserId, setSelectedUserId] = useState(user.id);
  const [punches, setPunches] = useState<TimePunch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualType, setManualType] = useState<TimePunchType>(TimePunchType.ENTRY);
  const [manualTime, setManualTime] = useState("08:00");
  const isAdmin = user.role === Role.ADMIN;

  const selectableUsers = useMemo(() => {
    if (restrictToCurrentUser) {
      return [user];
    }
    if (userScope === "all") {
      return users;
    }
    return users.filter((entry) => entry.role === Role.AGENT || entry.role === Role.SUPERVISOR);
  }, [restrictToCurrentUser, user, userScope, users]);

  useEffect(() => {
    if (!selectableUsers.some((entry) => entry.id === selectedUserId)) {
      setSelectedUserId(selectableUsers[0]?.id ?? user.id);
    }
  }, [selectableUsers, selectedUserId, user.id]);

  const loadPunches = async () => {
    setIsLoading(true);
    const data = await repo.listTimePunches();
    setPunches(data);
    setIsLoading(false);
  };

  useEffect(() => {
    void loadPunches();
  }, []);

  const dayPunches = useMemo(
    () => punches.filter((item) => getPunchDayKey(item.occurredAt) === selectedDate),
    [punches, selectedDate],
  );

  const userPunches = useMemo(
    () => dayPunches.filter((item) => item.userId === selectedUserId),
    [dayPunches, selectedUserId],
  );

  const nextPunchType = useMemo(() => {
    const usedTypes = new Set(userPunches.map((item) => item.type));
    return punchOrder.find((entry) => !usedTypes.has(entry.type)) ?? null;
  }, [userPunches]);

  const handlePunch = async () => {
    if (!nextPunchType || isSaving) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const created = await repo.createTimePunch({
        userId: selectedUserId,
        type: nextPunchType.type,
        occurredAt: new Date().toISOString(),
      });
      setPunches((prev) => [created, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el punch.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualPunch = async () => {
    if (!isAdmin || isSaving) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const occurredAt = `${selectedDate}T${manualTime}:00`;
      const created = await repo.createTimePunch(
        {
          userId: selectedUserId,
          type: manualType,
          occurredAt,
        },
        { override: true },
      );
      setPunches((prev) => [created, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el punch.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {helper ? <p className="text-sm text-slate-600">{helper}</p> : null}
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadPunches()}>
          Actualizar
        </Button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="space-y-1">
          <div className="text-xs font-semibold text-slate-600">Fecha</div>
          <input
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900"
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <div className="text-xs font-semibold text-slate-600">Usuario</div>
          <select
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900"
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
            disabled={restrictToCurrentUser}
          >
            {selectableUsers.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <div className="text-xs font-semibold text-slate-600">Siguiente punch</div>
          <Button
            size="sm"
            className="w-full"
            onClick={() => void handlePunch()}
            disabled={!nextPunchType || isSaving}
          >
            {isSaving
              ? "Registrando..."
              : nextPunchType
                ? nextPunchType.label
                : "Turno completo"}
          </Button>
        </div>
      </div>

      {isAdmin ? (
        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-semibold text-slate-600">Correccion manual (admin)</div>
          <div className="mt-2 grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <div className="text-[11px] text-slate-500">Tipo</div>
              <select
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900"
                value={manualType}
                onChange={(event) => setManualType(event.target.value as TimePunchType)}
              >
                {punchOrder.map((entry) => (
                  <option key={entry.type} value={entry.type}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] text-slate-500">Hora</div>
              <input
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900"
                type="time"
                value={manualTime}
                onChange={(event) => setManualTime(event.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button size="sm" variant="outline" onClick={() => void handleManualPunch()}>
                Registrar manual
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-xs text-rose-600">{error}</p> : null}

      {isLoading ? (
        <p className="mt-4 text-sm text-slate-600">Cargando planillas...</p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-md border border-slate-200">
            <div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
              Secuencia del dia
            </div>
            <div className="divide-y divide-slate-100">
              {punchOrder.map((entry) => {
                const record = userPunches.find((item) => item.type === entry.type);
                return (
                  <div key={entry.type} className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="text-slate-700">{entry.label}</span>
                    <span className="text-slate-500">
                      {record ? formatDate(record.occurredAt) : "-"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-md border border-slate-200">
            <div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
              Registro diario (todos)
            </div>
            <div className="max-h-64 overflow-auto">
              <table className="min-w-full border-collapse text-xs">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Hora</th>
                    <th className="px-3 py-2">Agente</th>
                    <th className="px-3 py-2">Punch</th>
                  </tr>
                </thead>
                <tbody>
                  {dayPunches.length === 0 ? (
                    <tr className="border-t border-slate-100">
                      <td className="px-3 py-4 text-center text-sm text-slate-500" colSpan={3}>
                        Sin registros
                      </td>
                    </tr>
                  ) : (
                    dayPunches.map((item) => {
                      const userName = users.find((entry) => entry.id === item.userId)?.name ?? "-";
                      const label = punchOrder.find((entry) => entry.type === item.type)?.label ?? item.type;
                      return (
                        <tr key={item.id} className="border-t border-slate-100">
                          <td className="px-3 py-2 text-slate-600">{formatDate(item.occurredAt)}</td>
                          <td className="px-3 py-2 text-slate-600">{userName}</td>
                          <td className="px-3 py-2 text-slate-600">{label}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
