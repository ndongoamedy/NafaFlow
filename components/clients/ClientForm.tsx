"use client";

import { useState, useEffect } from "react";
import { DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface ClientItem {
  id?: string;
  name: string;
  email: string;
  phone: string;
  sector: string;
  address: string;
  ninea: string;
  rc: string;
}

interface ClientFormProps {
  client?: ClientItem | null;
  onSave: (client: ClientItem) => void;
  onClose: () => void;
}

export default function ClientForm({ client, onSave, onClose }: ClientFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sector, setSector] = useState("Technologie");
  const [address, setAddress] = useState("");
  const [ninea, setNinea] = useState("");
  const [rc, setRc] = useState("");

  useEffect(() => {
    if (client) {
      setName(client.name);
      setEmail(client.email);
      setPhone(client.phone);
      setSector(client.sector);
      setAddress(client.address);
      setNinea(client.ninea);
      setRc(client.rc);
    }
  }, [client]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !phone.trim()) {
      toast.error("Veuillez remplir les champs obligatoires (Nom, E-mail, Téléphone).");
      return;
    }

    onSave({
      id: client?.id,
      name,
      email,
      phone,
      sector,
      address,
      ninea,
      rc
    });
  };

  return (
    <DialogContent className="max-w-md bg-white rounded-xl shadow-xl border-slate-100 p-6">
      <form onSubmit={handleSubmit} className="space-y-5">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-800">
            {client ? "Modifier la fiche client" : "Créer un nouveau client"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Client Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs font-bold text-slate-500 uppercase">
              Raison sociale / Nom *
            </Label>
            <Input
              id="name"
              placeholder="ex: Jokkolabs Dakar"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 rounded-lg border-slate-200 focus:border-[#16A34A]"
              required
            />
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-bold text-slate-500 uppercase">
                Adresse e-mail *
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="ex: contact@client.sn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 rounded-lg border-slate-200 focus:border-[#16A34A]"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs font-bold text-slate-500 uppercase">
                WhatsApp / Tel *
              </Label>
              <Input
                id="phone"
                placeholder="ex: +221771234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-10 rounded-lg border-slate-200 focus:border-[#16A34A]"
                required
              />
            </div>
          </div>

          {/* Sector & Address */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="sector" className="text-xs font-bold text-slate-500 uppercase">
                Secteur d&apos;activité
              </Label>
              <select
                id="sector"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:border-[#16A34A] text-slate-600 font-semibold"
              >
                <option value="Technologie">Technologie</option>
                <option value="BTP / Construction">BTP / Construction</option>
                <option value="Services / Conseil">Services / Conseil</option>
                <option value="E-commerce">E-commerce</option>
                <option value="Santé">Santé</option>
                <option value="Éducation">Éducation</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="address" className="text-xs font-bold text-slate-500 uppercase">
                Adresse physique
              </Label>
              <Input
                id="address"
                placeholder="ex: Mermoz, Dakar"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="h-10 rounded-lg border-slate-200 focus:border-[#16A34A]"
              />
            </div>
          </div>

          {/* Senegal Local Tax Identifiers (NINEA / RC) */}
          <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="ninea" className="text-xs font-bold text-slate-500 uppercase">
                Numéro NINEA
              </Label>
              <Input
                id="ninea"
                placeholder="ex: 004381923G2"
                value={ninea}
                onChange={(e) => setNinea(e.target.value)}
                className="h-10 rounded-lg border-slate-200 focus:border-[#16A34A] text-xs font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rc" className="text-xs font-bold text-slate-500 uppercase">
                Registre du Commerce (RC)
              </Label>
              <Input
                id="rc"
                placeholder="ex: SN-DKR-2026-B-1122"
                value={rc}
                onChange={(e) => setRc(e.target.value)}
                className="h-10 rounded-lg border-slate-200 focus:border-[#16A34A] text-xs font-semibold"
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
            Enregistrer
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
