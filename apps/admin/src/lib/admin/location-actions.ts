/**
 * Ações do admin que usam a coordenada confirmada do pedido (lat/lng) em vez
 * do endereço textual — funcionam mesmo quando o Google não reconhece a rua
 * (ver `packages/shared/src/modules/delivery/geo.ts`).
 */

/** URL universal do Google Maps — abre o app no celular, o site no desktop. */
export function buildMapsRouteUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

type ShareableOrder = {
  address: {
    street: string;
    number: string;
    referencePoint: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
};

/** Texto pronto pra colar no WhatsApp do entregador. */
export function buildShareLocationMessage(order: ShareableOrder): string {
  const address = order.address;
  const lines = ['Localização da entrega:'];

  if (address?.latitude != null && address.longitude != null) {
    lines.push(
      `https://www.google.com/maps?q=${address.latitude},${address.longitude}`,
    );
  }
  if (address?.street) {
    lines.push('', 'Endereço informado:', `${address.street}, ${address.number}`);
  }
  if (address?.referencePoint) {
    lines.push('', 'Referência:', address.referencePoint);
  }

  return lines.join('\n');
}

/** Sem número — abre o seletor de contato do WhatsApp (não há telefone de entregador cadastrado). */
export function buildWhatsappShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
