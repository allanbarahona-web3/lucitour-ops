"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { AddCatalogItemDialog } from "../../../../components/ops/AddCatalogItemDialog";
import { useSession } from "../../../../lib/auth/sessionContext";
import { getOpsRepo } from "../../../../lib/data/opsRepo";
import type { CatalogItem, CatalogName } from "../../../../lib/types/ops";

const sections: { key: CatalogName; label: string }[] = [
  { key: "airlines", label: "Aerolineas" },
  { key: "lodgingTypes", label: "Hospedaje" },
  { key: "accommodations", label: "Acomodacion" },
  { key: "insurances", label: "Seguros" },
  { key: "nationalities", label: "Nacionalidades" },
  { key: "identificationTypes", label: "Identificacion" },
];

export default function CatalogsPage() {
  const repo = useMemo(() => getOpsRepo(), []);
  const { user } = useSession();
  const [catalogs, setCatalogs] = useState<Record<CatalogName, CatalogItem[]>>({
    airlines: [],
    lodgingTypes: [],
    accommodations: [],
    insurances: [],
    nationalities: [],
    identificationTypes: [],
  });
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogCatalog, setDialogCatalog] = useState<CatalogName | null>(null);

  useEffect(() => {
    const loadCatalogs = async () => {
      const [
        airlines,
        lodgingTypes,
        accommodations,
        insurances,
        nationalities,
        identificationTypes,
      ] = await Promise.all([
        repo.listCatalog("airlines"),
        repo.listCatalog("lodgingTypes"),
        repo.listCatalog("accommodations"),
        repo.listCatalog("insurances"),
        repo.listCatalog("nationalities"),
        repo.listCatalog("identificationTypes"),
      ]);

      setCatalogs({
        airlines,
        lodgingTypes,
        accommodations,
        insurances,
        nationalities,
        identificationTypes,
      });
    };

    void loadCatalogs();
  }, [repo]);

  if (user.role !== "ADMIN") {
    return <div className="text-sm text-slate-600">No autorizado</div>;
  }

  const handleToggle = async (catalogName: CatalogName, item: CatalogItem) => {
    const updated = await repo.updateCatalogItem(catalogName, item.id, {
      active: !item.active,
    });

    if (!updated) {
      return;
    }

    setCatalogs((prev) => ({
      ...prev,
      [catalogName]: prev[catalogName].map((entry) => (entry.id === item.id ? updated : entry)),
    }));
  };

  const handleNameChange = (itemId: string, value: string) => {
    setNameDrafts((prev) => ({ ...prev, [itemId]: value }));
  };

  const handleSaveName = async (catalogName: CatalogName, item: CatalogItem) => {
    const nextName = (nameDrafts[item.id] ?? item.name).trim();
    if (!nextName || nextName === item.name) {
      return;
    }

    const updated = await repo.updateCatalogItem(catalogName, item.id, { name: nextName });
    if (!updated) {
      return;
    }

    setCatalogs((prev) => ({
      ...prev,
      [catalogName]: prev[catalogName].map((entry) => (entry.id === item.id ? updated : entry)),
    }));
    setNameDrafts((prev) => ({ ...prev, [item.id]: updated.name }));
  };

  const handleDelete = async (catalogName: CatalogName, item: CatalogItem) => {
    const removed = await repo.deleteCatalogItem(catalogName, item.id);
    if (!removed) {
      return;
    }

    setCatalogs((prev) => ({
      ...prev,
      [catalogName]: prev[catalogName].filter((entry) => entry.id !== item.id),
    }));
    setNameDrafts((prev) => {
      const { [item.id]: _, ...rest } = prev;
      return rest;
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Catalogos</h1>
        <p className="text-sm text-slate-600">Administra los catalogos base.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.key}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{section.label}</CardTitle>
              <Button
                size="sm"
                onClick={() => {
                  setDialogCatalog(section.key);
                  setDialogOpen(true);
                }}
              >
                Agregar
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {catalogs[section.key].length === 0 ? (
                <p className="text-sm text-slate-500">Sin items</p>
              ) : (
                catalogs[section.key].map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm"
                  >
                    <div className="flex flex-1 items-center gap-2">
                      <input
                        className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-900"
                        value={nameDrafts[item.id] ?? item.name}
                        onChange={(event) => handleNameChange(item.id, event.target.value)}
                      />
                      {!item.active ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                          Inactivo
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleSaveName(section.key, item)}
                      >
                        Guardar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleDelete(section.key, item)}
                      >
                        Eliminar
                      </Button>
                      <label className="flex items-center gap-2 text-xs text-slate-500">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300"
                          checked={item.active}
                          onChange={() => void handleToggle(section.key, item)}
                        />
                        Activo
                      </label>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <AddCatalogItemDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setDialogCatalog(null);
          }
        }}
        catalogName={dialogCatalog}
        repo={repo}
        onCreated={(item) => {
          if (!dialogCatalog) {
            return;
          }
          setCatalogs((prev) => ({
            ...prev,
            [dialogCatalog]: [...prev[dialogCatalog], item],
          }));
        }}
      />
    </div>
  );
}
