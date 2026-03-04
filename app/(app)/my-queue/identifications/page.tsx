"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOpsRepo } from "@/lib/data/opsRepo";
import { useSession } from "@/lib/auth/sessionContext";
import { DocsStatus, PassportStatus, type DocumentUpload, type Trip, type TripMember } from "@/lib/types/ops";

type RowItem = {
  member: TripMember;
  trip: Trip | null;
  idDocs: DocumentUpload[];
};

const getIdDocs = (member: TripMember) =>
  member.documents.filter(
    (doc) => doc.type === "ID_CARD" || doc.type === "PASSPORT",
  );

export default function MyQueueIdentificationsPage() {
  const repo = useMemo(() => getOpsRepo(), []);
  const { user } = useSession();
  const [rows, setRows] = useState<RowItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const loadRows = async () => {
      setIsLoading(true);
      const [queueMembers, trips] = await Promise.all([
        repo.deriveQueue(user.id),
        repo.listTrips(),
      ]);
      const tripMap = trips.reduce<Record<string, Trip>>((acc, trip) => {
        acc[trip.id] = trip;
        return acc;
      }, {});
      const nextRows = queueMembers
        .filter(
          (member) =>
            member.passportStatus === PassportStatus.NOT_ENTERED ||
            member.docsStatus === DocsStatus.NOT_UPLOADED,
        )
        .map((member) => ({
          member,
          trip: tripMap[member.tripId] ?? null,
          idDocs: getIdDocs(member),
        }));
      setRows(nextRows);
      setIsLoading(false);
    };

    void loadRows();
  }, [repo, user.id]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return rows;
    }
    return rows.filter(({ member }) => {
      const haystack = `${member.fullName} ${member.identification} ${member.reservationCode}`
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [query, rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Identificaciones</h1>
          <p className="text-sm text-slate-600">Cedulas y pasaportes pendientes.</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <input
            className="w-full min-w-[220px] rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 sm:w-auto"
            placeholder="Buscar por nombre, ID o reserva"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            Actualizar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clientes</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          {isLoading ? (
            <p className="text-sm text-slate-600">Cargando...</p>
          ) : filteredRows.length === 0 ? (
            <p className="text-sm text-slate-500">Sin pendientes</p>
          ) : (
            <table className="min-w-[980px] w-full border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-600">
                <tr>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Reserva</th>
                  <th className="px-3 py-2">Documentos</th>
                  <th className="px-3 py-2">Viaje</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(({ member, trip, idDocs }) => (
                  <tr key={member.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-900">{member.fullName}</td>
                    <td className="px-3 py-2 text-slate-600">{member.identification || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{member.reservationCode}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {idDocs.length === 0 ? (
                        <span className="text-slate-400">Sin documentos</span>
                      ) : (
                        <div className="flex flex-wrap gap-2 text-[11px]">
                          {idDocs.map((doc) => (
                            <span
                              key={doc.id}
                              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5"
                            >
                              {doc.type === "PASSPORT" ? "Pasaporte" : "Cedula"} · {doc.fileName}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{trip ? trip.name : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
