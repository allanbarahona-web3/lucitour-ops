"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "../../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { getOpsRepo } from "../../../lib/data/opsRepo";
import { useSession } from "../../../lib/auth/sessionContext";
import type { Client, ClientPurchase } from "../../../lib/types/ops";
import { BillingStatus, Role } from "../../../lib/types/ops";

type ClientDraft = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  medicalNotes: string;
};

const emptyDraft: ClientDraft = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  medicalNotes: "",
};

const formatDate = (value: string | null) => {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleDateString();
};

const formatMoney = (value: number | null) => {
  if (value === null) {
    return "-";
  }
  const formatted = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
  return `USD ${formatted}`;
};

const billingLabels: Record<BillingStatus, string> = {
  [BillingStatus.NOT_SENT]: "Pendiente",
  [BillingStatus.SENT]: "Enviado",
};

export default function ClientsPage() {
  const searchParams = useSearchParams();
  const repo = useMemo(() => getOpsRepo(), []);
  const { user } = useSession();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<ClientDraft>(emptyDraft);
  const [createError, setCreateError] = useState("");

  const [editDialog, setEditDialog] = useState<{ open: boolean; client: Client | null }>(
    { open: false, client: null },
  );
  const [editDraft, setEditDraft] = useState<ClientDraft>(emptyDraft);
  const [editError, setEditError] = useState("");

  const [historyDialog, setHistoryDialog] = useState<{ open: boolean; client: Client | null }>(
    { open: false, client: null },
  );
  const [historyItems, setHistoryItems] = useState<ClientPurchase[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const openedFromQuery = useRef(false);

  const isSupervisor = user.role === Role.SUPERVISOR;
  const isAdmin = user.role === Role.ADMIN;
  const canManage = isSupervisor || isAdmin;

  const loadData = async () => {
    setIsLoading(true);
    const clientsData = await repo.listClients();
    setClients(clientsData);
    setIsLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const getClientName = (client: Client) =>
    client.fullName || `${client.firstName} ${client.lastName}`.trim();

  const filteredClients = clients.filter((client) => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return true;
    }
    return (
      getClientName(client).toLowerCase().includes(query) ||
      client.email.toLowerCase().includes(query) ||
      client.phone.toLowerCase().includes(query)
    );
  });

  const resetCreateDialog = () => {
    setCreateDraft(emptyDraft);
    setCreateError("");
  };

  const handleCreateClient = async () => {
    const trimmedFirst = createDraft.firstName.trim();
    const trimmedLast = createDraft.lastName.trim();
    if (!trimmedFirst || !trimmedLast) {
      setCreateError("Nombre y apellidos requeridos.");
      return;
    }

    const created = await repo.createClient({
      firstName: trimmedFirst,
      lastName: trimmedLast,
      email: createDraft.email.trim().toLowerCase(),
      phone: createDraft.phone.trim(),
      medicalNotes: createDraft.medicalNotes.trim(),
    });
    setClients((prev) => [created, ...prev]);
    setCreateDialogOpen(false);
    resetCreateDialog();
  };

  const openEditDialog = (client: Client) => {
    setEditDialog({ open: true, client });
    setEditDraft({
      firstName: client.firstName,
      lastName: client.lastName,
      phone: client.phone,
      email: client.email,
      medicalNotes: client.medicalNotes,
    });
    setEditError("");
  };

  const handleUpdateClient = async () => {
    if (!editDialog.client) {
      return;
    }
    const trimmedFirst = editDraft.firstName.trim();
    const trimmedLast = editDraft.lastName.trim();
    if (!trimmedFirst || !trimmedLast) {
      setEditError("Nombre y apellidos requeridos.");
      return;
    }
    const updated = await repo.updateClient(editDialog.client.id, {
      firstName: trimmedFirst,
      lastName: trimmedLast,
      email: editDraft.email.trim().toLowerCase(),
      phone: editDraft.phone.trim(),
      medicalNotes: editDraft.medicalNotes.trim(),
    });
    if (updated) {
      setClients((prev) => prev.map((client) => (client.id === updated.id ? updated : client)));
    }
    setEditDialog({ open: false, client: null });
  };

  const handleDelete = async (clientId: string) => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Seguro que deseas eliminar este cliente?");
      if (!confirmed) {
        return;
      }
    }
    const removed = await repo.deleteClient(clientId);
    if (removed) {
      setClients((prev) => prev.filter((client) => client.id !== clientId));
    }
  };

  const openHistory = useCallback(
    async (client: Client) => {
      setHistoryDialog({ open: true, client });
      setIsHistoryLoading(true);
      const items = await repo.listClientPurchases(client.id);
      setHistoryItems(items);
      setIsHistoryLoading(false);
    },
    [repo],
  );

  useEffect(() => {
    const targetClientId = searchParams.get("clientId");
    if (!targetClientId || openedFromQuery.current || isLoading) {
      return;
    }
    const target = clients.find((client) => client.id === targetClientId);
    if (target) {
      openedFromQuery.current = true;
      void openHistory(target);
    }
  }, [clients, isLoading, openHistory, searchParams]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Clientes</h1>
          <p className="text-sm text-slate-600">
            Registro de clientes que ya han reservado o comprado.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadData()}>
            Actualizar
          </Button>
          {canManage ? (
            <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
              Nuevo cliente
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por nombre, correo o telefono"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-600">Cargando clientes...</p>
      ) : (
        <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-[1100px] w-full border-collapse text-xs">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Apellidos</th>
                <th className="px-3 py-2">Correo</th>
                <th className="px-3 py-2">Telefono</th>
                <th className="px-3 py-2">Afecciones</th>
                <th className="px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length === 0 ? (
                <tr className="border-t border-slate-100">
                  <td className="px-3 py-6 text-center text-sm text-slate-500" colSpan={6}>
                    Sin clientes registrados.
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr key={client.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-900">{client.firstName}</td>
                    <td className="px-3 py-2 text-slate-600">{client.lastName}</td>
                    <td className="px-3 py-2 text-slate-600">{client.email || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{client.phone || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {client.medicalNotes || "-"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => openHistory(client)}>
                          Historial
                        </Button>
                        {canManage ? (
                          <Button size="sm" variant="outline" onClick={() => openEditDialog(client)}>
                            Editar
                          </Button>
                        ) : null}
                        {canManage ? (
                          <Button size="sm" variant="outline" onClick={() => void handleDelete(client.id)}>
                            Eliminar
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) {
            resetCreateDialog();
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nuevo cliente</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={createDraft.firstName}
                onChange={(event) =>
                  setCreateDraft((prev) => ({ ...prev, firstName: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Apellidos</Label>
              <Input
                value={createDraft.lastName}
                onChange={(event) =>
                  setCreateDraft((prev) => ({ ...prev, lastName: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Telefono</Label>
              <Input
                value={createDraft.phone}
                onChange={(event) =>
                  setCreateDraft((prev) => ({ ...prev, phone: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Correo</Label>
              <Input
                value={createDraft.email}
                onChange={(event) =>
                  setCreateDraft((prev) => ({ ...prev, email: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Afecciones</Label>
              <textarea
                className="min-h-[80px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={createDraft.medicalNotes}
                onChange={(event) =>
                  setCreateDraft((prev) => ({ ...prev, medicalNotes: event.target.value }))
                }
              />
            </div>
          </div>
          {createError ? <p className="text-xs text-rose-600">{createError}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleCreateClient()}>Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setEditDialog({ open: false, client: null });
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={editDraft.firstName}
                onChange={(event) =>
                  setEditDraft((prev) => ({ ...prev, firstName: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Apellidos</Label>
              <Input
                value={editDraft.lastName}
                onChange={(event) =>
                  setEditDraft((prev) => ({ ...prev, lastName: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Telefono</Label>
              <Input
                value={editDraft.phone}
                onChange={(event) =>
                  setEditDraft((prev) => ({ ...prev, phone: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Correo</Label>
              <Input
                value={editDraft.email}
                onChange={(event) =>
                  setEditDraft((prev) => ({ ...prev, email: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Afecciones</Label>
              <textarea
                className="min-h-[80px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={editDraft.medicalNotes}
                onChange={(event) =>
                  setEditDraft((prev) => ({ ...prev, medicalNotes: event.target.value }))
                }
              />
            </div>
          </div>
          {editError ? <p className="text-xs text-rose-600">{editError}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditDialog({ open: false, client: null })}>
              Cancelar
            </Button>
            <Button onClick={() => void handleUpdateClient()}>Guardar cambios</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={historyDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setHistoryDialog({ open: false, client: null });
            setHistoryItems([]);
          }
        }}
      >
        <DialogContent className="w-[95vw] max-w-6xl">
          <DialogHeader>
            <DialogTitle>
              Historial de {historyDialog.client ? getClientName(historyDialog.client) : "cliente"}
            </DialogTitle>
          </DialogHeader>
          {isHistoryLoading ? (
            <p className="text-sm text-slate-600">Cargando historial...</p>
          ) : historyItems.length === 0 ? (
            <p className="text-sm text-slate-600">Sin compras registradas.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="min-w-[800px] w-full border-collapse text-xs">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Reserva</th>
                    <th className="px-3 py-2">Viaje</th>
                    <th className="px-3 py-2">Fechas</th>
                    <th className="px-3 py-2">Estado contratos</th>
                    <th className="px-3 py-2">Estado pago</th>
                    <th className="px-3 py-2">Monto USD</th>
                    <th className="px-3 py-2">Enviado</th>
                  </tr>
                </thead>
                <tbody>
                  {historyItems.map((item) => (
                    <tr key={item.memberId} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-600">
                        <Link
                          href={`/trips/${item.tripId}?focus=${item.memberId}`}
                          className="font-semibold text-cyan-700 hover:underline"
                        >
                          {item.reservationCode}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{item.tripName}</td>
                      <td className="px-3 py-2 text-slate-600">
                        {item.tripDateFrom} - {item.tripDateTo}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{item.contractsStatus}</td>
                      <td className="px-3 py-2 text-slate-600">
                        {billingLabels[item.billingStatus]}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{formatMoney(item.totalAmount)}</td>
                      <td className="px-3 py-2 text-slate-600">
                        {formatDate(item.contractsSentAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={() => setHistoryDialog({ open: false, client: null })}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
