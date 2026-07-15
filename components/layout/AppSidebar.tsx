"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  FileSpreadsheet,
  Users,
  Wallet,
  TrendingUp,
  BookOpen,
  Settings,
  ChevronRight
} from "lucide-react";
import GlobalSearch from "./GlobalSearch";

interface AppSidebarProps {
  className?: string;
  onItemClick?: () => void;
}

export default function AppSidebar({ className, onItemClick }: AppSidebarProps) {
  const pathname = usePathname();
  const [orgName, setOrgName] = useState("");

  useEffect(() => {
    const loadOrg = async () => {
      try {
        const supabase = createBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: userData } = await supabase
          .schema("nafaflow")
          .from("users")
          .select("org_id")
          .eq("id", user.id)
          .single();
        if (!userData?.org_id) return;
        const { data: org } = await supabase
          .schema("nafaflow")
          .from("orgs")
          .select("name")
          .eq("id", userData.org_id)
          .single();
        if (org?.name) setOrgName(org.name);
      } catch (err) {
        console.error("Sidebar org loading error:", err);
      }
    };
    loadOrg();
  }, []);

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Devis", href: "/devis", icon: FileText },
    { name: "Factures", href: "/factures", icon: FileSpreadsheet },
    { name: "Clients", href: "/clients", icon: Users },
    { name: "Trésorerie", href: "/tresorerie", icon: Wallet },
    { name: "P&L", href: "/pl", icon: TrendingUp },
    { name: "Catalogue", href: "/catalogue", icon: BookOpen },
    { name: "Paramètres", href: "/parametres", icon: Settings },
  ];

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-[#0F3E2B] text-[#F0FDF4] w-64 border-r border-[#15803D]/30 shrink-0 select-none",
        className
      )}
    >
      {/* Brand Logo Header */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-[#15803D]/20">
        <div className="h-9 w-9 rounded-lg bg-white flex items-center justify-center shadow-md shadow-emerald-950/40 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="Logo NafaFlow" className="h-7 w-7 object-contain" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-lg tracking-tight text-white">NafaFlow</span>
          <span className="text-xs text-green-300/60 font-medium">Facturation & Tréso</span>
        </div>
      </div>

      {/* Quick Search (fonctionnelle) */}
      <div className="px-4 py-4 border-b border-[#15803D]/10">
        <GlobalSearch variant="sidebar" placeholder="Recherche rapide..." onNavigate={onItemClick} />
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onItemClick}
              className={cn(
                "group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-[#16A34A] text-white shadow-md shadow-emerald-950/30"
                  : "text-green-100/70 hover:text-white hover:bg-emerald-900/40"
              )}
            >
              <div className="flex items-center gap-3">
                <item.icon
                  className={cn(
                    "h-5 w-5 transition-transform duration-200 group-hover:scale-110",
                    isActive ? "text-white" : "text-green-300/50 group-hover:text-green-300"
                  )}
                />
                <span>{item.name}</span>
              </div>
              <ChevronRight
                className={cn(
                  "h-4 w-4 opacity-0 transition-all duration-200 shrink-0",
                  isActive ? "opacity-100 text-white translate-x-0" : "group-hover:opacity-60 group-hover:translate-x-0.5"
                )}
              />
            </Link>
          );
        })}
      </nav>

      {/* Sidebar Footer / User Org Indicator (cliquable → Paramètres) */}
      <Link
        href="/parametres"
        onClick={onItemClick}
        className="p-4 border-t border-[#15803D]/20 bg-emerald-950/20 hover:bg-emerald-950/40 transition-colors flex items-center gap-3 group"
      >
        <div className="h-9 w-9 rounded-full bg-emerald-800/80 flex items-center justify-center text-green-200 font-bold border border-[#15803D]/40 shrink-0">
          {(orgName || "NF").split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()}
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-xs font-semibold text-white truncate">{orgName || "Mon entreprise"}</span>
          <span className="text-[10px] text-green-300/50 font-medium truncate">Voir les paramètres</span>
        </div>
        <ChevronRight className="h-4 w-4 text-green-300/40 group-hover:text-green-300 group-hover:translate-x-0.5 transition-all shrink-0" />
      </Link>
    </aside>
  );
}
