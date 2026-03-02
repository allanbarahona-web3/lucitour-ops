"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import type { CatalogItem, CatalogName } from "../../lib/types/ops";
import type { IOpsRepo } from "../../lib/data/opsRepo";

const schema = z.object({
  name: z.string().min(2, "Nombre requerido"),
});

type FormValues = z.infer<typeof schema>;

interface AddCatalogItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogName: CatalogName | null;
  repo: IOpsRepo;
  onCreated: (item: CatalogItem) => void;
}

export const AddCatalogItemDialog = ({
  open,
  onOpenChange,
  catalogName,
  repo,
  onCreated,
}: AddCatalogItemDialogProps) => {
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  });

  useEffect(() => {
    if (!open) {
      form.reset({ name: "" });
    }
  }, [open, form]);

  const handleSubmit = form.handleSubmit(async (values: FormValues) => {
    if (!catalogName) {
      return;
    }

    setIsSaving(true);
    try {
      const created = await repo.addCatalogItem(catalogName, values.name.trim());
      onCreated(created);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar item</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="catalog-name">Nombre</Label>
            <Input id="catalog-name" {...form.register("name")} />
            {form.formState.errors.name ? (
              <p className="text-xs text-red-600">{form.formState.errors.name.message}</p>
            ) : null}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
