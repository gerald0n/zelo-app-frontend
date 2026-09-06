/**
 * IP do cliente.
 *
 * Atrás da Vercel, `x-vercel-forwarded-for` e `x-real-ip` são preenchidos pela
 * plataforma e não são falsificáveis pelo cliente — preferimos eles. O
 * `x-forwarded-for` só é usado como último recurso (em produção o cliente pode
 * injetar valores nele antes do primeiro proxy).
 */
export function clientIpFromRequest(request: Request): string {
  const vercel = request.headers.get('x-vercel-forwarded-for')?.trim();
  if (vercel) {
    const first = vercel.split(',')[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  return 'unknown';
}
