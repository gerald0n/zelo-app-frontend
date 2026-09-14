'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { DeliveryMapConfirm } from '@/components/checkout/DeliveryMapConfirm';
import { AddressAutocomplete } from '@/components/checkout/AddressAutocomplete';
import { CurrentLocationButton } from '@/components/checkout/CurrentLocationButton';
import { Input } from '@/components/ui/input';
import type { LocationSource } from '@/modules/delivery/geo';
import { checkoutFieldClass, pageCtaBaseClass } from '@/lib/layout';
import { cn } from '@/lib/cn';
import { useAddressLocation } from '@/components/account/useAddressLocation';
import {
  validateAddress,
  type QuotePreview,
} from '@/components/account/validate-address';

export type AddressFormValue = {
  label: string;
  street: string;
  number: string;
  neighborhood: string;
  complement: string;
  referencePoint: string;
  latitude?: number;
  longitude?: number;
  locationSource?: LocationSource;
  locationAccuracyMeters?: number;
  locationDiverged?: boolean;
  formattedAddress?: string;
  isDefault: boolean;
};

export function AccountAddressForm({
  initial,
  submitting,
  error,
  submitLabel,
  onSubmit,
}: {
  initial?: Partial<AddressFormValue>;
  submitting: boolean;
  error: string;
  submitLabel: string;
  onSubmit: (value: AddressFormValue) => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? '');
  const [street, setStreet] = useState(initial?.street ?? '');
  const [number, setNumber] = useState(initial?.number ?? '');
  const [neighborhood, setNeighborhood] = useState(initial?.neighborhood ?? '');
  const [complement, setComplement] = useState(initial?.complement ?? '');
  const [referencePoint, setReferencePoint] = useState(
    initial?.referencePoint ?? '',
  );
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [quote, setQuote] = useState<QuotePreview | null>(
    initial?.latitude != null && initial?.longitude != null
      ? {
          inServiceArea: true,
          routeDistanceMeters: 0,
          latitude: initial.latitude,
          longitude: initial.longitude,
        }
      : null,
  );
  const [confirmed, setConfirmed] = useState(
    initial?.latitude != null && initial?.longitude != null,
  );

  const {
    placeCoords,
    locationSource,
    locationAccuracyMeters,
    locationDiverged,
    resetLocation,
    handleCenterChange,
    handleResolvedPlace,
    handleCurrentLocation,
  } = useAddressLocation(
    { street, number, neighborhood, setStreet, setNumber, setNeighborhood },
    initial?.latitude != null && initial?.longitude != null
      ? { latitude: initial.latitude, longitude: initial.longitude }
      : null,
  );

  // Rua+número preenchidos OU coordenada já confirmada (GPS/pin) — o texto
  // não é mais pré-requisito único quando o cliente já apontou o local no
  // mapa (ex.: rua não reconhecida pelo Google).
  const canQuote =
    (street.trim().length > 0 && number.trim().length > 0) ||
    placeCoords != null;

  // Endereço ficou incompleto → limpa a cotação obsoleta. Ajuste de estado no
  // render (padrão "adjusting state when a prop changes" do React), não em
  // effect, para não disparar set-state-in-effect.
  const [wasQuotable, setWasQuotable] = useState(canQuote);
  if (wasQuotable !== canQuote) {
    setWasQuotable(canQuote);
    if (!canQuote) {
      setQuote(null);
      setQuoteError('');
      setConfirmed(false);
    }
  }

  useEffect(() => {
    if (!canQuote) return;

    const timer = window.setTimeout(async () => {
      setQuoting(true);
      setQuoteError('');
      setConfirmed(false);
      const result = await validateAddress({
        street,
        number,
        neighborhood: '',
        complement: '',
        referencePoint: '',
        latitude: placeCoords?.latitude,
        longitude: placeCoords?.longitude,
      });
      if (!result.ok) {
        setQuote(null);
        setQuoteError(result.message);
      } else {
        setQuote(result.data);
      }
      setQuoting(false);
    }, 450);

    return () => window.clearTimeout(timer);
    // `neighborhood` fica de fora de propósito: é opcional e não muda a
    // cotação (que vai por rua + número + coordenada).
  }, [canQuote, street, number, placeCoords]);

  const isValid =
    canQuote && quote?.inServiceArea === true && confirmed && !quoting;

  return (
    <form
      className="space-y-2.5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!isValid || !quote) return;
        onSubmit({
          label,
          street,
          number,
          neighborhood,
          complement,
          referencePoint,
          latitude: quote.latitude,
          longitude: quote.longitude,
          locationSource,
          locationAccuracyMeters,
          locationDiverged,
          formattedAddress: quote.formattedAddress,
          isDefault,
        });
      }}
    >
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Apelido (Casa, Trabalho…)"
        className={checkoutFieldClass}
      />
      <CurrentLocationButton onResolve={handleCurrentLocation} />
      <div className="grid min-w-0 grid-cols-3 gap-2">
        <AddressAutocomplete
          className="col-span-2"
          inputClassName={checkoutFieldClass}
          value={street}
          onChange={(text) => {
            setStreet(text);
            resetLocation();
          }}
          onResolve={handleResolvedPlace}
          placeholder="Rua"
          aria-label="Rua"
        />
        <Input
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="Nº"
          className={checkoutFieldClass}
        />
      </div>
      <Input
        value={neighborhood}
        onChange={(e) => setNeighborhood(e.target.value)}
        placeholder="Bairro / localidade (opcional)"
        className={checkoutFieldClass}
      />
      <Input
        value={complement}
        onChange={(e) => setComplement(e.target.value)}
        placeholder="Complemento (opcional)"
        className={checkoutFieldClass}
      />
      <Input
        value={referencePoint}
        onChange={(e) => setReferencePoint(e.target.value)}
        placeholder="Ponto de referência"
        className={checkoutFieldClass}
      />

      <label className="flex items-center gap-2 py-1 text-sm">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          className="size-4 accent-primary"
        />
        Usar como endereço padrão
      </label>

      {quoting ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Calculando entrega…
        </div>
      ) : null}

      {quoteError || error ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>{error || quoteError}</p>
        </div>
      ) : null}

      {quote?.inServiceArea === false ? (
        <div className="flex items-start gap-2 rounded-md border border-transparent bg-tone-warning p-2.5 text-sm text-tone-warning-foreground">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>
            {quote.message ??
              'Endereço fora da área de entrega.'}
          </p>
        </div>
      ) : null}

      {quote?.inServiceArea ? (
        <>
          {quote.routeDistanceMeters > 0 ? (
            <div className="flex items-start gap-2 rounded-md bg-muted p-2.5 text-sm text-muted-foreground">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
              <p>A {(quote.routeDistanceMeters / 1000).toFixed(1)} km da loja</p>
            </div>
          ) : null}
          {quote.message ? (
            <div className="flex items-start gap-2 rounded-md bg-tone-warning p-2.5 text-sm text-tone-warning-foreground">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <p>{quote.message}</p>
            </div>
          ) : null}
          <DeliveryMapConfirm
            latitude={quote.latitude}
            longitude={quote.longitude}
            confirmed={confirmed}
            onConfirm={() => setConfirmed(true)}
            onCenterChange={handleCenterChange}
            addressPreview={quote.formattedAddress}
            accuracyMeters={locationAccuracyMeters}
            diverged={locationDiverged}
          />
        </>
      ) : null}

      <button
        type="submit"
        disabled={!isValid || submitting}
        className={cn(
          pageCtaBaseClass,
          'mt-4',
          isValid && !submitting
            ? 'bg-primary text-white'
            : 'bg-muted text-muted-foreground',
        )}
      >
        {submitting ? 'Salvando…' : submitLabel}
      </button>
    </form>
  );
}
