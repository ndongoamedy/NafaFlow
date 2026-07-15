"use client";

import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, BookOpen, Search } from "lucide-react";
import AmountFCFA from "@/components/shared/AmountFCFA";
import { ServiceItem } from "@/components/catalogue/ServiceList";
import { fetchOrgSettings, OrgSettings } from "@/lib/utils/orgProfile";
import { createBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
export interface DevisLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

interface DevisLineEditorProps {
  lines: DevisLine[];
  onChange: (lines: DevisLine[]) => void;
}

export default function DevisLineEditor({ lines, onChange }: DevisLineEditorProps) {
  const [catalogSearch, setCatalogSearch] = useState("");
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [catalogue, setCatalogue] = useState<ServiceItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  const loadCatalogue = async () => {
    setLoadingCatalog(true);
    try {
      const supabase = createBrowserClient();
      const { data, error } = await supabase
        .schema("nafaflow")
        .from("services")
        .select("*")
        .eq("active", true)
        .order("name", { ascending: true });

      if (error) throw error;

      if (data) {
        const mapped: ServiceItem[] = data.map((s) => {
          const item = s as { id: string; name?: string | null; category?: string | null; price?: number | null; is_recurring?: boolean | null; active?: boolean | null; inclus?: string | null; exclus?: string | null };
          return {
            id: item.id,
            name: item.name || "",
            category: item.category || "",
            price: Math.round(Number(item.price)) || 0,
            isRecurrent: item.is_recurring || false,
            isActive: item.active || false,
            included: item.inclus ? item.inclus.split("|") : [],
            excluded: item.exclus ? item.exclus.split("|") : [],
          };
        });
        setCatalogue(mapped);
      }
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Erreur lors du chargement du catalogue : ${message}`);
    } finally {
      setLoadingCatalog(false);
    }
  };

  useEffect(() => {
    fetchOrgSettings().then(setSettings);
  }, []);

  useEffect(() => {
    if (isCatalogOpen) {
      loadCatalogue();
    }
  }, [isCatalogOpen]);

  const handleLineChange = (id: string, field: keyof DevisLine, value: string | number) => {
    const updated = lines.map((line) => {
      if (line.id === id) {
        const updatedLine = { ...line, [field]: value };
        return updatedLine;
      }
      return line;
    });
    onChange(updated);
  };

  const addEmptyLine = () => {
    const newLine: DevisLine = {
      id: Date.now().toString(),
      description: "",
      quantity: 1,
      unitPrice: 0,
    };
    onChange([...lines, newLine]);
  };

  const removeLine = (id: string) => {
    const updated = lines.filter((line) => line.id !== id);
    onChange(updated);
  };

  const handleSelectService = (service: ServiceItem) => {
    const newLine: DevisLine = {
      id: Date.now().toString(),
      description: service.name,
      quantity: 1,
      unitPrice: service.price,
    };
    onChange([...lines, newLine]);
    setIsCatalogOpen(false);
  };

  // Calculations
  const applyVat = settings?.billing.applyVat ?? true;
  const vatRate = settings?.billing.vat ?? 18;

  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const vat = applyVat ? subtotal * (vatRate / 100) : 0;
  const total = subtotal + vat;

  const filteredCatalogue = catalogue.filter((s) =>
    s.name.toLowerCase().includes(catalogSearch.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Prestations / Lignes du devis</h3>
        
        <div className="flex gap-2">
          {/* Catalog Picker Modal */}
          <Dialog open={isCatalogOpen} onOpenChange={setIsCatalogOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="bg-white hover:bg-slate-50 text-slate-600 font-semibold border-slate-200 h-8 rounded-lg flex items-center gap-1.5 active:scale-95 transition-all text-xs"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>Sélectionner du catalogue</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-white rounded-xl shadow-xl border-slate-100 p-6">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-slate-800">
                  Choisir un service catalogue
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 my-2">
                <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus-within:ring-1 focus-within:ring-[#16A34A] focus-within:bg-white transition-all w-full">
                  <Search className="h-4 w-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Filtrer les services..."
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    className="bg-transparent border-0 outline-0 text-sm ml-2 w-full placeholder-slate-400 text-slate-700 focus:outline-none"
                  />
                </div>

                <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto pr-1">
                  {loadingCatalog ? (
                    <div className="py-4 text-center text-xs text-slate-400 font-medium">Chargement des prestations...</div>
                  ) : filteredCatalogue.length > 0 ? (
                    filteredCatalogue.map((service) => (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => handleSelectService(service)}
                        className="flex items-center justify-between w-full text-left py-2.5 hover:bg-slate-50 px-2 rounded-lg group transition-all"
                      >
                        <div className="flex flex-col min-w-0 pr-4">
                          <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 truncate">
                            {service.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {service.category}
                          </span>
                        </div>
                        <span className="font-bold text-slate-800 text-xs text-right shrink-0">
                          <AmountFCFA amount={service.price} />
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="py-4 text-center text-xs text-slate-400 font-medium">Aucun service trouvé.</div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Add Manual Line */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addEmptyLine}
            className="bg-white hover:bg-slate-50 text-slate-600 font-semibold border-slate-200 h-8 rounded-lg flex items-center gap-1.5 active:scale-95 transition-all text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Ajouter ligne</span>
          </Button>
        </div>
      </div>

      {/* Lines Editor Table */}
      <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow className="text-slate-400 text-[10px] tracking-wider uppercase font-bold hover:bg-slate-50">
              <TableHead className="py-2.5 px-4 w-[50%]">Description</TableHead>
              <TableHead className="py-2.5 px-4 text-center w-[12%]">Qté</TableHead>
              <TableHead className="py-2.5 px-4 text-right w-[18%]">Prix Unitaire (F)</TableHead>
              <TableHead className="py-2.5 px-4 text-right w-[18%]">Total (F)</TableHead>
              <TableHead className="py-2.5 px-4 w-[2%]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-slate-100 text-slate-700 text-sm">
            {lines.length > 0 ? (
              lines.map((line) => (
                <TableRow key={line.id} className="hover:bg-slate-50/20">
                  <TableCell className="p-3">
                    <Input
                      placeholder="ex: Prestation de développement Next.js"
                      value={line.description}
                      onChange={(e) => handleLineChange(line.id, "description", e.target.value)}
                      className="h-8 text-sm rounded-lg"
                      required
                    />
                  </TableCell>
                  <TableCell className="p-3 text-center">
                    <Input
                      type="number"
                      min="1"
                      value={line.quantity}
                      onChange={(e) => handleLineChange(line.id, "quantity", parseInt(e.target.value) || 1)}
                      className="h-8 text-center text-sm font-semibold rounded-lg w-16 mx-auto"
                      required
                    />
                  </TableCell>
                  <TableCell className="p-3 text-right">
                    <Input
                      type="number"
                      min="0"
                      value={line.unitPrice}
                      onChange={(e) => handleLineChange(line.id, "unitPrice", parseFloat(e.target.value) || 0)}
                      className="h-8 text-right text-sm font-semibold rounded-lg w-28 ml-auto"
                      required
                    />
                  </TableCell>
                  <TableCell className="p-3 text-right font-bold text-slate-800 tabular-nums">
                    <AmountFCFA amount={line.quantity * line.unitPrice} highlight />
                  </TableCell>
                  <TableCell className="p-3 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLine(line.id)}
                      className="h-7 w-7 text-slate-400 hover:text-red-500 rounded-lg shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-slate-400 font-medium">
                  Aucune ligne. Cliquez sur &quot;Ajouter ligne&quot; ou &quot;Sélectionner du catalogue&quot;.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Financial Calculations Summary */}
      <div className="flex justify-end pt-2">
        <div className="w-80 bg-slate-50 border border-slate-100 p-4 rounded-xl space-y-2.5 shadow-inner">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>TOTAL HT</span>
            <span className="tabular-nums"><AmountFCFA amount={subtotal} /></span>
          </div>
          {applyVat && (
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
              <span>TVA ({vatRate}%)</span>
              <span className="tabular-nums"><AmountFCFA amount={vat} /></span>
            </div>
          )}
          <div className="h-px bg-slate-200" />
          <div className="flex items-center justify-between text-sm font-bold text-slate-800">
            <span>TOTAL TTC</span>
            <span className="text-base font-extrabold text-[#16A34A] tabular-nums">
              <AmountFCFA amount={total} highlight />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
