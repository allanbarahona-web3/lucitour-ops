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
  type PayrollPayslip,
  type PayrollRoleConfig,
  type TimePunch,
} from "../../lib/types/ops";

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
  if (lunchOut && lunchIn) {
    workedHours = Math.max(0, workedHours - diffHours(new Date(lunchOut.occurredAt), new Date(lunchIn.occurredAt)));
  }

  return { workedHours, valid: true };
};

const buildPdfMock = (payslip: PayrollPayslip, employeeName: string) => {
  return [
    "RECIBO DE SALARIO",
    `Empleado: ${employeeName}`,
    `Periodo: ${payslip.periodType} ${payslip.periodMonth}`,
    `Horas totales: ${payslip.totalHours.toFixed(2)}`,
    `Dias trabajados: ${payslip.daysWorked}`,
    `Bruto: ${payslip.grossPay.toFixed(2)}`,
    `Horas extra: ${payslip.overtimePay.toFixed(2)}`,
    `Feriados: ${payslip.holidayPay.toFixed(2)}`,
    `Comisiones: ${payslip.commissionPay.toFixed(2)}`,
    `Deducciones: ${payslip.deductionPay.toFixed(2)}`,
    `Retencion: ${payslip.retentionPay.toFixed(2)}`,
    `Neto: ${payslip.netPay.toFixed(2)}`,
    `Vacaciones acumuladas: ${payslip.vacationDays.toFixed(2)}`,
  ].join("\n");
};

export const PayslipsPanel = () => {
  const repo = useMemo(() => getOpsRepo(), []);
  const { users, user } = useSession();
  const [periodType, setPeriodType] = useState("biweekly_1");
  const [periodMonth, setPeriodMonth] = useState(new Date().toISOString().slice(0, 7));
  const [punches, setPunches] = useState<TimePunch[]>([]);
  const [configs, setConfigs] = useState<PayrollRoleConfig[]>([]);
  const [globalConfig, setGlobalConfig] = useState<PayrollGlobalConfig>({ retentionRate: 0.1083 });
  const [deductions, setDeductions] = useState<PayrollDeduction[]>([]);
  const [holidays, setHolidays] = useState<HolidayDate[]>([]);
  const [payslips, setPayslips] = useState<PayrollPayslip[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    const [punchData, configData, holidayData, globalData, deductionData, payslipData] =
      await Promise.all([
        repo.listTimePunches(),
        repo.listPayrollRoleConfigs(),
        repo.listHolidayDates(),
        repo.getPayrollGlobalConfig(),
        repo.listPayrollDeductions(),
        repo.listPayrollPayslips(),
      ]);
    setPunches(punchData);
    setConfigs(configData);
    setHolidays(holidayData);
    setGlobalConfig(globalData);
    setDeductions(deductionData);
    setPayslips(payslipData);
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

  const handleGenerate = async () => {
    setIsSaving(true);
    try {
      const range = getDateRange(periodMonth, periodType);
      const keys: string[] = [];
      const cursor = new Date(range.start);
      while (cursor <= range.end) {
        keys.push(dateToKey(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }

      const nextPayslips: PayrollPayslip[] = [];
      for (const employee of users) {
        const config = configByRole.get(employee.role);
        if (!config) {
          continue;
        }
        let daysWorked = 0;
        let regularHours = 0;
        let overtimeHours = 0;
        let grossPay = 0;
        let overtimePay = 0;
        let holidayPay = 0;

        keys.forEach((dayKey) => {
          const punchMap = getDayPunches(punches, employee.id, dayKey);
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
        const deductionPay = deductions
          .filter((item) => item.userId === employee.id && item.periodType === periodType && item.periodMonth === periodMonth)
          .reduce((sum, item) => sum + item.amount, 0);
        const netPay = grossPay + commissionPay - deductionPay - retentionPay;
        const severanceProvision = grossPay * config.severanceRate;
        const vacationDays = daysWorked / 30;

        const draft: PayrollPayslip = {
          id: "temp",
          userId: employee.id,
          periodType: periodType as PayrollPayslip["periodType"],
          periodMonth,
          grossPay,
          overtimePay,
          holidayPay,
          commissionPay,
          deductionPay,
          retentionPay,
          netPay,
          totalHours,
          daysWorked,
          vacationDays,
          generatedAt: new Date().toISOString(),
          sentAt: new Date().toISOString(),
          sentByUserId: user.id,
          pdfContent: "",
        };

        const pdfContent = buildPdfMock(draft, employee.name);
        const created = await repo.createPayrollPayslip({
          userId: employee.id,
          periodType: periodType as PayrollPayslip["periodType"],
          periodMonth,
          grossPay,
          overtimePay,
          holidayPay,
          commissionPay,
          deductionPay,
          retentionPay,
          netPay,
          totalHours,
          daysWorked,
          vacationDays,
          pdfContent,
        });
        nextPayslips.push(created);
      }

      setPayslips((prev) => [...nextPayslips, ...prev]);
    } finally {
      setIsSaving(false);
    }
  };

  const handleViewPdf = (payslip: PayrollPayslip) => {
    const blob = new Blob([payslip.pdfContent], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const visiblePayslips = payslips.filter(
    (item) => item.periodType === periodType && item.periodMonth === periodMonth,
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Payslips quincenales</h2>
          <p className="text-sm text-slate-600">Genera y registra envios por correo (mock).</p>
        </div>
        <Button size="sm" onClick={() => void handleGenerate()} disabled={isSaving}>
          {isSaving ? "Generando..." : "Generar reporte y pagos"}
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
            value={periodMonth}
            onChange={(event) => setPeriodMonth(event.target.value)}
          />
        </div>
      </div>

      <div className="mt-4 overflow-auto rounded-md border border-slate-200">
        <table className="min-w-[1200px] w-full border-collapse text-xs">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">Empleado</th>
              <th className="px-3 py-2">Correo</th>
              <th className="px-3 py-2">Bruto</th>
              <th className="px-3 py-2">Deducciones</th>
              <th className="px-3 py-2">Retencion</th>
              <th className="px-3 py-2">Neto</th>
              <th className="px-3 py-2">Enviado</th>
              <th className="px-3 py-2">Accion</th>
            </tr>
          </thead>
          <tbody>
            {visiblePayslips.length === 0 ? (
              <tr className="border-t border-slate-100">
                <td className="px-3 py-4 text-center text-sm text-slate-500" colSpan={8}>
                  Sin payslips
                </td>
              </tr>
            ) : (
              visiblePayslips.map((payslip) => {
                const employee = users.find((entry) => entry.id === payslip.userId);
                return (
                  <tr key={payslip.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-700">{employee?.name ?? "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{employee?.email ?? "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{payslip.grossPay.toFixed(2)}</td>
                    <td className="px-3 py-2 text-slate-600">{payslip.deductionPay.toFixed(2)}</td>
                    <td className="px-3 py-2 text-slate-600">{payslip.retentionPay.toFixed(2)}</td>
                    <td className="px-3 py-2 text-slate-600">{payslip.netPay.toFixed(2)}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {payslip.sentAt ? new Date(payslip.sentAt).toLocaleString() : "-"}
                    </td>
                    <td className="px-3 py-2">
                      <Button size="sm" variant="outline" onClick={() => handleViewPdf(payslip)}>
                        Ver PDF
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
