import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Protège les pages de l'application : sans session valide, l'utilisateur
// est renvoyé vers /login. En développement, la garde est désactivée car
// DevLoginWrapper connecte automatiquement le compte de test côté client.

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/devis",
  "/factures",
  "/clients",
  "/tresorerie",
  "/pl",
  "/catalogue",
  "/parametres",
];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Rafraîchit la session si nécessaire et récupère l'utilisateur
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isDev = process.env.NODE_ENV === "development";

  if (!user && isProtected && !isDev) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Un utilisateur connecté n'a rien à faire sur /login
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Tout sauf les assets statiques et les fichiers publics
    "/((?!_next/static|_next/image|favicon.ico|icon.png|landing.html|logo-icon.png|logo-horizontal.png|api/).*)",
  ],
};
