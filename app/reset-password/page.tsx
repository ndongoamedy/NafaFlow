"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { createBrowserClient } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/utils/orgProfile";

function ResetContent() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [validLink, setValidLink] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Réinitialiser le mot de passe | NafaFlow";
    const supabase = createBrowserClient();

    // Supabase établit une session de récupération à l'arrivée depuis le lien email.
    const check = async () => {
      // Cas flux PKCE : un code est présent dans l'URL
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) setValidLink(true);
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setValidLink(true);
      setReady(true);
    };

    // Événement dédié à la récupération de mot de passe
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setValidLink(true);
        setReady(true);
      }
    });

    check();
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (password.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      toast.error("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Mot de passe mis à jour. Vous pouvez vous connecter.");
      await supabase.auth.signOut();
      router.push("/login");
    } catch (err: unknown) {
      console.error(err);
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md">
        <div className="bg-white border border-slate-100 rounded-2xl shadow-lg shadow-slate-200/50 p-8 space-y-6">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-lg bg-white border border-slate-100 flex items-center justify-center overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-icon.png" alt="NafaFlow" className="h-7 w-7 object-contain" />
            </div>
            <span className="font-bold text-slate-800 tracking-tight">NafaFlow</span>
          </div>

          {!ready ? (
            <div className="py-8 text-center text-slate-400 text-sm font-medium">Vérification du lien...</div>
          ) : !validLink ? (
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800">Lien invalide ou expiré</h2>
              <p className="text-sm text-slate-500 font-medium">
                Ce lien de réinitialisation n&apos;est plus valable. Demandez-en un nouveau depuis l&apos;écran de connexion.
              </p>
              <Link href="/login" className="inline-block text-sm font-bold text-[#16A34A] hover:underline underline-offset-2">
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-[#16A34A]" />
                  Nouveau mot de passe
                </h2>
                <p className="text-xs text-slate-400 font-medium mt-1">Choisissez un nouveau mot de passe pour votre compte.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="pwd" className="text-xs font-bold text-slate-500 uppercase">Nouveau mot de passe</Label>
                  <div className="relative">
                    <Input
                      id="pwd"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="8 caractères minimum"
                      className="h-11 rounded-lg border-slate-200 focus:border-[#16A34A] focus:ring-[#16A34A] font-semibold text-slate-700 pr-11"
                    />
                    <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm" className="text-xs font-bold text-slate-500 uppercase">Confirmer le mot de passe</Label>
                  <Input
                    id="confirm"
                    type={showPassword ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Ressaisissez le mot de passe"
                    className="h-11 rounded-lg border-slate-200 focus:border-[#16A34A] focus:ring-[#16A34A] font-semibold text-slate-700"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#16A34A] hover:bg-[#15803D] text-white font-bold h-11 rounded-lg flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  <span>{submitting ? "Mise à jour..." : "Mettre à jour le mot de passe"}</span>
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Chargement...</div>}>
      <ResetContent />
    </Suspense>
  );
}
