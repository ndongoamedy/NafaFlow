# Guide de déploiement — NafaFlow

Ce document décrit, étape par étape, comment installer NafaFlow en local et le déployer en production sur Vercel. À suivre à chaque nouveau déploiement ou nouvelle machine.

NafaFlow est une application **Next.js 14** (App Router) connectée à **Supabase** (base de données PostgreSQL + authentification) avec les abonnements gérés par **Paytech**.

---

## 1. Prérequis

- **Node.js 18+** et npm
- Un compte **Supabase** (le projet est déjà créé)
- Un compte **Vercel** (pour l'hébergement)
- Un compte **Paytech** (pour les paiements d'abonnement)

---

## 2. Installation en local

```bash
git clone https://github.com/ndongoamedy/NafaFlow.git
cd NafaFlow
npm install
```

Créez un fichier **`.env.local`** à la racine (jamais commité — il est dans `.gitignore`) :

```env
NEXT_PUBLIC_SUPABASE_URL=https://VOTRE-PROJET.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=VOTRE_CLE_ANON
SUPABASE_SECRET_KEY=VOTRE_CLE_SERVICE_ROLE

PAYTECH_API_KEY=VOTRE_CLE_PAYTECH
PAYTECH_API_SECRET=VOTRE_CLE_SECRETE_PAYTECH
PAYTECH_ENV=test           # "test" en dev, "prod" en production
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> Les clés Supabase se trouvent dans **Supabase → Project Settings → API**.
> Les clés Paytech dans votre **tableau de bord Paytech → API**.

Lancer en local :

```bash
npm run dev
```

L'app tourne sur http://localhost:3000

---

## 3. Configuration Supabase (une seule fois)

### a) Schéma
Toutes les tables sont dans le schéma **`nafaflow`**. La table des abonnements a été créée avec ce script (SQL Editor de Supabase) :

```sql
create table if not exists nafaflow.subscriptions (
  org_id uuid primary key references nafaflow.orgs(id) on delete cascade,
  plan text not null default 'trial',
  status text not null default 'trialing',
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  paytech_ref text,
  updated_at timestamptz not null default now()
);
alter table nafaflow.subscriptions enable row level security;
create policy "sub_select_own_org" on nafaflow.subscriptions
  for select using (
    org_id in (select org_id from nafaflow.users where id = auth.uid())
  );
```

### b) Sécurité (RLS) — déjà en place
Le **Row Level Security** est actif et vérifié : chaque organisation ne voit que ses propres données. Pour re-tester à tout moment :
```bash
node scripts/audit-rls-full.js
```

### c) URLs d'authentification (IMPORTANT en production)
Dans **Supabase → Authentication → URL Configuration** :
- **Site URL** : `https://VOTRE-DOMAINE.vercel.app`
- **Redirect URLs** : ajouter `https://VOTRE-DOMAINE.vercel.app/reset-password`

Sans ça, les liens de réinitialisation de mot de passe et de confirmation d'email pointeraient vers localhost.

---

## 4. Déploiement sur Vercel

### Étape 1 — Connexion
```bash
npm i -g vercel
vercel login
```

### Étape 2 — Premier déploiement
```bash
vercel
```
Notez l'URL de production fournie (ex. `nafaflow.vercel.app`).

### Étape 3 — Variables d'environnement
Dans **Vercel → Settings → Environment Variables** (ou via `vercel env add`), ajoutez :

| Variable | Valeur |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | même valeur que `.env.local` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | même valeur que `.env.local` |
| `SUPABASE_SECRET_KEY` | même valeur que `.env.local` |
| `PAYTECH_API_KEY` | votre clé Paytech |
| `PAYTECH_API_SECRET` | votre clé secrète Paytech |
| `PAYTECH_ENV` | `prod` |
| `NEXT_PUBLIC_APP_URL` | `https://VOTRE-DOMAINE.vercel.app` (URL de l'étape 2) |

### Étape 4 — Redéploiement en production
```bash
vercel --prod
```

---

## 5. Configuration Paytech

- **Régénérez vos clés API** si elles ont pu être exposées, puis mettez-les à jour dans Vercel.
- Passez `PAYTECH_ENV=prod` pour encaisser réellement (en `test`, c'est un bac à sable).
- L'URL du webhook (IPN) est envoyée automatiquement par l'app à chaque paiement (`/api/subscription/ipn`) — **aucune config manuelle** côté Paytech, mais elle doit être en **HTTPS** (donc uniquement en production, pas en localhost).

---

## 6. Points critiques à ne jamais oublier

1. **`NEXT_PUBLIC_APP_URL` = le vrai domaine HTTPS.** C'est ce qui permet à Paytech d'appeler le webhook et d'**activer réellement les abonnements**. Sans ça, un paiement ne débloque pas le compte.
2. **`PAYTECH_ENV=prod`** en production, sinon aucun encaissement réel.
3. **Ne jamais committer `.env.local`** (déjà protégé par `.gitignore`).
4. **Ne jamais lancer `npm run build` pendant que `npm run dev` tourne** dans le même dossier : cela corrompt le cache `.next` et l'app affiche un écran noir. Si ça arrive : arrêter les serveurs, `rm -rf .next`, relancer.

---

## 7. Modèle économique (rappel)

- **Essai gratuit : 14 jours** dès la création du compte.
- **Professionnel : 9 000 F CFA / mois** — clients, devis et factures illimités.
- **Business : 15 000 F CFA / mois** — multi-utilisateurs, accès comptable, support prioritaire.
- Après l'essai, l'accès à l'app est **bloqué** tant qu'aucun abonnement n'est actif (page `/abonnement`).

---

## 8. Structure du projet (repères)

| Dossier / fichier | Rôle |
|---|---|
| `app/(app)/` | Pages de l'application (dashboard, devis, factures, clients, trésorerie, P&L, catalogue, paramètres) |
| `app/login/`, `app/reset-password/` | Connexion, inscription, réinitialisation |
| `app/abonnement/` | Page de choix et paiement d'abonnement |
| `app/api/` | Routes serveur (équipe, inscription, checkout & webhook Paytech) |
| `components/` | Composants réutilisables (layout, dashboard, devis, factures...) |
| `lib/utils/` | Logique métier (PDF, format, abonnement, profil org) |
| `lib/supabase/` | Clients Supabase (navigateur & serveur) |
| `middleware.ts` | Protection des routes (redirige vers /login si non connecté) |
| `public/landing.html` | Page vitrine publique |
| `scripts/` | Utilitaires de diagnostic (audit RLS, inspection schéma...) |

---

*NafaFlow — un produit AND VISION AGENCY.*
