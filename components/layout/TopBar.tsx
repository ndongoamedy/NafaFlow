"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, User, Building2, ChevronDown } from "lucide-react";
import GlobalSearch from "./GlobalSearch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createBrowserClient } from "@/lib/supabase/client";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrateur",
  EDITOR: "Collaborateur",
  VIEWER: "Lecture seule",
};

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const supabase = createBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: userData } = await supabase
          .schema("nafaflow")
          .from("users")
          .select("org_id, full_name, role")
          .eq("id", user.id)
          .single();

        if (userData) {
          setUserName(userData.full_name || user.email || "");
          setUserRole(ROLE_LABELS[userData.role] || "");

          if (userData.org_id) {
            const { data: org } = await supabase
              .schema("nafaflow")
              .from("orgs")
              .select("name")
              .eq("id", userData.org_id)
              .single();
            if (org?.name) setOrgName(org.name);
          }
        }
      } catch (err) {
        console.error("TopBar profile loading error:", err);
      }
    };
    loadProfile();
  }, []);

  const handleLogout = async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const initials = (userName || "NF")
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Determine current section title based on pathname
  const getPageTitle = () => {
    if (pathname.includes("/dashboard")) return "Tableau de bord";
    if (pathname.includes("/devis")) return "Devis & Propositions";
    if (pathname.includes("/factures")) return "Factures clients";
    if (pathname.includes("/clients")) return "Gestion Clients";
    if (pathname.includes("/tresorerie")) return "Journal de Trésorerie";
    if (pathname.includes("/pl")) return "Compte de Résultat (P&L)";
    if (pathname.includes("/catalogue")) return "Catalogue de Services";
    if (pathname.includes("/parametres")) return "Configuration";
    return "NafaFlow";
  };

  return (
    <header className="hidden lg:flex items-center justify-between px-8 py-4 bg-white border-b border-slate-100 sticky top-0 z-30 shadow-sm shadow-slate-100/30">
      {/* Title / Section Name */}
      <div>
        <h1 className="text-xl font-bold text-slate-800 tracking-tight">{getPageTitle()}</h1>
        <p className="text-xs text-slate-400 font-medium mt-0.5">
          {orgName ? `Bienvenue dans votre espace ${orgName}` : "Bienvenue dans votre espace"}
        </p>
      </div>

      {/* Action Area */}
      <div className="flex items-center gap-6">
        {/* Recherche globale fonctionnelle */}
        <GlobalSearch variant="topbar" />

        <div className="h-6 w-px bg-slate-200" />

        {/* User Workspace & Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 hover:bg-slate-50 p-1.5 rounded-lg transition-all border border-transparent hover:border-slate-100 group">
              <Avatar className="h-8 w-8 border border-slate-200">
                <AvatarImage src="" />
                <AvatarFallback className="bg-emerald-100 text-emerald-800 font-bold text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start min-w-0 text-left">
                <span className="text-sm font-semibold text-slate-700 leading-none group-hover:text-slate-900 transition-colors">
                  {userName || "Utilisateur"}
                </span>
                <span className="text-[10px] text-slate-400 font-medium mt-0.5">{userRole || " "}</span>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-slate-600 shrink-0 transition-transform" />
            </button>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent align="end" className="w-56 mt-1 rounded-xl shadow-lg border-slate-200/60">
            <DropdownMenuLabel className="text-slate-700 font-semibold">Mon Compte</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-100" />
            
            <DropdownMenuItem asChild className="flex items-center gap-2 cursor-pointer text-slate-600 focus:bg-slate-50 focus:text-slate-800 py-2">
              <Link href="/parametres">
                <User className="h-4 w-4" />
                <span>Profil & équipe</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild className="flex items-center gap-2 cursor-pointer text-slate-600 focus:bg-slate-50 focus:text-slate-800 py-2">
              <Link href="/parametres">
                <Building2 className="h-4 w-4" />
                <span>Organisation</span>
              </Link>
            </DropdownMenuItem>
            
            <DropdownMenuSeparator className="bg-slate-100" />
            
            <DropdownMenuItem
              onClick={handleLogout}
              className="flex items-center gap-2 cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700 py-2 font-medium"
            >
              <LogOut className="h-4 w-4" />
              <span>Se déconnecter</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
