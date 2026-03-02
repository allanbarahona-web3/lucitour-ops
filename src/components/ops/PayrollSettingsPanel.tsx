"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../ui/button";
import { getOpsRepo } from "../../lib/data/opsRepo";
import {
  Role,
  type HolidayDate,
  type PayrollGlobalConfig,
  type PayrollRoleConfig,
  type UpdatePayrollRoleConfig,
} from "../../lib/types/ops";

const roles: Role[] = [
  Role.ADMIN,
  Role.AGENT,
  Role.SUPERVISOR,
  Role.ACCOUNTING,
  Role.CONTRACTS,
  Role.QUOTES,
  Role.BILLING,
  Role.VIEWER,
];

interface PayrollSettingsPanelProps {
  canEdit: boolean;
}

export const PayrollSettingsPanel = ({ canEdit }: PayrollSettingsPanelProps) => {
  const repo = useMemo(() => getOpsRepo(), []);
  const [configs, setConfigs] = useState<PayrollRoleConfig[]>([]);
  const [holidays, setHolidays] = useState<HolidayDate[]>([]);
  const [globalConfig, setGlobalConfig] = useState<PayrollGlobalConfig>({ retentionRate: 0.1083 });
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayLabel, setNewHolidayLabel] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const loadSettings = async () => {
    setIsLoading(true);
    const [configData, holidayData] = await Promise.all([
      repo.listPayrollRoleConfigs(),
      repo.listHolidayDates(),
    ]);
    const globalData = await repo.getPayrollGlobalConfig();
    setConfigs(configData);
    setHolidays(holidayData);
    setGlobalConfig(globalData);
    setIsLoading(false);
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const updateConfigLocal = (role: Role, patch: Partial<PayrollRoleConfig>) => {
    setConfigs((prev) =>
      prev.map((config) => (config.role === role ? { ...config, ...patch } : config)),
    );
  };

  const scheduleConfigUpdate = (role: Role, patch: UpdatePayrollRoleConfig) => {
    const key = `${role}:${Object.keys(patch).join("-")}`;
    updateConfigLocal(role, patch);
    if (timers.current[key]) {
      clearTimeout(timers.current[key]);
    }
    timers.current[key] = setTimeout(() => {
      void repo.updatePayrollRoleConfig(patch).then((updated) => {
        setConfigs((prev) =>
          prev.map((config) => (config.role === role ? updated : config)),
        );
      });
    }, 400);
  };

  const ensureConfig = (role: Role) =>
    configs.find((config) => config.role === role) ?? {
      role,
      baseHourlyRate: 0,
      baseDailyHours: 8,
      overtimeMultiplier: 1.5,
      holidayMultiplier: 2,
      severanceRate: 0.0833,
      commissionRate: 0,
    };

  const handleAddHoliday = async () => {
    if (!newHolidayDate || !newHolidayLabel) {
      return;
    }
    const created = await repo.addHolidayDate({
      date: newHolidayDate,
      label: newHolidayLabel,
    });
    setHolidays((prev) => [...prev, created]);
    setNewHolidayDate("");
    setNewHolidayLabel("");
  };

  const handleDeleteHoliday = async (id: string) => {
    const ok = await repo.deleteHolidayDate(id);
    if (ok) {
      setHolidays((prev) => prev.filter((item) => item.id !== id));
    }
  };

  if (isLoading) {
    return <p className="text-sm text-slate-600">Cargando catalogo de planillas...</p>;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Catalogo de planilla</h2>
          <p className="text-sm text-slate-600">Configuraciones por rol y feriados.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadSettings()}>
          Actualizar
        </Button>
      </div>

      <div className="mt-4 overflow-auto rounded-md border border-slate-200">
        <table className="min-w-[1000px] w-full border-collapse text-xs">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">Rol</th>
              <th className="px-3 py-2">Hora base</th>
              <th className="px-3 py-2">Horas/dia</th>
              <th className="px-3 py-2">Factor extra</th>
              <th className="px-3 py-2">Factor feriado</th>
              <th className="px-3 py-2">Cesantia %</th>
              <th className="px-3 py-2">Comision %</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => {
              const config = ensureConfig(role);
              return (
                <tr key={role} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-700">{role}</td>
                  <td className="px-3 py-2">
                    <input
                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900"
                      type="number"
                      step="0.01"
                      value={config.baseHourlyRate}
                      disabled={!canEdit}
                      onChange={(event) =>
                        scheduleConfigUpdate(role, {
                          role,
                          baseHourlyRate: Number(event.target.value || 0),
                        })
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900"
                      type="number"
                      step="0.1"
                      value={config.baseDailyHours}
                      disabled={!canEdit}
                      onChange={(event) =>
                        scheduleConfigUpdate(role, {
                          role,
                          baseDailyHours: Number(event.target.value || 0),
                        })
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900"
                      type="number"
                      step="0.01"
                      value={config.overtimeMultiplier}
                      disabled={!canEdit}
                      onChange={(event) =>
                        scheduleConfigUpdate(role, {
                          role,
                          overtimeMultiplier: Number(event.target.value || 0),
                        })
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900"
                      type="number"
                      step="0.01"
                      value={config.holidayMultiplier}
                      disabled={!canEdit}
                      onChange={(event) =>
                        scheduleConfigUpdate(role, {
                          role,
                          holidayMultiplier: Number(event.target.value || 0),
                        })
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900"
                      type="number"
                      step="0.0001"
                      value={config.severanceRate}
                      disabled={!canEdit}
                      onChange={(event) =>
                        scheduleConfigUpdate(role, {
                          role,
                          severanceRate: Number(event.target.value || 0),
                        })
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900"
                      type="number"
                      step="0.0001"
                      value={config.commissionRate}
                      disabled={!canEdit}
                      onChange={(event) =>
                        scheduleConfigUpdate(role, {
                          role,
                          commissionRate: Number(event.target.value || 0),
                        })
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
        <div className="text-xs font-semibold text-slate-600">Retencion legal</div>
        <div className="mt-2 grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <div className="text-[11px] text-slate-500">% retencion (sobre bruto)</div>
            <input
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900"
              type="number"
              step="0.0001"
              value={globalConfig.retentionRate}
              disabled={!canEdit}
              onChange={(event) => {
                const retentionRate = Number(event.target.value || 0);
                setGlobalConfig((prev) => ({ ...prev, retentionRate }));
                if (!canEdit) {
                  return;
                }
                void repo.updatePayrollGlobalConfig({ retentionRate }).then((updated) => {
                  setGlobalConfig(updated);
                });
              }}
            />
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="text-sm font-semibold text-slate-900">Feriados</div>
        <div className="mt-2 grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-slate-600">Fecha</div>
            <input
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900"
              type="date"
              value={newHolidayDate}
              disabled={!canEdit}
              onChange={(event) => setNewHolidayDate(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs font-semibold text-slate-600">Descripcion</div>
            <input
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900"
              value={newHolidayLabel}
              disabled={!canEdit}
              onChange={(event) => setNewHolidayLabel(event.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button size="sm" onClick={() => void handleAddHoliday()} disabled={!canEdit}>
              Agregar feriado
            </Button>
          </div>
        </div>

        <div className="mt-3 overflow-auto rounded-md border border-slate-200">
          <table className="min-w-[600px] w-full border-collapse text-xs">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Descripcion</th>
                <th className="px-3 py-2">Accion</th>
              </tr>
            </thead>
            <tbody>
              {holidays.length === 0 ? (
                <tr className="border-t border-slate-100">
                  <td className="px-3 py-4 text-center text-sm text-slate-500" colSpan={3}>
                    Sin feriados
                  </td>
                </tr>
              ) : (
                holidays.map((holiday) => (
                  <tr key={holiday.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-600">{holiday.date}</td>
                    <td className="px-3 py-2 text-slate-600">{holiday.label}</td>
                    <td className="px-3 py-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleDeleteHoliday(holiday.id)}
                        disabled={!canEdit}
                      >
                        Quitar
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
