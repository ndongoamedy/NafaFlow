"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Phone, Mail, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { normalizeWhatsAppNumber } from "@/lib/utils/orgProfile";

interface ReminderStep {
  step: string;
  label: string;
  days: string;
  status: "sent" | "pending" | "none";
  sentAt?: string;
  messageTemplate: string;
}

interface ReminderPanelProps {
  invoiceId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  amountTTC: number;
}

export default function ReminderPanel({
  invoiceId,
  clientPhone,
  clientEmail,
  amountTTC,
}: ReminderPanelProps) {
  const [isMailOpen, setIsMailOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState(`Relance de paiement - Facture ${invoiceId}`);
  const [emailBody, setEmailBody] = useState(
    `Bonjour,\n\nSauf erreur ou omission de notre part, le paiement de la facture ${invoiceId} d'un montant de ${amountTTC.toLocaleString()} F CFA ne nous est pas parvenu.\n\nNous vous prions de bien vouloir régulariser cette situation dans les meilleurs délais.\n\nCordialement,\nLe service comptabilité`
  );

  const [steps, setSteps] = useState<ReminderStep[]>([
    {
      step: "1",
      label: "Échéance",
      days: "J+0",
      status: "sent",
      sentAt: "25/05/2026",
      messageTemplate: `Bonjour, nous vous informons que la facture ${invoiceId} arrive à échéance aujourd'hui. Cordialement.`
    },
    {
      step: "2",
      label: "Premier rappel",
      days: "J+3",
      status: "sent",
      sentAt: "28/05/2026",
      messageTemplate: `Bonjour, sauf erreur, le paiement de la facture ${invoiceId} (${amountTTC.toLocaleString()} F) ne nous est pas parvenu. Merci de régulariser.`
    },
    {
      step: "3",
      label: "Deuxième rappel",
      days: "J+7",
      status: "pending",
      messageTemplate: `URGENT - Bonjour, nous vous relançons pour la facture ${invoiceId} restée impayée. Merci de procéder au virement. Service Comptabilité.`
    },
    {
      step: "4",
      label: "Mise en demeure",
      days: "J+14",
      status: "none",
      messageTemplate: `MISE EN DEMEURE - Facture ${invoiceId} impayée. Sans règlement sous 48h, nous transmettrons votre dossier à notre conseil juridique.`
    }
  ]);

  const handleSendWhatsApp = (step: ReminderStep) => {
    const formattedPhone = normalizeWhatsAppNumber(clientPhone);
    if (!formattedPhone) {
      toast.error("Ce client n'a pas de numéro WhatsApp valide. Ajoutez-le dans sa fiche client.");
      return;
    }
    const encodedText = encodeURIComponent(step.messageTemplate);
    const waUrl = `https://wa.me/${formattedPhone}?text=${encodedText}`;

    // Open in new window
    window.open(waUrl, "_blank");

    // Mark as sent
    setSteps(prev => prev.map(s => s.step === step.step ? { ...s, status: "sent", sentAt: "Aujourd'hui" } : s));
    toast.success(`Relance WhatsApp lancée pour l'étape ${step.label} !`);
  };

  const handleSendEmail = () => {
    if (!clientEmail) {
      toast.error("Ce client n'a pas d'adresse email. Ajoutez-la dans sa fiche client.");
      return;
    }
    const mailto = `mailto:${clientEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    window.open(mailto, "_blank");
    setIsMailOpen(false);

    // Mark J+7 as sent since they triggered email
    setSteps(prev => prev.map(s => s.step === "3" ? { ...s, status: "sent", sentAt: "Aujourd'hui" } : s));
    toast.success("E-mail de relance ouvert !");
  };

  return (
    <Card className="bg-rose-50/50 border-rose-100 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-bold text-rose-800 flex items-center gap-1.5">
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
              <span>{"Facture en retard — Relancer le client"}</span>
            </CardTitle>
            <CardDescription className="text-xs text-rose-600/70">
              {"Timeline des relances de paiement et outils d'envoi immédiat"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-5 px-6 pb-6 pt-0">
        {/* Timeline of Steps */}
        <div className="relative pl-6 border-l-2 border-slate-200 space-y-4 py-1.5 ml-2.5">
          {steps.map((s) => {
            const isSent = s.status === "sent";
            const isPending = s.status === "pending";
            return (
              <div key={s.step} className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                {/* Node circle wrapper */}
                <span className={`absolute -left-[31px] h-4 w-4 rounded-full border-2 bg-white flex items-center justify-center ${
                  isSent ? "border-emerald-500 text-emerald-500" : isPending ? "border-amber-500 text-amber-500 animate-pulse" : "border-slate-300 text-slate-300"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    isSent ? "bg-emerald-500" : isPending ? "bg-amber-500" : "bg-slate-300"
                  }`} />
                </span>

                <div className="flex flex-col">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    {s.label} ({s.days})
                    {isSent && <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">Envoyée {s.sentAt}</span>}
                    {isPending && <span className="text-[10px] text-amber-600 font-semibold bg-amber-50 px-1.5 py-0.5 rounded animate-pulse">À faire</span>}
                  </span>
                  <span className="text-slate-400 mt-0.5 truncate max-w-xs">{s.messageTemplate}</span>
                </div>

                {/* Relance Buttons */}
                <div className="flex items-center gap-2 self-start sm:self-center">
                  {/* WhatsApp trigger */}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleSendWhatsApp(s)}
                    className="h-7 px-2 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100/50 flex items-center gap-1.5 text-[10px] font-bold border border-emerald-100 rounded-lg bg-white"
                  >
                    <Phone className="h-3 w-3 shrink-0" />
                    <span>WhatsApp</span>
                  </Button>

                  {/* Mail trigger for J+7 */}
                  {s.step === "3" && (
                    <Dialog open={isMailOpen} onOpenChange={setIsMailOpen}>
                      <DialogTrigger asChild>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-blue-700 hover:text-blue-800 hover:bg-blue-100/50 flex items-center gap-1.5 text-[10px] font-bold border border-blue-100 rounded-lg bg-white"
                        >
                          <Mail className="h-3 w-3 shrink-0" />
                          <span>E-mail</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md bg-white rounded-xl shadow-xl border-slate-100 p-6">
                        <DialogHeader>
                          <DialogTitle className="text-base font-bold text-slate-800">Modifier l&apos;e-mail de relance</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 my-2">
                          <div className="space-y-1">
                            <Label htmlFor="subj" className="text-xs font-bold text-slate-400 uppercase">Sujet</Label>
                            <Input
                              id="subj"
                              value={emailSubject}
                              onChange={(e) => setEmailSubject(e.target.value)}
                              className="h-9 rounded-lg"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="body" className="text-xs font-bold text-slate-400 uppercase">Message</Label>
                            <Textarea
                              id="body"
                              value={emailBody}
                              onChange={(e) => setEmailBody(e.target.value)}
                              rows={6}
                              className="text-sm rounded-lg"
                            />
                          </div>
                        </div>
                        <DialogFooter className="gap-2 pt-2 border-t border-slate-100">
                          <Button variant="ghost" onClick={() => setIsMailOpen(false)} className="text-xs font-semibold">
                            Annuler
                          </Button>
                          <Button onClick={handleSendEmail} className="bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold text-xs rounded-lg">
                            Ouvrir dans mailer
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
