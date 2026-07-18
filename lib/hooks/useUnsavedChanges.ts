"use client";

import { useEffect } from "react";

// Prévient l'utilisateur avant de quitter une page avec des modifications
// non enregistrées :
//  - fermeture/rafraîchissement de l'onglet (via beforeunload natif)
//  - clic sur un lien interne de l'app (interception en phase capture)
export function useUnsavedChanges(isDirty: boolean, message = "Vous avez des modifications non enregistrées. Quitter sans enregistrer ?") {
  useEffect(() => {
    if (!isDirty) return;

    // 1. Fermeture / rafraîchissement / navigation navigateur
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    // 2. Clics sur les liens internes (Next.js <Link> rend des <a>)
    const handleClickCapture = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || anchor.target === "_blank") return;
      // Lien interne menant vers une autre URL
      const current = window.location.pathname + window.location.search;
      if (href === current) return;
      if (!window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("click", handleClickCapture, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleClickCapture, true);
    };
  }, [isDirty, message]);
}
