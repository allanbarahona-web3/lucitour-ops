"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetTrigger } from "../ui/sheet";
import { Button } from "../ui/button";
import type { Role } from "../../lib/types/ops";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", roles: ["ADMIN"] as Role[] },
  {
    href: "/trips",
    label: "Viajes",
    roles: ["ADMIN", "AGENT", "SUPERVISOR"] as Role[],
  },
  {
    href: "/my-queue",
    label: "Mi Cola",
    roles: ["ADMIN", "AGENT", "SUPERVISOR", "VIEWER"] as Role[],
  },
  {
    href: "/time-tracking",
    label: "Marcaje",
    roles: [
      "ADMIN",
      "AGENT",
      "SUPERVISOR",
      "ACCOUNTING",
      "CONTRACTS",
      "QUOTES",
      "BILLING",
      "VIEWER",
    ] as Role[],
  },
  { href: "/leads", label: "Leads", roles: ["ADMIN", "AGENT", "SUPERVISOR"] as Role[] },
  { href: "/contracts", label: "Contratos", roles: ["ADMIN", "CONTRACTS"] as Role[] },
  {
    href: "/contracts/modifications",
    label: "Modificaciones",
    roles: ["ADMIN", "CONTRACTS"] as Role[],
    badgeKey: "modifications",
  },
  { href: "/accounting", label: "Contabilidad", roles: ["ADMIN", "ACCOUNTING"] as Role[] },
  { href: "/quotes", label: "Cotizaciones", roles: ["ADMIN", "QUOTES"] as Role[] },
  { href: "/billing", label: "Facturacion", roles: ["ADMIN", "BILLING", "ACCOUNTING"] as Role[] },
  { href: "/admin/users", label: "Usuarios", roles: ["ADMIN"] as Role[] },
  { href: "/admin/catalogs", label: "Catalogos", roles: ["ADMIN"] as Role[] },
];

interface SidebarProps {
  role: Role;
  modificationCount?: number;
}

const isActive = (pathname: string, href: string) =>
  pathname === href || (pathname.startsWith(href) && href !== "/");

export const Sidebar = ({ role, modificationCount = 0 }: SidebarProps) => {
  const pathname = usePathname();

  const items = navItems.filter((item) => item.roles.includes(role));

  const renderLinks = () => (
    <nav className="flex flex-col gap-2">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        const showBadge = item.badgeKey === "modifications" && modificationCount > 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-slate-900 text-white"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <span>{item.label}</span>
            {showBadge ? (
              <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-rose-500" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <aside className="hidden h-full w-64 flex-col border-r border-slate-200 bg-white px-4 py-6 md:flex">
        <div className="mb-6 text-xl font-semibold text-cyan-600">OPS - LUCITOUR</div>
        {renderLinks()}
      </aside>

      <div className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              Menu
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72">
            <div className="mb-6 text-xl font-semibold text-cyan-600">OPS - LUCITOUR</div>
            {renderLinks()}
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
};
