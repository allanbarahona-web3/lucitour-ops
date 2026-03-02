"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/button";
import { getOpsRepo } from "../../lib/data/opsRepo";
import { useSession } from "../../lib/auth/sessionContext";
import {
  Role,
  TimePunchType,
  type HolidayDate,
  type PayrollDeduction,
  type PayrollGlobalConfig,
  type PayrollRoleConfig,
  type TimePunch,
} from "../../lib/types/ops";

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

const getDateRange = (baseMonth: string, period: string) => {
  const [yearStr, monthStr] = baseMonth.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);

  if (period === "biweekly_1") {
    return {
      start,
      end: new Date(year, month, 15),
    };
  }

  if (period === "biweekly_2") {
    return {
      start: new Date(year, month, 16),
      end,
    };
  }

  return { start, end };
};

const diffHours = (start: Date, end: Date) => Math.max(0, (end.getTime() - start.getTime()) / 36e5);

const getDayPunches = (items: TimePunch[], userId: string, dayKey: string) => {
  const map = new Map<TimePunchType, TimePunch>();
  items
    .filter((item) => item.userId === userId && item.occurredAt.split("T")[0] === dayKey)
    .forEach((item) => map.set(item.type, item));
  return map;
};

const computeDailyHours = (punchMap: Map<TimePunchType, TimePunch>) => {
  const entry = punchMap.get(TimePunchType.ENTRY);
  const exit = punchMap.get(TimePunchType.EXIT);
  if (!entry || !exit) {
    return { workedHours: 0, lunchHours: 0, valid: false };
  }

  const entryDate = new Date(entry.occurredAt);
  const exitDate = new Date(exit.occurredAt);
  let workedHours = diffHours(entryDate, exitDate);

  const lunchOut = punchMap.get(TimePunchType.LUNCH_OUT);
  const lunchIn = punchMap.get(TimePunchType.LUNCH_IN);
  let lunchHours = 0;
  if (lunchOut && lunchIn) {
    lunchHours = diffHours(new Date(lunchOut.occurredAt), new Date(lunchIn.occurredAt));
    workedHours = Math.max(0, workedHours - lunchHours);
  }

  return { workedHours, lunchHours, valid: true };
};

interface ReportRow {
  userId: string;
  userName: string;
  role: Role;
  daysWorked: number;
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
  grossPay: number;
  overtimePay: number;
  holidayPay: number;
  commissionPay: number;
  deductionPay: number;
  retentionPay: number;
  netPay: number;
  severanceProvision: number;
  vacationDays: number;
}

interface RoleSummary {
  role: Role;
  employees: number;
  totalHours: number;
  grossPay: number;
  severanceProvision: number;
}

