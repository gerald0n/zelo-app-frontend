'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { cn } from '@/lib/cn';
import { LOW_GPS_ACCURACY_METERS } from '@/modules/delivery/geo';

const DeliveryGoogleMap = dynamic(
  () =>
    import('@/components/checkout/DeliveryGoogleMap').then(
      (mod) => mod.DeliveryGoogleMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/60">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    ),
  },
);

type DeliveryMapConfirmProps = {
  latitude: number;
  longitude: number;
  confirmed: boolean;
  onConfirm: () => void;
  /** Centro do mapa após o usuário arrastar (pin fixo no meio). */
  onCenterChange?: (latitude: number, longitude: number) => void;
  /** Endereço resolvido por reverse geocode para o pin atual. */
  addressPreview?: string;
  /** `accuracy` do GPS, quando o pin veio da localização atual. */
  accuracyMeters?: number;
  /** Pin arrastado longe do endereço digitado/geocodificado. */
  diverged?: boolean;
};

function MapEmbedFallback({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  const embedSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.008}%2C${latitude - 0.005}%2C${longitude + 0.008}%2C${latitude + 0.005}&layer=mapnik&marker=${latitude}%2C${longitude}`;

  return (
    <iframe
      title="Mapa do endereço de entrega"
      src={embedSrc}
      className="h-full w-full border-0"
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      allowFullScreen
    />
  );
}

export function DeliveryMapConfirm({
  latitude,
  longitude,
  confirmed,
  onConfirm,
  onCenterChange,
  addressPreview,
  accuracyMeters,
  diverged,
}: DeliveryMapConfirmProps) {
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  return (
    <div className="space-y-2.5">
      <div>
        <p className="text-base font-semibold">Confirme a localização</p>
        <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
          Confira se o pin está exatamente no local da entrega. Se
          necessário, ajuste-o no mapa.
        </p>
      </div>

      {accuracyMeters != null && accuracyMeters > LOW_GPS_ACCURACY_METERS ? (
        <p className="text-xs text-tone-warning-foreground">
          Localização com precisão baixa (~{Math.round(accuracyMeters)}m) —
          confira se o pin está no lugar certo.
        </p>
      ) : null}
      {diverged ? (
        <p className="text-xs text-tone-warning-foreground">
          O pin ficou longe do endereço digitado — confirme que está certo.
        </p>
      ) : null}

      <div className="relative h-64 overflow-hidden rounded-md border border-border bg-muted sm:h-80">
        {mapStatus === 'error' ? (
          <MapEmbedFallback latitude={latitude} longitude={longitude} />
        ) : (
          <>
            <DeliveryGoogleMap
              latitude={latitude}
              longitude={longitude}
              onReady={() => setMapStatus('ready')}
              onError={(message) => {
                setMapStatus('error');
                setLoadError(message);
              }}
              onCenterChange={onCenterChange}
            />
            <div
              className="pointer-events-none absolute inset-0 z-10"
              aria-hidden
            >
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
                <MapPin
                  className="size-11 fill-primary text-primary drop-shadow-md"
                  strokeWidth={1.25}
                />
              </div>
            </div>
            {mapStatus === 'loading' ? (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/60">
                <Loader2 className="size-6 animate-spin text-primary" />
              </div>
            ) : null}
          </>
        )}
      </div>

      {loadError ? (
        <p className="text-xs text-muted-foreground">{loadError}</p>
      ) : null}

      {addressPreview ? (
        <p className="text-sm leading-snug text-muted-foreground">
          Local do pin:{' '}
          <span className="font-medium text-foreground">{addressPreview}</span>
        </p>
      ) : null}

      <button
        type="button"
        onClick={onConfirm}
        className={cn(
          'w-full rounded-md py-3 text-sm font-semibold',
          confirmed
            ? 'border border-success bg-success/10 text-success'
            : 'bg-primary text-primary-foreground',
        )}
      >
        {confirmed ? 'Localização confirmada' : 'Confirmar localização no mapa'}
      </button>
    </div>
  );
}
