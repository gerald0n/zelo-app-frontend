import { NextResponse, type NextRequest } from 'next/server';
import { isProductionLike } from '@/config/env';
import {
  buildContentSecurityPolicy,
  reportingEndpointsHeader,
} from '@/config/security-headers';
import { resolveStoreIdByHostname } from '@/modules/tenant/resolve-store-id';

/**
 * A cada request:
 * 1. Redireciona HTTP→HTTPS em produção.
 * 2. Emite a `Content-Security-Policy` com um `nonce` único (o Next injeta o
 *    nonce nos próprios scripts, dispensando `script-src 'unsafe-inline'`).
 * 3. Resolve o tenant pelo hostname e propaga `x-store-id` (ADR-0001, Fase B).
 *    Ninguém consome esse header ainda (Fase C não chegou) — é só a
 *    infraestrutura de resolução, sem mudança de comportamento hoje.
 *
 * O painel administrativo vive em outra aplicação (`apps/admin`,
 * `admin.zeloconfeitaria.com.br`); esta app é só o cardápio do cliente.
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
  // O Next lê este header do request para extrair o nonce durante o SSR.
  requestHeaders.set('Content-Security-Policy', csp);
  if (storeId) requestHeaders.set('x-store-id', storeId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  if (reporting) response.headers.set('Reporting-Endpoints', reporting);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons/|sw.js|monitoring).*)',
  ],
};
