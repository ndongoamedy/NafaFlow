import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

// Racine du site : les visiteurs voient la landing page,
// les utilisateurs connectés vont directement au tableau de bord.
export default async function Home() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/dashboard" : "/landing.html");
}