export const TimeReportsPanel = () => {
  const repo = useMemo(() => getOpsRepo(), []);
  const { users } = useSession();
  const [punches, setPunches] = useState<TimePunch[]>([]);
  const [configs, setConfigs] = useState<PayrollRoleConfig[]>([]);
  const [globalConfig, setGlobalConfig] = useState<PayrollGlobalConfig>({ retentionRate: 0.1083 });
  const [deductions, setDeductions] = useState<PayrollDeduction[]>([]);
  const [holidays, setHolidays] = useState<HolidayDate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [periodType, setPeriodType] = useState("biweekly_1");
  const [baseMonth, setBaseMonth] = useState(dateToKey(new Date()).slice(0, 7));

  const loadData = async () => {
    setIsLoading(true);
    const [punchData, configData, holidayData, globalData, deductionData] = await Promise.all([
      repo.listTimePunches(),
      repo.listPayrollRoleConfigs(),
      repo.listHolidayDates(),
      repo.getPayrollGlobalConfig(),
      repo.listPayrollDeductions(),
    ]);
    setPunches(punchData);
    setConfigs(configData);
    setHolidays(holidayData);
    setGlobalConfig(globalData);
    setDeductions(deductionData);
    setIsLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const holidaySet = useMemo(
    () => new Set(holidays.map((holiday) => holiday.date)),
    [holidays],
  );

  const configByRole = useMemo(() => {
    const map = new Map<Role, PayrollRoleConfig>();
    configs.forEach((config) => map.set(config.role, config));
    return map;
  }, [configs]);

  const reportRange = useMemo(() => getDateRange(baseMonth, periodType), [baseMonth, periodType]);

  const rangeKeys = useMemo(() => {
    const keys: string[] = [];
    const cursor = new Date(reportRange.start);
    while (cursor <= reportRange.end) {
      keys.push(dateToKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return keys;
  }, [reportRange]);

  const rows = useMemo(() => {
    const result: ReportRow[] = [];
    users.forEach((user) => {
      const config = configByRole.get(user.role);
      if (!config) {
        return;
      }
      const userDeductions = deductions.filter(
        (item) =>
          item.userId === user.id &&
          item.periodType === periodType &&
          item.periodMonth === baseMonth,
      );
      const deductionPay = userDeductions.reduce((sum, item) => sum + item.amount, 0);
      let daysWorked = 0;
      let regularHours = 0;
      let overtimeHours = 0;
      let grossPay = 0;
      let overtimePay = 0;
      let holidayPay = 0;

      rangeKeys.forEach((dayKey) => {
        const punchMap = getDayPunches(punches, user.id, dayKey);
        const daily = computeDailyHours(punchMap);
        if (!daily.valid) {
          return;
        }
        daysWorked += 1;
        const regular = Math.min(daily.workedHours, config.baseDailyHours);
        const overtime = Math.max(daily.workedHours - config.baseDailyHours, 0);
        const isHoliday = holidaySet.has(dayKey);
        const holidayMultiplier = isHoliday ? config.holidayMultiplier : 1;
        const regularPay = regular * config.baseHourlyRate * holidayMultiplier;
        const overtimeAmount = overtime * config.baseHourlyRate * config.overtimeMultiplier * holidayMultiplier;
        regularHours += regular;
        overtimeHours += overtime;
        grossPay += regularPay + overtimeAmount;
        overtimePay += overtimeAmount;
        if (isHoliday) {
          holidayPay += regularPay + overtimeAmount;
        }
      });

      const totalHours = regularHours + overtimeHours;
      const commissionPay = grossPay * config.commissionRate;
      const retentionPay = grossPay * globalConfig.retentionRate;
      const netPay = grossPay + commissionPay - deductionPay - retentionPay;
      const severanceProvision = grossPay * config.severanceRate;
      const vacationDays = daysWorked / 30;

      result.push({
        userId: user.id,
        userName: user.name,
        role: user.role,
        daysWorked,
        regularHours,
        overtimeHours,
        totalHours,
        grossPay,
        overtimePay,
        holidayPay,
        commissionPay,
        deductionPay,
        retentionPay,
        netPay,
        severanceProvision,
        vacationDays,
      });
    });

    return result;
  }, [users, configByRole, punches, rangeKeys, holidaySet, deductions, periodType, baseMonth, globalConfig.retentionRate]);

  const roleSummary = useMemo(() => {
    const summary = new Map<Role, RoleSummary>();
    rows.forEach((row) => {
      const entry = summary.get(row.role) ?? {
        role: row.role,
        employees: 0,
        totalHours: 0,
        grossPay: 0,
        severanceProvision: 0,
      };
      entry.employees += 1;
      entry.totalHours += row.totalHours;
      entry.grossPay += row.grossPay;
      entry.severanceProvision += row.severanceProvision;
      summary.set(row.role, entry);
    });
    return Array.from(summary.values());
  }, [rows]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Reportes de planilla</h2>
          <p className="text-sm text-slate-600">Resumen quincenal y mensual por empleado y por rol.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadData()}>
          Actualizar
        </Button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="space-y-1">
          <div className="text-xs font-semibold text-slate-600">Periodo</div>
          <select
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900"
            value={periodType}
            onChange={(event) => setPeriodType(event.target.value)}
          >
            <option value="biweekly_1">Quincena 1 (1-15)</option>
            <option value="biweekly_2">Quincena 2 (16-fin)</option>
            <option value="monthly">Mensual</option>
          </select>
        </div>
        <div className="space-y-1">
          <div className="text-xs font-semibold text-slate-600">Mes</div>
          <input
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900"
            type="month"
            value={baseMonth}
            onChange={(event) => setBaseMonth(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <div className="text-xs font-semibold text-slate-600">Rango</div>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
            {formatDate(reportRange.start.toISOString())} - {formatDate(reportRange.end.toISOString())}
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm text-slate-600">Cargando reportes...</p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="overflow-auto rounded-md border border-slate-200">
            <table className="min-w-[1200px] w-full border-collapse text-xs">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2">Empleado</th>
                  <th className="px-3 py-2">Rol</th>
                  <th className="px-3 py-2">Dias trabajados</th>
                  <th className="px-3 py-2">Horas regulares</th>
                  <th className="px-3 py-2">Horas extras</th>
                  <th className="px-3 py-2">Total horas</th>
                  <th className="px-3 py-2">Pago bruto</th>
                  <th className="px-3 py-2">Pago extra</th>
                  <th className="px-3 py-2">Pago feriados</th>
                  <th className="px-3 py-2">Comisiones</th>
                  <th className="px-3 py-2">Deducciones</th>
                  <th className="px-3 py-2">Retencion</th>
                  <th className="px-3 py-2">Pago neto</th>
                  <th className="px-3 py-2">Cesantia (prov)</th>
                  <th className="px-3 py-2">Vacaciones (dias)</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr className="border-t border-slate-100">
                    <td className="px-3 py-4 text-center text-sm text-slate-500" colSpan={15}>
                      Sin registros
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.userId} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-700">{row.userName}</td>
                      <td className="px-3 py-2 text-slate-600">{row.role}</td>
                      <td className="px-3 py-2 text-slate-600">{row.daysWorked}</td>
                      <td className="px-3 py-2 text-slate-600">{row.regularHours.toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-600">{row.overtimeHours.toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-600">{row.totalHours.toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-600">{row.grossPay.toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-600">{row.overtimePay.toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-600">{row.holidayPay.toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-600">{row.commissionPay.toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-600">{row.deductionPay.toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-600">{row.retentionPay.toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-600">{row.netPay.toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-600">{row.severanceProvision.toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-600">{row.vacationDays.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="overflow-auto rounded-md border border-slate-200">
            <table className="min-w-[700px] w-full border-collapse text-xs">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2">Rol</th>
                  <th className="px-3 py-2">Empleados</th>
                  <th className="px-3 py-2">Horas totales</th>
                  <th className="px-3 py-2">Pago bruto</th>
                  <th className="px-3 py-2">Cesantia (prov)</th>
                </tr>
              </thead>
              <tbody>
                {roleSummary.length === 0 ? (
                  <tr className="border-t border-slate-100">
                    <td className="px-3 py-4 text-center text-sm text-slate-500" colSpan={5}>
                      Sin registros
                    </td>
                  </tr>
                ) : (
                  roleSummary.map((row) => (
                    <tr key={row.role} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-700">{row.role}</td>
                      <td className="px-3 py-2 text-slate-600">{row.employees}</td>
                      <td className="px-3 py-2 text-slate-600">{row.totalHours.toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-600">{row.grossPay.toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-600">{row.severanceProvision.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
