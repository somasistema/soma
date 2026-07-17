"use client";

import { FileText, LayoutDashboard, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ICONS = {
  "/dashboard": LayoutDashboard,
  "/orcamentos": FileText,
  "/servicos": Settings,
} as const;

export function SidebarNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();

  return (
    <nav className="mt-6 flex flex-col gap-1.5">
      {items.map((item) => {
        const Icon = ICONS[item.href as keyof typeof ICONS] ?? LayoutDashboard;
        const ativo = pathname === item.href || pathname?.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              ativo
                ? "bg-brand/5 text-brand"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
