'use client';

import {
  AlertCircle,
  Bike,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { useRef } from 'react';
import { useCheckout } from '@/contexts/CheckoutContext';
import { Input } from '@/components/ui/input';
import { DeliveryMapConfirm } from '@/components/checkout/DeliveryMapConfirm';
import { AddressAutocomplete } from '@/components/checkout/AddressAutocomplete';
import { CurrentLocationButton } from '@/components/checkout/CurrentLocationButton';
import type { CurrentLocationResult } from '@/hooks/useCurrentLocation';
import { formatCatalogPrice } from '@/modules/catalog/types';
import type { SavedAddress } from '@/modules/customers/addresses';
import type { ResolvedPlace } from '@/modules/delivery/places';
import {
  PIN_DIVERGENCE_METERS,
  haversineDistanceMeters,
} from '@/modules/delivery/geo';
import { checkoutFieldClass } from '@/lib/layout';
import { cn } from '@/lib/cn';
import type { AnyCheckoutOptions } from '@/app/checkout/recebimento/recebimento-helpers';

type Props = {
  options: AnyCheckoutOptions | null;
  savedAddresses: SavedAddress[];
  selectedSavedId: string | null;
  onSelectSaved: (id: string) => void;
  quoting: boolean;
  quoteError: string | null;
  quoteMessage: string | null;
  revalidateWithCoords: (latitude: number, longitude: number) => void;
};

export function DeliveryAddressSection({
  options,
  savedAddresses,
  selectedSavedId,
  onSelectSaved,
  quoting,
  quoteError,
  quoteMessage,
  revalidateWithCoords,
}: Props) {
  const { checkout, setAddressDetails, setLocationConfirmed } = useCheckout();
  const details = checkout.addressDetails;
  const deliveryFee =
    checkout.deliveryType === 'delivery' ? checkout.deliveryFeeCents : 0;

  // Posição de alta confiança mais recente (autocomplete/geocode preciso ou
  // GPS com boa precisão) — referência pra detectar se um arraste manual do
  // pin depois diverge muito do que foi resolvido pelo texto/GPS. `null`
  // quando não há referência confiável (ex.: fallback genérico do centro da
  // cidade) — nesse caso não faz sentido comparar.
  const highConfidenceOriginRef = useRef<{
    latitude: number;
    longitude: number;
  } | null>(null);

  function handleGeocodedPlace(place: ResolvedPlace) {
    const latitude = Number.isFinite(place.latitude)
      ? place.latitude
      : undefined;
    const longitude = Number.isFinite(place.longitude)
      ? place.longitude
      : undefined;
    if (latitude != null && longitude != null) {
      highConfidenceOriginRef.current = { latitude, longitude };
    }
    setAddressDetails({
      street: place.street || details.street,
      number: place.number || details.number,
      neighborhood: place.neighborhood || details.neighborhood,
      city: details.city,
      state: details.state,
      latitude,
      longitude,
      locationSource: 'geocoded',
      locationAccuracyMeters: undefined,
      locationDiverged: false,
    });
  }

  function handleCurrentLocation(result: CurrentLocationResult) {
    if (result.accuracy <= PIN_DIVERGENCE_METERS) {
      highConfidenceOriginRef.current = {
        latitude: result.latitude,
        longitude: result.longitude,
      };
    } else {
      highConfidenceOriginRef.current = null;
    }
    setAddressDetails({
      // Preserva o que o cliente já digitou — o reverse geocode do GPS só
      // preenche o que ainda está vazio.
      street: details.street || result.address?.street || details.street,
      number: details.number || result.address?.number || details.number,
      neighborhood:
        details.neighborhood ||
        result.address?.neighborhood ||
        details.neighborhood,
      city: details.city,
      state: details.state,
      latitude: result.latitude,
      longitude: result.longitude,
      formattedAddress: result.address?.formattedAddress,
      locationSource: 'current_location',
      locationAccuracyMeters: result.accuracy,
      locationDiverged: false,
    });
    // Garante revalidação mesmo se rua/número/cidade/UF não mudarem (ex.:
    // clicar "usar localização atual" de novo já com os campos preenchidos)
    // — o efeito principal de `useDeliveryQuote` só observa esses campos,
    // não lat/lng diretamente.
    revalidateWithCoords(result.latitude, result.longitude);
  }

  return (
    <div className="mt-2 min-w-0 space-y-2.5">
      <p className="text-base font-semibold">Endereço de entrega</p>
      {savedAddresses.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {savedAddresses.map((address) => (
            <button
              key={address.id}
              type="button"
              onClick={() => {
                onSelectSaved(address.id);
                highConfidenceOriginRef.current = {
                  latitude: address.latitude,
                  longitude: address.longitude,
                };
                setAddressDetails({
                  street: address.street,
                  number: address.number,
                  neighborhood: address.neighborhood,
                  complement: address.complement ?? '',
                  referencePoint: address.referencePoint ?? '',
                  city: address.city,
                  state: address.state,
                  postalCode: address.postalCode ?? '',
                  latitude: address.latitude,
                  longitude: address.longitude,
                  formattedAddress: address.googleFormattedAddress ?? undefined,
                  locationSource: address.locationSource ?? undefined,
                  locationAccuracyMeters:
                    address.locationAccuracyMeters ?? undefined,
                  locationDiverged: address.locationDiverged ?? false,
                });
              }}
              className={cn(
                'shrink-0 rounded-md border px-3 py-2 text-left text-xs leading-4',
                selectedSavedId === address.id
                  ? 'border-primary bg-primary/[0.07] font-semibold text-primary'
                  : 'border-border bg-card text-foreground',
              )}
            >
              <span className="block font-semibold">
                {address.label || address.neighborhood || address.street}
              </span>
              {address.street}, {address.number}
            </button>
          ))}
        </div>
      ) : null}
      <CurrentLocationButton onResolve={handleCurrentLocation} />
      <div className="grid min-w-0 grid-cols-3 gap-2">
        <AddressAutocomplete
          className="col-span-2"
          inputClassName={checkoutFieldClass}
          value={details.street}
          onChange={(text) =>
            setAddressDetails({
              street: text,
              latitude: undefined,
              longitude: undefined,
              locationSource: undefined,
              locationAccuracyMeters: undefined,
              locationDiverged: undefined,
            })
          }
          onResolve={handleGeocodedPlace}
          bias={options?.store}
          placeholder="Rua"
          aria-label="Rua"
        />
        <Input
          value={details.number}
          onChange={(e) =>
            // Não limpa lat/lng: a coordenada está presa à rua (definida
            // pelo autocomplete ou pelo pin), não ao número.
            setAddressDetails({ number: e.target.value })
          }
          placeholder="Nº"
          className={checkoutFieldClass}
        />
      </div>
      <Input
        value={details.neighborhood}
        onChange={(e) => setAddressDetails({ neighborhood: e.target.value })}
        placeholder="Bairro / localidade (opcional)"
        className={checkoutFieldClass}
      />
      <Input
        value={details.complement}
        onChange={(e) => setAddressDetails({ complement: e.target.value })}
        placeholder="Complemento (opcional)"
        className={checkoutFieldClass}
      />
      <Input
        value={details.referencePoint}
        onChange={(e) => setAddressDetails({ referencePoint: e.target.value })}
        placeholder="Ponto de referência"
        className={checkoutFieldClass}
      />

      {quoting ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Calculando entrega…
        </div>
      ) : null}

      {quoteError ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>{quoteError}</p>
        </div>
      ) : null}

      {checkout.deliveryInServiceArea === false ? (
        <div className="flex items-start gap-2 rounded-md border border-transparent bg-tone-warning p-2.5 text-sm text-tone-warning-foreground">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>
            {quoteMessage ??
              'Endereço fora da área de entrega. Escolha retirada na loja.'}
          </p>
        </div>
      ) : null}

      {checkout.deliveryInServiceArea === true &&
      checkout.routeDistanceMeters != null ? (
        <>
          <div className="flex items-start gap-2 rounded-md bg-muted p-2.5">
            {deliveryFee === 0 ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
            ) : (
              <Bike className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            )}
            <p className="min-w-0 flex-1 text-sm leading-snug break-words text-muted-foreground">
              Taxa de entrega:{' '}
              <span className="font-semibold text-foreground">
                {deliveryFee === 0 ? 'Grátis' : formatCatalogPrice(deliveryFee)}
              </span>{' '}
              · A {(checkout.routeDistanceMeters / 1000).toFixed(1)} km da loja
            </p>
          </div>

          {quoteMessage ? (
            <div className="flex items-start gap-2 rounded-md bg-tone-warning p-2.5 text-sm text-tone-warning-foreground">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <p>{quoteMessage}</p>
            </div>
          ) : null}

          {checkout.addressDetails.latitude != null &&
          checkout.addressDetails.longitude != null ? (
            <DeliveryMapConfirm
              latitude={checkout.addressDetails.latitude}
              longitude={checkout.addressDetails.longitude}
              confirmed={checkout.locationConfirmed}
              onConfirm={() => setLocationConfirmed(true)}
              onCenterChange={(lat, lng) => {
                const diverged = highConfidenceOriginRef.current
                  ? haversineDistanceMeters(highConfidenceOriginRef.current, {
                      latitude: lat,
                      longitude: lng,
                    }) > PIN_DIVERGENCE_METERS
                  : false;
                setAddressDetails({
                  locationSource: 'manual_pin',
                  locationAccuracyMeters: undefined,
                  locationDiverged: diverged,
                });
                revalidateWithCoords(lat, lng);
              }}
              addressPreview={checkout.addressDetails.formattedAddress}
              accuracyMeters={checkout.addressDetails.locationAccuracyMeters}
              diverged={checkout.addressDetails.locationDiverged}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
