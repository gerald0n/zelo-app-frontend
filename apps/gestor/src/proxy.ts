import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';
import {
  getSupabasePublishableKey,
  getSupabaseServerUrl,
  hasSupabasePublicConfig,
  isProductionLike,
} from '@/config/env';
import { buildContentSecurityPolicy } from '@/config/security-headers';
import { supabaseAuthCookieOptions } from '@/lib/supabase/cookie-options';

/**
 * Sem resolução de tenant por hostname (ADR-0001, Fase B) — `apps/gestor`
 * não é servido por domínio de loja, é a ferramenta que gerencia as lojas.
 * Checagem de sessão é só otimista aqui; a autorização real (perfil de
 * plataforma ativo, `store_id is null`) fica em `requirePlatformAdmin()`.
 */
export default async function proxy(request: NextRequest) {
  if (isProductionLike()) {
    const proto = request.headers.get('x-forwarded-proto');
    if (proto === 'http') {
      const httpsUrl = request.nextUrl.clone();
      httpsUrl.protocol = 'https:';
      return NextResponse.redirect(httpsUrl, 308);
    }
  }

  const nonce = crypto.randomUUID().replace(/-/g, '');
  const csp = buildContentSecurityPolicy(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const nextWithHeaders = () =>
    NextResponse.next({ request: { headers: requestHeaders } });

  const withCsp = (response: NextResponse) => {
    response.headers.set('Content-Security-Policy', csp);
    return response;
  };

  const { pathname } = request.nextUrl;
  const isPublic = pathname === '/login' || pathname.startsWith('/api/');

  if (isPublic || !hasSupabasePublicConfig()) {
    return withCsp(nextWithHeaders());
  }

  let response = nextWithHeaders();
  const authCookies = supabaseAuthCookieOptions();

  const supabase = createServerClient<Database>(
    getSupabaseServerUrl(),
    getSupabasePublishableKey(),
    {
      cookieOptions: authCookies,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = nextWithHeaders();
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, { ...options, ...authCookies });
          });
        },
      },
    },
  );

  const { data: claims } = await supabase.auth.getClaims();

  if (!claims?.claims.sub) {
    const loginUrl = new URL('/login', request.url);
    return withCsp(NextResponse.redirect(loginUrl));
  }

  return withCsp(response);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
