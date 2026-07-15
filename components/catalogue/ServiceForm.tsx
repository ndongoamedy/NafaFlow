"use client";

import { useState, useEffect } from "react";
import { DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface ServiceItem {
  id?: string;
  name: string;
  category: string;
  price: number;
  isRecurrent: boolean;
  isActive: boolean;
  included: string[];
  excluded: string[];
}

interface ServiceFormProps {
  service?: ServiceItem | null;
  onSave: (service: ServiceItem) => void;
  onClose: () => void;
}

export default function ServiceForm({ service, onSave, onClose }: ServiceFormProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Développement");
  const [price, setPrice] = useState("");
  const [isRecurrent, setIsRecurrent] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [includedInput, setIncludedInput] = useState("");
  const [excludedInput, setExcludedInput] = useState("");

  useEffect(() => {
    if (service) {
      setName(service.name);
      setCategory(service.category);
      setPrice(service.price.toString());
      setIsRecurrent(service.isRecurrent);
      setIsActive(service.isActive);
      setIncludedInput(service.included.join("\n"));
      setExcludedInput(service.excluded.join("\n"));
    }
  }, [service]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price) {
      toast.error("Veuillez remplir les champs obligatoires.");
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error("Veuillez saisir un prix valide.");
      return;
    }

    onSave({
      id: service?.id,
      name,
      category,
      price: priceNum,
      isRecurrent,
      isActive,
      included: includedInput.split("\n").map(s => s.trim()).filter(Boolean),
      excluded: excludedInput.split("\n").map(s => s.trim()).filter(Boolean)
    });
  };

  return (
    <DialogContent className="max-w-md bg-white rounded-xl shadow-xl border-slate-100 p-6">
      <form onSubmit={handleSubmit} className="space-y-5">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-800">
            {service ? "Modifier le service" : "Nouveau service catalogue"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Service Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs font-bold text-slate-500 uppercase">
              Nom du service *
            </Label>
            <Input
              id="name"
              placeholder="ex: Maintenance Serveurs & Securité"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 rounded-lg border-slate-200 focus:border-[#16A34A] focus:ring-[#16A34A]"
              required
            />
          </div>

          {/* Category & Price */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="category" className="text-xs font-bold text-slate-500 uppercase">
                Catégorie
              </Label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:border-[#16A34A] focus:ring-1 focus:ring-[#16A34A]"
              >
                <option value="Développement">Développement</option>
                <option value="Design">Design</option>
                <option value="Conseil">Conseil</option>
                <option value="Marketing">Marketing</option>
                <option value="Maintenance">Maintenance</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="price" className="text-xs font-bold text-slate-500 uppercase">
                Prix unitaire (FCFA) *
              </Label>
              <Input
                id="price"
                type="number"
                placeholder="ex: 250000"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="h-10 rounded-lg border-slate-200 focus:border-[#16A34A] focus:ring-[#16A34A]"
                required
              />
            </div>
          </div>

          {/* Toggle Switches (Recurrency & Active) */}
          <div className="flex items-center justify-between py-2 border-y border-slate-100">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="isRecurrent" className="text-sm font-semibold text-slate-700">
                Service Récurrent
              </Label>
              <span className="text-[10px] text-slate-400">Maintenance, abonnements...</span>
            </div>
            <Switch
              id="isRecurrent"
              checked={isRecurrent}
              onCheckedChange={setIsRecurrent}
              className="data-[state=checked]:bg-[#16A34A]"
            />
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="isActive" className="text-sm font-semibold text-slate-700">
                Statut Actif
              </Label>
              <span className="text-[10px] text-slate-400">Visible dans l&apos;éditeur de devis</span>
            </div>
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={setIsActive}
              className="data-[state=checked]:bg-[#16A34A]"
            />
          </div>

          {/* Included / Excluded list */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="included" className="text-xs font-bold text-slate-500 uppercase">
                Inclus (1 par ligne)
              </Label>
              <textarea
                id="included"
                placeholder="ex: Sauvegardes hebdomadaires&#10;Support 24/7"
                value={includedInput}
                onChange={(e) => setIncludedInput(e.target.value)}
                rows={2}
                className="w-full text-sm p-3 rounded-lg border border-slate-200 focus:outline-none focus:border-[#16A34A] focus:ring-1 focus:ring-[#16A34A] placeholder-slate-400"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="excluded" className="text-xs font-bold text-slate-500 uppercase">
                Exclus (1 par ligne)
              </Label>
              <textarea
                id="excluded"
                placeholder="ex: Heures supplémentaires de dev&#10;Licences tiers"
                value={excludedInput}
                onChange={(e) => setExcludedInput(e.target.value)}
                rows={2}
                className="w-full text-sm p-3 rounded-lg border border-slate-200 focus:outline-none focus:border-[#16A34A] focus:ring-1 focus:ring-[#16A34A] placeholder-slate-400"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-slate-500 hover:bg-slate-50 font-semibold"
          >
            Annuler
          </Button>
          <Button
            type="submit"
            className="bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold rounded-lg"
          >
            Sauvegarder
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
