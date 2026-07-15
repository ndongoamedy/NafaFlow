"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, FileSpreadsheet, Users, Loader2 } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";

interface SearchResult {
  id: string;
  type: "client" | "devis" | "facture";
  title: string;
  subtitle: string;
  href: string;
}

interface GlobalSearchProps {
  variant?: "topbar" | "sidebar";
  placeholder?: string;
  onNavigate?: () => void;
}

// Recherche globale réelle : clients, devis et factures de l'organisation.
export default function GlobalSearch({ variant = "topbar", placeholder = "Rechercher...", onNavigate }: GlobalSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const runSearch = useCallback(async (term: string) => {
    const q = term.trim();
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const supabase = createBrowserClient();

      const [clientsRes, quotesRes, invoicesRes] = await Promise.all([
        supabase.schema("nafaflow").from("clients").select("id, name, email").ilike("name", `%${q}%`).limit(5),
        supabase.schema("nafaflow").from("quotes").select("id, total, status, clients(name)").limit(20),
        supabase.schema("nafaflow").from("invoices").select("id, number, total, status, clients(name)").or(`number.ilike.%${q}%`).limit(5),
      ]);

      const out: SearchResult[] = [];

      type ClientRow = { id: string; name: string; email?: string };
      type QuoteRow = { id: string; total: number; clients?: { name?: string } | null };
      type InvoiceRow = { id: string; number?: string; total: number; clients?: { name?: string } | null };

      ((clientsRes.data || []) as unknown as ClientRow[]).forEach((c) => {
        out.push({
          id: c.id,
          type: "client",
          title: c.name,
          subtitle: c.email || "Client",
          href: `/clients/${c.id}`,
        });
      });

      // Devis : filtrage côté client par nom de client (relation)
      ((quotesRes.data || []) as unknown as QuoteRow[])
        .filter((q2) => (q2.clients?.name || "").toLowerCase().includes(q.toLowerCase()))
        .slice(0, 5)
        .forEach((q2) => {
          out.push({
            id: q2.id,
            type: "devis",
            title: `Devis — ${q2.clients?.name || "Client"}`,
            subtitle: `${Math.round(Number(q2.total)).toLocaleString()} F`,
            href: `/devis/${q2.id}`,
          });
        });

      ((invoicesRes.data || []) as unknown as InvoiceRow[]).forEach((inv) => {
        out.push({
          id: inv.id,
          type: "facture",
          title: inv.number || `Facture — ${inv.clients?.name || "Client"}`,
          subtitle: `${inv.clients?.name || ""} • ${Math.round(Number(inv.total)).toLocaleString()} F`,
          href: `/factures/${inv.id}`,
        });
      });

      setResults(out);
      setOpen(true);
    } catch (err) {
      console.error("Global search error:", err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Débounce
  useEffect(() => {
    const t = setTimeout(() => runSearch(query), 250);
    return () => clearTimeout(t);
  }, [query, runSearch]);

  // Fermeture au clic extérieur
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const goTo = (href: string) => {
    setOpen(false);
    setQuery("");
    onNavigate?.();
    router.push(href);
  };

  const isSidebar = variant === "sidebar";

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        className={
          isSidebar
            ? "relative flex items-center bg-emerald-950/40 border border-[#15803D]/30 rounded-lg px-3 py-1.5 focus-within:ring-1 focus-within:ring-[#16A34A] transition-all"
            : "relative flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus-within:ring-1 focus-within:ring-[#16A34A] focus-within:border-[#16A34A] focus-within:bg-white transition-all w-64"
        }
      >
        {loading ? (
          <Loader2 className={`h-4 w-4 shrink-0 animate-spin ${isSidebar ? "text-green-300/40" : "text-slate-400"}`} />
        ) : (
          <Search className={`h-4 w-4 shrink-0 ${isSidebar ? "text-green-300/40" : "text-slate-400"}`} />
        )}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          placeholder={placeholder}
          className={
            isSidebar
              ? "bg-transparent border-0 outline-0 text-sm ml-2 w-full placeholder-green-300/30 text-white focus:outline-none focus:ring-0"
              : "bg-transparent border-0 outline-0 text-sm ml-2 w-full placeholder-slate-400 text-slate-700 focus:outline-none focus:ring-0"
          }
        />
      </div>

      {open && (
        <div className="absolute top-full mt-2 left-0 w-full min-w-[16rem] bg-white border border-slate-100 rounded-xl shadow-xl z-50 overflow-hidden max-h-80 overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-slate-400 font-medium">
              {query.trim().length < 2 ? "Tapez au moins 2 caractères..." : "Aucun résultat"}
            </div>
          ) : (
            results.map((r) => (
              <button
                key={`${r.type}-${r.id}`}
                onClick={() => goTo(r.href)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-left transition-colors border-b border-slate-50 last:border-0"
              >
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                  r.type === "client" ? "bg-emerald-50 text-emerald-600" : r.type === "devis" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                }`}>
                  {r.type === "client" ? <Users className="h-4 w-4" /> : r.type === "devis" ? <FileText className="h-4 w-4" /> : <FileSpreadsheet className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 truncate">{r.title}</p>
                  <p className="text-[11px] text-slate-400 font-medium truncate">{r.subtitle}</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
