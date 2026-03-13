"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddCatalogItemDialog } from "@/components/ops/AddCatalogItemDialog";
import { useSession } from "@/lib/auth/sessionContext";
import { getOpsRepo } from "@/lib/data/opsRepo";
import type { BillingConfig, CatalogItem, CatalogName, QuoteFeeTier } from "@/lib/types/ops";

const sections: { key: CatalogName; label: string }[] = [
  { key: "airlines", label: "Aerolineas" },
  { key: "lodgingTypes", label: "Hospedaje" },
  { key: "accommodations", label: "Acomodacion" },
  { key: "insurances", label: "Seguros" },
  { key: "nationalities", label: "Nacionalidades" },
  { key: "identificationTypes", label: "Identificacion" },
];

const makeTierId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `fee-tier-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const toPercent = (value: number | undefined) =>
  Number.isFinite(value) ? String(Math.round((value ?? 0) * 10000) / 100) : "";

const fromPercent = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed / 100 : 0;
};

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
  const [configDraft, setConfigDraft] = useState<BillingConfig | null>(null);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configMessage, setConfigMessage] = useState("");

  useEffect(() => {
    const loadCatalogs = async () => {
      const [
        airlines,
        lodgingTypes,
        accommodations,
        insurances,
        nationalities,
        identificationTypes,
        billingConfig,
      ] = await Promise.all([
        repo.listCatalog("airlines"),
        repo.listCatalog("lodgingTypes"),
        repo.listCatalog("accommodations"),
        repo.listCatalog("insurances"),
        repo.listCatalog("nationalities"),
        repo.listCatalog("identificationTypes"),
        repo.getBillingConfig(),
      ]);

      setCatalogs({
        airlines,
        lodgingTypes,
        accommodations,
        insurances,
        nationalities,
        identificationTypes,
      });
      setConfigDraft(billingConfig);
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

  const updateConfigDraft = (patch: Partial<BillingConfig>) => {
    setConfigDraft((prev) => (prev ? { ...prev, ...patch } : prev));
    setConfigMessage("");
  };

  const updateMarginRate = (key: keyof BillingConfig["quoteMarginRates"], value: string) => {
    setConfigDraft((prev) =>
      prev
        ? {
            ...prev,
            quoteMarginRates: {
              ...prev.quoteMarginRates,
              [key]: fromPercent(value),
            },
          }
        : prev,
    );
    setConfigMessage("");
  };

  const updateFeeTier = (tierId: string, patch: Partial<QuoteFeeTier>) => {
    setConfigDraft((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        perPaxFeeTiers: prev.perPaxFeeTiers.map((tier) =>
          tier.id === tierId ? { ...tier, ...patch } : tier,
        ),
      };
    });
    setConfigMessage("");
  };

  const addFeeTier = () => {
    setConfigDraft((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        perPaxFeeTiers: [
          ...prev.perPaxFeeTiers,
          { id: makeTierId(), minPax: 1, maxPax: null, feePerPax: 0 },
        ],
      };
    });
    setConfigMessage("");
  };

  const removeFeeTier = (tierId: string) => {
    setConfigDraft((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        perPaxFeeTiers: prev.perPaxFeeTiers.filter((tier) => tier.id !== tierId),
      };
    });
    setConfigMessage("");
  };

  const handleSaveConfig = async () => {
    if (!configDraft) {
      return;
    }
    setIsSavingConfig(true);
    const updated = await repo.updateBillingConfig({
      exchangeRate: configDraft.exchangeRate,
      cardFeeRate: configDraft.cardFeeRate,
      vendorCommissionRate: configDraft.vendorCommissionRate,
      taxRate: configDraft.taxRate,
      quoteMarginRates: configDraft.quoteMarginRates,
      perPaxFeeTiers: configDraft.perPaxFeeTiers,
    });
    setConfigDraft(updated);
    setConfigMessage("Configuracion guardada.");
    setIsSavingConfig(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Catalogos</h1>
        <p className="text-sm text-slate-600">Administra los catalogos base.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuracion de cotizaciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Margenes por rubro (%)</p>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-600">Vuelos internacionales</label>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={toPercent(configDraft?.quoteMarginRates.flightsInternational)}
                  onChange={(event) => updateMarginRate("flightsInternational", event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-600">Vuelos internos</label>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={toPercent(configDraft?.quoteMarginRates.flightsDomestic)}
                  onChange={(event) => updateMarginRate("flightsDomestic", event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-600">Tours</label>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={toPercent(configDraft?.quoteMarginRates.tours)}
                  onChange={(event) => updateMarginRate("tours", event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-600">Hospedaje</label>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={toPercent(configDraft?.quoteMarginRates.lodging)}
                  onChange={(event) => updateMarginRate("lodging", event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-600">Traslados</label>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={toPercent(configDraft?.quoteMarginRates.transfers)}
                  onChange={(event) => updateMarginRate("transfers", event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-600">Extras</label>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={toPercent(configDraft?.quoteMarginRates.extras)}
                  onChange={(event) => updateMarginRate("extras", event.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Recargos globales (%)</p>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-600">Tipo de cambio (CRC por USD)</label>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  type="number"
                  min={0}
                  step="0.01"
                  value={configDraft?.exchangeRate ?? ""}
                  onChange={(event) =>
                    updateConfigDraft({
                      exchangeRate: event.target.value === "" ? 0 : Number(event.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-600">Tarjetas</label>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={toPercent(configDraft?.cardFeeRate)}
                  onChange={(event) =>
                    updateConfigDraft({ cardFeeRate: fromPercent(event.target.value) })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-600">Comision vendedor</label>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={toPercent(configDraft?.vendorCommissionRate)}
                  onChange={(event) =>
                    updateConfigDraft({ vendorCommissionRate: fromPercent(event.target.value) })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-600">IVA</label>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={toPercent(configDraft?.taxRate)}
                  onChange={(event) => updateConfigDraft({ taxRate: fromPercent(event.target.value) })}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Fee por pasajero</p>
            <div className="space-y-2">
              {configDraft?.perPaxFeeTiers.map((tier) => (
                <div
                  key={tier.id}
                  className="grid items-center gap-2 rounded-md border border-slate-200 p-3 text-sm md:grid-cols-[1fr_1fr_1fr_auto]"
                >
                  <input
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                    type="number"
                    min={1}
                    value={tier.minPax}
                    onChange={(event) =>
                      updateFeeTier(tier.id, {
                        minPax: event.target.value ? Number(event.target.value) : 1,
                      })
                    }
                  />
                  <input
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                    type="number"
                    min={tier.minPax}
                    placeholder="Sin max"
                    value={tier.maxPax ?? ""}
                    onChange={(event) =>
                      updateFeeTier(tier.id, {
                        maxPax: event.target.value ? Number(event.target.value) : null,
                      })
                    }
                  />
                  <input
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                    type="number"
                    min={0}
                    value={tier.feePerPax}
                    onChange={(event) =>
                      updateFeeTier(tier.id, {
                        feePerPax: event.target.value ? Number(event.target.value) : 0,
                      })
                    }
                  />
                  <Button size="sm" variant="outline" onClick={() => removeFeeTier(tier.id)}>
                    Quitar
                  </Button>
                  <div className="text-xs text-slate-500 md:col-span-4">
                    Rango: {tier.minPax} a {tier.maxPax ?? "en adelante"} pax
                  </div>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={addFeeTier}>
                Agregar rango
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleSaveConfig} disabled={isSavingConfig}>
              {isSavingConfig ? "Guardando..." : "Guardar configuracion"}
            </Button>
            {configMessage ? <span className="text-xs text-emerald-600">{configMessage}</span> : null}
          </div>
        </CardContent>
      </Card>

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
