"use client";

import { useState } from "react";
import { DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export interface CashEntry {
  id?: string;
  date: string;
  type: "in" | "out";
  amount: number;
  label: string;
  category: string;
}

interface CashEntryFormProps {
  onSave: (entry: CashEntry) => void;
  onClose: () => void;
}

export default function CashEntryForm({ onSave, onClose }: CashEntryFormProps) {
  const [type, setType] = useState<"in" | "out">("in");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("Prestations");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !label.trim()) {
      toast.error("Veuillez remplir les champs obligatoires.");
      return;
    }

    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      toast.error("Veuillez entrer un montant valide.");
      return;
    }

    onSave({
      date,
      type,
      amount: num,
      label,
      category
    });
  };

  return (
    <DialogContent className="max-w-md bg-white rounded-xl shadow-xl border-slate-100 p-6">
      <form onSubmit={handleSubmit} className="space-y-5">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-800">
            {"Enregistrer une opération de trésorerie"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type Selector Toggle */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-500 uppercase">Type d&apos;opération</Label>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setType("in");
                  setCategory("Prestations");
                }}
                className={`py-1.5 text-xs font-bold rounded-md transition-all ${
                  type === "in"
                    ? "bg-emerald-600 text-white shadow"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Encaissement (+)
              </button>
              <button
                type="button"
                onClick={() => {
                  setType("out");
                  setCategory("Salaires");
                }}
                className={`py-1.5 text-xs font-bold rounded-md transition-all ${
                  type === "out"
                    ? "bg-rose-600 text-white shadow"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Décaissement (-)
              </button>
            </div>
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="amount" className="text-xs font-bold text-slate-500 uppercase">
                Montant (FCFA) *
              </Label>
              <Input
                id="amount"
                type="number"
                placeholder="ex: 150000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-10 rounded-lg border-slate-200 focus:border-[#16A34A]"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="date" className="text-xs font-bold text-slate-500 uppercase">
                Date *
              </Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 rounded-lg border-slate-200 focus:border-[#16A34A] font-semibold text-slate-700"
                required
              />
            </div>
          </div>

          {/* Label Description */}
          <div className="space-y-1.5">
            <Label htmlFor="label" className="text-xs font-bold text-slate-500 uppercase">
              Libellé / Description *
            </Label>
            <Input
              id="label"
              placeholder="ex: Facture F-2026-003 ou Paiement Loyer"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="h-10 rounded-lg border-slate-200 focus:border-[#16A34A]"
              required
            />
          </div>

          {/* Category Dropdown */}
          <div className="space-y-1.5">
            <Label htmlFor="cat" className="text-xs font-bold text-slate-500 uppercase">
              Catégorie de flux
            </Label>
            <select
              id="cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:border-[#16A34A] text-slate-700 font-semibold"
            >
              {type === "in" ? (
                <>
                  <option value="Prestations">Prestations / Ventes</option>
                  <option value="Acomptes">Acomptes Clients</option>
                  <option value="Subventions">Subventions</option>
                  <option value="Apports">Apports en capital</option>
                  <option value="Divers">Divers</option>
                </>
              ) : (
                <>
                  <option value="Salaires">Salaires & Charges Sociales</option>
                  <option value="Loyer">Loyer & Charges Immobilières</option>
                  <option value="Hébergement Cloud">Hébergement / Outillage Cloud</option>
                  <option value="Marketing">Marketing / Publicité</option>
                  <option value="Impôts">Impôts & Taxes</option>
                  <option value="Divers">Divers / Dépenses courantes</option>
                </>
              )}
            </select>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-slate-500 hover:bg-slate-50 font-semibold text-xs"
          >
            Annuler
          </Button>
          <Button
            type="submit"
            className={`${
              type === "in" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
            } text-white font-semibold rounded-lg text-xs`}
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
