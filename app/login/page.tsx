"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, LogIn, UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createBrowserClient } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/utils/orgProfile";

type Mode = "login" | "signup";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>(searchParams.get("mode") === "signup" ? "signup" : "login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = mode === "login" ? "Connexion | NafaFlow" : "Créer un compte | NafaFlow";
  }, [mode]);

  const handleLogin = async () => {
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      const msg = error.message.includes("Invalid login credentials")
        ? "Email ou mot de passe incorrect."
        : error.message;
      throw new Error(msg);
    }
    toast.success("Connexion réussie. Bienvenue !");
    router.push("/dashboard");
    router.refresh();
  };

  const handleSignup = async () => {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: companyName.trim(),
        fullName: fullName.trim(),
        email: email.trim(),
        password,
      }),
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) throw new Error(payload?.error || `Erreur serveur (${res.status})`);

    // Compte créé : connexion automatique
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error("Compte créé, mais la connexion a échoué. Réessayez depuis l'écran de connexion.");

    toast.success("Bienvenue sur NafaFlow ! Votre espace est prêt.");
    router.push("/dashboard");
    router.refresh();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!email.trim() || !password) {
      toast.error("Email et mot de passe requis.");
      return;
    }
    if (mode === "signup" && (!companyName.trim() || !fullName.trim())) {
      toast.error("Nom de l'entreprise et nom complet requis.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "login") {
        await handleLogin();
      } else {
        await handleSignup();
      }
    } catch (err: unknown) {
      console.error(err);
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast.error("Saisissez d'abord votre adresse email.");
      return;
    }
    try {
      const supabase = createBrowserClient();
      const redirectTo = `${window.location.origin}/reset-password`;
      await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      toast.success("Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.");
    } catch (err) {
      console.error(err);
      toast.error("Impossible d'envoyer l'email de réinitialisation.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50">
      {/* Panneau de marque */}
      <div className="lg:w-[45%] bg-gradient-to-br from-[#0F3E2B] to-[#15803D] text-white flex flex-col justify-between p-8 lg:p-12 relative overflow-hidden">
        <Link href="/" className="flex items-center gap-3 relative z-10 w-fit">
          <div className="h-11 w-11 rounded-xl bg-white flex items-center justify-center shadow-lg shadow-emerald-950/40 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.png" alt="Logo NafaFlow" className="h-8 w-8 object-contain" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-xl tracking-tight">NafaFlow</span>
            <span className="text-xs text-green-300/60 font-medium">Facturation & Trésorerie</span>
          </div>
        </Link>

        <div className="relative z-10 py-10 lg:py-0">
          <h1 className="text-2xl lg:text-4xl font-extrabold tracking-tight leading-tight">
            Fini les devis sur WhatsApp.
            <br />
            <span className="text-green-300">Fini les tableaux Excel.</span>
          </h1>
          <p className="text-sm text-green-100/70 font-medium mt-4 max-w-md">
            Facturez, encaissez et suivez votre trésorerie en temps réel. Conçu pour les PME et entrepreneurs d&apos;Afrique de l&apos;Ouest.
          </p>
        </div>

        <p className="text-[11px] text-green-200/40 font-medium relative z-10">
          © {new Date().getFullYear()} NafaFlow — Simplifier la finance pour les entrepreneurs du Sénégal.
        </p>

        {/* Décor */}
        <div className="absolute -right-20 -bottom-20 h-72 w-72 rounded-full bg-green-500/10 blur-2xl" />
        <div className="absolute -left-16 top-1/3 h-48 w-48 rounded-full bg-emerald-300/10 blur-2xl" />
      </div>

      {/* Formulaire */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="bg-white border border-slate-100 rounded-2xl shadow-lg shadow-slate-200/50 p-8 space-y-6">
            {/* Onglets */}
            <div className="grid grid-cols-2 bg-slate-100 rounded-xl p-1 border border-slate-200/50">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`py-2 rounded-lg text-sm font-bold transition-all ${
                  mode === "login" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                Connexion
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`py-2 rounded-lg text-sm font-bold transition-all ${
                  mode === "signup" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                Créer un compte
              </button>
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">
                {mode === "login" ? "Ravi de vous revoir !" : "Démarrez gratuitement"}
              </h2>
              <p className="text-xs text-slate-400 font-medium mt-1">
                {mode === "login"
                  ? "Connectez-vous pour accéder à votre espace de gestion."
                  : "Créez votre espace en moins d'une minute. Sans engagement."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="company" className="text-xs font-bold text-slate-500 uppercase">
                      Nom de l&apos;entreprise
                    </Label>
                    <Input
                      id="company"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="ex: And Vision Agency"
                      className="h-11 rounded-lg border-slate-200 focus:border-[#16A34A] focus:ring-[#16A34A] font-semibold text-slate-700"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fullname" className="text-xs font-bold text-slate-500 uppercase">
                      Votre nom complet
                    </Label>
                    <Input
                      id="fullname"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="ex: Amedy Ndongo"
                      className="h-11 rounded-lg border-slate-200 focus:border-[#16A34A] focus:ring-[#16A34A] font-semibold text-slate-700"
                    />
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-bold text-slate-500 uppercase">
                  Adresse email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ex: contact@entreprise.sn"
                  autoComplete="email"
                  className="h-11 rounded-lg border-slate-200 focus:border-[#16A34A] focus:ring-[#16A34A] font-semibold text-slate-700"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-bold text-slate-500 uppercase">
                    Mot de passe
                  </Label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-[11px] font-semibold text-[#16A34A] hover:text-[#15803D] hover:underline underline-offset-2"
                    >
                      Mot de passe oublié ?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "signup" ? "8 caractères minimum" : "Votre mot de passe"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    className="h-11 rounded-lg border-slate-200 focus:border-[#16A34A] focus:ring-[#16A34A] font-semibold text-slate-700 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#16A34A] hover:bg-[#15803D] text-white font-bold h-11 rounded-lg flex items-center justify-center gap-2 active:scale-[0.99] transition-all shadow-md shadow-emerald-700/10 disabled:opacity-60 text-sm"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : mode === "login" ? (
                  <LogIn className="h-4 w-4" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                <span>
                  {submitting
                    ? "Un instant..."
                    : mode === "login"
                    ? "Se connecter"
                    : "Créer mon espace"}
                </span>
              </Button>
            </form>

            <p className="text-[11px] text-slate-400 font-medium text-center">
              {mode === "login" ? (
                <>
                  Pas encore de compte ?{" "}
                  <button type="button" onClick={() => setMode("signup")} className="font-bold text-[#16A34A] hover:underline underline-offset-2">
                    Créez-en un gratuitement
                  </button>
                </>
              ) : (
                <>
                  En créant un compte, vous acceptez nos{" "}
                  <Link href="/landing.html" className="font-semibold underline underline-offset-2 hover:text-slate-600">
                    conditions d&apos;utilisation
                  </Link>
                  .
                </>
              )}
            </p>
          </div>

          <p className="text-center text-[11px] text-slate-400 font-medium mt-6">
            <Link href="/landing.html" className="hover:text-slate-600 underline underline-offset-2">
              ← Retour au site
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400 text-sm font-medium">Chargement...</div>}>
      <LoginContent />
    </Suspense>
  );
}
