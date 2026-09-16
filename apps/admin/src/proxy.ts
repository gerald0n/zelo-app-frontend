import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';
import {
  getSupabasePublishableKey,
  getSupabaseServerUrl,
  hasSupabasePublicConfig,
  isProductionLike,
} from '@/config/env';
import {
  buildContentSecurityPolicy,
  reportingEndpointsHeader,
} from '@/config/security-headers';
import { supabaseAuthCookieOptions } from '@/lib/supabase/cookie-options';
import { resolveStoreIdByHostname } from '@/modules/tenant/resolve-store-id';

/**
 * A cada request:
 * 1. Redireciona HTTP→HTTPS em produção.
 * 2. Emite a `Content-Security-Policy` com um `nonce` único.
 * 3. Resolve o tenant pelo hostname e propaga `x-store-id` (ADR-0001, Fase B)
 *    — ainda sem consumidor (Fase C), zero mudança de comportamento hoje.
 * 4. Checagem otimista da sessão — todo o painel é restrito; sem usuário,
 *    manda para `/login`. A autorização real (perfil admin ativo) continua
 *    no servidor via `requireAdmin()`.
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
  const reporting = reportingEndpointsHeader();
  const storeId = await resolveStoreIdByHostname(request.nextUrl.hostname);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);
  if (storeId) requestHeaders.set('x-store-id', storeId);

  const nextWithHeaders = () =>
    NextResponse.next({ request: { headers: requestHeaders } });

  const withCsp = (response: NextResponse) => {
    response.headers.set('Content-Security-Policy', csp);
    if (reporting) response.headers.set('Reporting-Endpoints', reporting);
    return response;
  };

  const { pathname } = request.nextUrl;
  const isPublic =
    pathname === '/login' ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/monitoring');

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

  // Checagem otimista: `getClaims()` valida o JWT localmente (signing keys
  // assimétricas) sem ida à Auth a cada request. A autorização real (perfil
  // admin ativo) continua no server via `requireAdmin()`.
  const { data: claims } = await supabase.auth.getClaims();

  if (!claims?.claims.sub) {
    const loginUrl = new URL('/login', request.url);
    return withCsp(NextResponse.redirect(loginUrl));
  }

  return withCsp(response);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons/|sw.js|monitoring).*)',
  ],
};
