"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
}

export default function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirmer la suppression",
  message = "Êtes-vous sûr ? Cette action est irréversible et supprimera définitivement cet élément.",
}: ConfirmDeleteModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md bg-white rounded-xl shadow-xl border-slate-100 p-6">
        <DialogHeader className="flex flex-row items-center gap-3 border-b border-slate-100 pb-3">
          <div className="p-2 bg-red-50 text-red-600 rounded-lg">
            <AlertTriangle className="h-5 w-5 shrink-0" />
          </div>
          <div className="flex flex-col">
            <DialogTitle className="text-base font-bold text-slate-800">{title}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="my-4">
          <p className="text-sm text-slate-500 font-medium leading-relaxed">
            {message}
          </p>
        </div>

        <DialogFooter className="gap-2 pt-2 border-t border-slate-100 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-slate-500 hover:bg-slate-50 font-semibold"
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg"
          >
            Supprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
