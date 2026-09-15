import { WhatsappIcon } from '@/components/icons/WhatsappIcon';
import {
  buildMapsRouteUrl,
  buildShareLocationMessage,
  buildWhatsappShareUrl,
} from '@/lib/admin/location-actions';
import type { AdminOrderDetail } from '@/modules/admin/types';

const SOURCE_LABEL: Record<string, string> = {
  geocoded: 'Endereço localizado pelo Google',
  current_location: 'Localização atual do cliente',
  manual_pin: 'Pin ajustado pelo cliente',
};

/**
 * Origem/confiabilidade da localização + ações que usam a coordenada
 * confirmada (não o texto do endereço) — "Abrir rota" e "Compartilhar
 * localização" continuam funcionando mesmo quando o Google não reconhece a
 * rua. Só renderiza algo quando há endereço de entrega no pedido.
 */
export function DeliveryLocationMeta({ order }: { order: AdminOrderDetail }) {
  const address = order.address;
  if (!address) return null;

  const sourceLabel = address.locationSource
    ? SOURCE_LABEL[address.locationSource]
    : null;
  const hasCoords = address.latitude != null && address.longitude != null;

  if (!sourceLabel && !address.locationDiverged && !hasCoords) return null;

  return (
    <div className="mt-1 space-y-1">
      {sourceLabel ? (
        <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-2xs text-muted-foreground">
          {sourceLabel}
        </span>
      ) : null}
      {address.locationDiverged ? (
        <p className="text-2xs text-tone-warning-foreground">
          Endereço digitado e localização podem divergir — conferir.
        </p>
      ) : null}
      {address.googleFormattedAddress && address.street ? (
        <p className="text-2xs text-muted-foreground">
          Identificado pelo Google: {address.googleFormattedAddress}
        </p>
      ) : null}
      {hasCoords ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
          <a
            href={buildMapsRouteUrl(address.latitude as number, address.longitude as number)}
            target="_blank"
            rel="noreferrer"
            className="text-2xs font-semibold text-primary underline"
          >
            Abrir rota
          </a>
          <a
            href={buildWhatsappShareUrl(buildShareLocationMessage(order))}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-2xs font-semibold text-primary underline"
          >
            <WhatsappIcon size={12} className="shrink-0" />
            Compartilhar localização
          </a>
        </div>
      ) : null}
    </div>
  );
}
