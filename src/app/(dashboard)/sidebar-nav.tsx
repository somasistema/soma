"use client";

import { FileText, Folder, LayoutDashboard, Settings } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ICONS = {
  "/dashboard": LayoutDashboard,
  "/orcamentos": FileText,
  "/processos": Folder,
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
              "relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              ativo ? "text-brand" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {ativo && (
              <motion.span
                layoutId="sidebar-ativo"
                className="absolute inset-0 rounded-xl bg-brand/5"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <Icon className="relative z-10 h-4 w-4" />
            <span className="relative z-10">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
