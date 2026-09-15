/**
 * Monta o link do WhatsApp da loja com uma mensagem pronta contendo contexto
 * (tela/erro) — reaproveita o mesmo endpoint público já usado em /loja e
 * /conta. Retorna `null` se o WhatsApp da loja não estiver configurado ou a
 * busca falhar (chamador decide o fallback).
 */
export async function buildSupportWhatsappLink(
  message: string,
): Promise<string | null> {
  try {
    const response = await fetch('/api/v1/catalog/store', {
      cache: 'no-store',
    });
    const json = await response.json().catch(() => null);
    const phone = json?.store?.whatsappE164 as string | undefined;
    if (!phone) return null;
    return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
  } catch {
    return null;
  }
}
