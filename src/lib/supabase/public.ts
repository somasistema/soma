import { createBrowserClient } from "@supabase/ssr";

// Client anon sem cookies/sessão — para telas públicas (ex: /aceite/[token])
// que rodam em contexto de servidor mas nunca têm usuário logado.
export function createPublicClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
