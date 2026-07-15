"use client";

import { useEffect, useState, useRef } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

export default function DevLoginWrapper({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  useEffect(() => {
    // En production, on laisse le comportement normal de Next.js
    if (process.env.NODE_ENV !== "development") {
      setLoading(false);
      return;
    }

    if (initialized.current) return;
    initialized.current = true;

    const checkAndLogin = async () => {
      const supabase = createBrowserClient();
      console.log("[DevLoginWrapper] Démarrage de la vérification de session auth...");

      // Promesse de timeout (3 secondes)
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
          console.warn("[DevLoginWrapper] Timeout d'authentification atteint (3s). Poursuite du rendu de l'application...");
          resolve({ timeout: true });
        }, 3000);
      });

      // Promesse d'authentification réelle
      const authPromise = (async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            console.log("[DevLoginWrapper] Aucune session active. Tentative de connexion automatique...");
            const { data, error: signInError } = await supabase.auth.signInWithPassword({
              email: "test@nafaflow.com",
              password: "password123",
            });
            if (signInError) {
              console.error("[DevLoginWrapper] Échec de la connexion automatique :", signInError.message);
            } else {
              console.log("[DevLoginWrapper] Connexion automatique réussie :", data.user?.email);
            }
          } else {
            console.log("[DevLoginWrapper] Session active détectée :", session.user.email);
          }
        } catch (err: unknown) {
          console.error("[DevLoginWrapper] Erreur lors de la session auth :", err);
        }
        return { timeout: false };
      })();

      // On fait la course entre l'auth et le timeout
      await Promise.race([authPromise, timeoutPromise]);
      setLoading(false);
    };

    checkAndLogin();
  }, []);

  if (process.env.NODE_ENV === "development" && loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 text-slate-500 font-semibold text-sm">
        Authentification de test automatique en cours...
      </div>
    );
  }

  return <>{children}</>;
}
