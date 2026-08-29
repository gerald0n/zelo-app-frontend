import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';
import {
  getSupabasePublishableKey,
  getSupabaseServerUrl,
  hasSupabasePublicConfig,
  isProductionLike,
} from '@/config/env';
import { supabaseAuthCookieOptions } from '@/lib/supabase/cookie-options';

/**
 * Redirect HTTP→HTTPS em produção e checagem otimista das rotas `/admin/*`.
 * A autorização completa continua no servidor via `requireAdmin()`.
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

  const { pathname } = request.nextUrl;
  if (!pathname.startsWith('/admin') || pathname === '/admin/login') {
    return NextResponse.next();
  }

  if (!hasSupabasePublicConfig()) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
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
          response = NextResponse.next({ request });
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
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons/|sw.js).*)',
  ],
};
