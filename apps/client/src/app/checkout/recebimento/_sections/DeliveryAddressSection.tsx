'use client';

import {
  AlertCircle,
  Bike,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { useCheckout } from '@/contexts/CheckoutContext';
import { Input } from '@/components/ui/input';
import { DeliveryMapConfirm } from '@/components/checkout/DeliveryMapConfirm';
import { AddressAutocomplete } from '@/components/checkout/AddressAutocomplete';
import { formatCatalogPrice } from '@/modules/catalog/types';
import type { SavedAddress } from '@/modules/customers/addresses';
import { checkoutFieldClass } from '@/lib/layout';
import { cn } from '@/lib/cn';
import type { CheckoutOptions } from '@/app/checkout/recebimento/recebimento-helpers';

type Props = {
  options: CheckoutOptions | null;
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
            })
          }
          onResolve={(place) =>
            setAddressDetails({
              street: place.street || details.street,
              number: place.number || details.number,
              neighborhood: place.neighborhood || details.neighborhood,
              city: 'Pereiro',
              state: 'CE',
              latitude: Number.isFinite(place.latitude)
                ? place.latitude
                : undefined,
              longitude: Number.isFinite(place.longitude)
                ? place.longitude
                : undefined,
            })
          }
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
                revalidateWithCoords(lat, lng);
              }}
              addressPreview={checkout.addressDetails.formattedAddress}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
