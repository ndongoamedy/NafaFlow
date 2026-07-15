"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, FileText, FileSpreadsheet, Wallet, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function FloatingActionButton() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the FAB menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const actions = [
    {
      name: "Nouveau devis",
      description: "Créer une proposition",
      icon: FileText,
      color: "bg-[#16A34A] text-white hover:bg-[#15803D]",
      onClick: () => {
        router.push("/devis/nouveau");
        setIsOpen(false);
      },
    },
    {
      name: "Nouvelle facture",
      description: "Émettre une facture",
      icon: FileSpreadsheet,
      color: "bg-blue-600 text-white hover:bg-blue-700",
      onClick: () => {
        router.push("/factures/nouveau");
        setIsOpen(false);
      },
    },
    {
      name: "Encaissement",
      description: "Saisir une entrée de cash",
      icon: Wallet,
      color: "bg-amber-600 text-white hover:bg-amber-700",
      onClick: () => {
        router.push("/tresorerie");
        toast.info("Cliquez sur 'Saisir opération' dans le journal pour enregistrer un encaissement.");
        setIsOpen(false);
      },
    },
  ];

  return (
    <div
      ref={menuRef}
      className={cn(
        "fixed z-50 transition-all duration-300",
        // Desktop: bottom center
        "lg:bottom-8 lg:left-1/2 lg:-translate-x-1/2",
        // Mobile: bottom right
        "bottom-6 right-6 lg:right-auto"
      )}
    >
      {/* Radial/Floating Action Menu Options */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 lg:right-auto lg:left-1/2 lg:-translate-x-1/2 flex flex-col gap-2.5 mb-2 w-56 items-end lg:items-center animate-in fade-in slide-in-from-bottom-5 duration-200">
          {actions.map((action) => (
            <button
              key={action.name}
              onClick={action.onClick}
              className="flex items-center gap-3 bg-white hover:bg-slate-50 border border-slate-200/80 px-4 py-2.5 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 w-full group active:scale-95"
            >
              <div className={cn("p-2 rounded-lg shrink-0", action.color)}>
                <action.icon className="h-4 w-4" />
              </div>
              <div className="text-left flex flex-col min-w-0">
                <span className="text-sm font-semibold text-slate-800 leading-none group-hover:text-slate-900">
                  {action.name}
                </span>
                <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                  {action.description}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Primary Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "h-14 w-14 rounded-full flex items-center justify-center text-white shadow-lg hover:shadow-xl hover:shadow-emerald-500/20 active:scale-95 transition-all duration-300 transform",
          isOpen ? "bg-slate-800 rotate-90" : "bg-[#16A34A] hover:bg-[#15803D] hover:scale-105"
        )}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Plus className="h-7 w-7" />}
      </button>
    </div>
  );
}
