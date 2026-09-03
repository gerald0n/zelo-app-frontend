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
 * A cada request:
 * 1. Redireciona HTTP→HTTPS em produção.
 * 2. Emite a `Content-Security-Policy` com um `nonce` único (o Next injeta o
 *    nonce nos próprios scripts, dispensando `script-src 'unsafe-inline'`).
 * 3. Checagem otimista das rotas `/admin/*` — a autorização real continua no
 *    servidor via `requireAdmin()`.
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
  // O Next lê este header do request para extrair o nonce durante o SSR.
  requestHeaders.set('Content-Security-Policy', csp);

  const nextWithHeaders = () =>
    NextResponse.next({ request: { headers: requestHeaders } });

  const withCsp = (response: NextResponse) => {
    response.headers.set('Content-Security-Policy', csp);
    return response;
  };

  const { pathname } = request.nextUrl;
  const needsAdminCheck =
    pathname.startsWith('/admin') &&
    pathname !== '/admin/login' &&
    hasSupabasePublicConfig();

  if (!needsAdminCheck) {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL('/admin/login', request.url);
    return withCsp(NextResponse.redirect(loginUrl));
  }

  return withCsp(response);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons/|sw.js).*)'],
};
