import { isProductionLike } from '@/config/env';

/** Cookies de sessão Auth: HttpOnly, SameSite=Lax, Secure em produção. */
export function supabaseAuthCookieOptions() {
  return {
    path: '/',
    sameSite: 'lax' as const,
    httpOnly: true,
    secure: isProductionLike(),
  };
}
