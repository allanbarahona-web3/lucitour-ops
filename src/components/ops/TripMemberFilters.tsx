"use client";

import type { ChangeEvent } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import type { User } from "../../lib/types/ops";

export interface TripMemberFilterState {
  search: string;
  assignedToId: string;
  pendingOnly: boolean;
}

interface TripMemberFiltersProps {
  users: User[];
  filters: TripMemberFilterState;
  onChange: (next: TripMemberFilterState) => void;
}

export const TripMemberFilters = ({ users, filters, onChange }: TripMemberFiltersProps) => (
  <div className="flex flex-wrap items-end gap-4 rounded-lg border border-slate-200 bg-white p-4">
    <div className="min-w-[200px] flex-1 space-y-2">
      <Label htmlFor="filter-search">Buscar</Label>
      <Input
        id="filter-search"
        placeholder="Nombre o reserva"
        value={filters.search}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChange({ ...filters, search: event.target.value })
        }
      />
    </div>
    <div className="min-w-[200px] space-y-2">
      <Label htmlFor="filter-assigned">Asignado a</Label>
      <select
        id="filter-assigned"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        value={filters.assignedToId}
        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
          onChange({ ...filters, assignedToId: event.target.value })
        }
      >
        <option value="">Todos</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name}
          </option>
        ))}
      </select>
    </div>
    <div className="flex items-center gap-2">
      <input
        id="filter-pending"
        type="checkbox"
        className="h-4 w-4 rounded border-slate-300"
        checked={filters.pendingOnly}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChange({ ...filters, pendingOnly: event.target.checked })
        }
      />
      <Label htmlFor="filter-pending">Solo pendientes</Label>
    </div>
    <Button
      variant="secondary"
      type="button"
      onClick={() => onChange({ search: "", assignedToId: "", pendingOnly: false })}
    >
      Limpiar
    </Button>
  </div>
);
