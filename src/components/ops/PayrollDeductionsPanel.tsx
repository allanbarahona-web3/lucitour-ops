"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/button";
import { getOpsRepo } from "../../lib/data/opsRepo";
import { useSession } from "../../lib/auth/sessionContext";
import type { PayrollDeduction } from "../../lib/types/ops";

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

export const PayrollDeductionsPanel = () => {
  const repo = useMemo(() => getOpsRepo(), []);
  const { users, user } = useSession();
  const [periodType, setPeriodType] = useState("biweekly_1");
  const [periodMonth, setPeriodMonth] = useState(new Date().toISOString().slice(0, 7));
  const [targetUserId, setTargetUserId] = useState(users[0]?.id ?? user.id);
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  const [receiptNote, setReceiptNote] = useState("");
  const [deductions, setDeductions] = useState<PayrollDeduction[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const userById = useMemo(() => {
    const map = new Map(users.map((entry) => [entry.id, entry.name]));
    return map;
  }, [users]);

  const loadDeductions = async () => {
    const data = await repo.listPayrollDeductions();
    setDeductions(data);
  };

  useEffect(() => {
    void loadDeductions();
  }, []);

  const visibleDeductions = useMemo(
    () =>
      deductions.filter(
        (item) => item.periodType === periodType && item.periodMonth === periodMonth,
      ),
    [deductions, periodMonth, periodType],
  );

  const handleCreate = async () => {
    if (!targetUserId || amount <= 0 || !reason.trim()) {
      return;
    }
    setIsSaving(true);
    try {
      const created = await repo.addPayrollDeduction({
        userId: targetUserId,
        periodType: periodType as PayrollDeduction["periodType"],
        periodMonth,
        amount,
        reason: reason.trim(),
        receiptNote: receiptNote.trim(),
      });
      setDeductions((prev) => [created, ...prev]);
      setAmount(0);
      setReason("");
      setReceiptNote("");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (user.role !== "ADMIN") {
      return;
    }
    const ok = await repo.deletePayrollDeduction(id);
    if (ok) {
      setDeductions((prev) => prev.filter((item) => item.id !== id));
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Deducciones nominales</h2>
          <p className="text-sm text-slate-600">Registro de rebajos con comprobante.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadDeductions()}>
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
            value={periodMonth}
            onChange={(event) => setPeriodMonth(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <div className="text-xs font-semibold text-slate-600">Empleado</div>
          <select
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900"
            value={targetUserId}
            onChange={(event) => setTargetUserId(event.target.value)}
          >
            {users.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <div className="text-xs font-semibold text-slate-600">Monto (colones)</div>
          <input
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900"
            type="number"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(Number(event.target.value || 0))}
          />
        </div>
        <div className="space-y-1">
          <div className="text-xs font-semibold text-slate-600">Motivo</div>
          <input
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <div className="text-xs font-semibold text-slate-600">Comprobante</div>
          <input
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900"
            value={receiptNote}
            onChange={(event) => setReceiptNote(event.target.value)}
            placeholder="Ej: Enviado por correo"
          />
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <Button size="sm" onClick={() => void handleCreate()} disabled={isSaving}>
          {isSaving ? "Guardando..." : "Registrar deduccion"}
        </Button>
      </div>

      <div className="mt-4 overflow-auto rounded-md border border-slate-200">
        <table className="min-w-[1000px] w-full border-collapse text-xs">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Empleado</th>
              <th className="px-3 py-2">Monto</th>
              <th className="px-3 py-2">Motivo</th>
              <th className="px-3 py-2">Comprobante</th>
              <th className="px-3 py-2">Registrado por</th>
              <th className="px-3 py-2">Accion</th>
            </tr>
          </thead>
          <tbody>
            {visibleDeductions.length === 0 ? (
              <tr className="border-t border-slate-100">
                <td className="px-3 py-4 text-center text-sm text-slate-500" colSpan={7}>
                  Sin deducciones
                </td>
              </tr>
            ) : (
              visibleDeductions.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-600">{formatDate(item.createdAt)}</td>
                  <td className="px-3 py-2 text-slate-700">
                    {userById.get(item.userId) ?? "-"}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{item.amount.toFixed(2)}</td>
                  <td className="px-3 py-2 text-slate-600">{item.reason}</td>
                  <td className="px-3 py-2 text-slate-600">{item.receiptNote || "-"}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {userById.get(item.createdByUserId) ?? "-"}
                  </td>
                  <td className="px-3 py-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleDelete(item.id)}
                      disabled={user.role !== "ADMIN"}
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
  );
};
