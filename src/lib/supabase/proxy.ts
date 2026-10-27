import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { fetchResiliente } from "./fetch-resiliente";

// /aceite/[token] é a página pública do comprador. /auth cobre o link de
// convite (definir-senha) — a sessão do convite chega via hash da URL,
// que só o JS do client processa, então o server ainda não vê `user`
// no primeiro request; sem isso aqui, o proxy chutaria pro /login antes
// do client ter chance de estabelecer a sessão.
// /parte/[token] (cliente preenche os dados) e /aprovar/[token] (cliente lê e
// aprova a minuta) também são páginas por link, sem login.
const ROTAS_PUBLICAS = ["/login", "/aceite", "/auth", "/parte", "/aprovar"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: fetchResiliente },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const rotaPublica = ROTAS_PUBLICAS.some((r) => path.startsWith(r));

  if (!user && !rotaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}