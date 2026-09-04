'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { DeliveryMapConfirm } from '@/components/checkout/DeliveryMapConfirm';
import { AddressAutocomplete } from '@/components/checkout/AddressAutocomplete';
import { Input } from '@/components/ui/input';
import { PEREIRO_URBAN_NEIGHBORHOODS } from '@/modules/delivery/pereiro';
import type { ResolvedPlace } from '@/modules/delivery/places';
import { checkoutFieldClass, pageCtaBaseClass } from '@/lib/layout';
import { cn } from '@/lib/cn';

export type AddressFormValue = {
  label: string;
  street: string;
  number: string;
  neighborhood: string;
  complement: string;
  referencePoint: string;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
};

type QuotePreview = {
  inServiceArea: boolean;
  routeDistanceMeters: number;
  latitude: number;
  longitude: number;
  message?: string;
};

async function validateAddress(payload: {
  street: string;
  number: string;
  neighborhood: string;
  complement: string;
  referencePoint: string;
  latitude?: number;
  longitude?: number;
}): Promise<{ ok: true; data: QuotePreview } | { ok: false; message: string }> {
  try {
    const response = await fetch('/api/v1/addresses/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        message: json?.error?.message ?? 'Não foi possível validar o endereço.',
      };
    }
    return { ok: true, data: json.validation as QuotePreview };
  } catch {
    return { ok: false, message: 'Falha de rede ao validar o endereço.' };
  }
}

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

  const canQuote =
    street.trim().length > 0 &&
    number.trim().length > 0 &&
    neighborhood.trim().length > 0;

  // Pula a próxima auto-validação por texto quando o endereço acabou de ser
  // resolvido pelo autocomplete (já validamos com a coordenada exata).
  const skipAutoValidateRef = useRef(false);

  useEffect(() => {
    if (!canQuote) {
      setQuote(null);
      setQuoteError('');
      setConfirmed(false);
      return;
    }

    if (skipAutoValidateRef.current) {
      skipAutoValidateRef.current = false;
      return;
    }

    const timer = window.setTimeout(async () => {
      setQuoting(true);
      setQuoteError('');
      setConfirmed(false);
      const result = await validateAddress({
        street,
        number,
        neighborhood,
        complement,
        referencePoint,
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
  }, [canQuote, street, number, neighborhood, complement, referencePoint]);

  const revalidateWithCoords = async (
    latitude: number,
    longitude: number,
    addressOverride?: {
      street?: string;
      number?: string;
      neighborhood?: string;
    },
  ) => {
    setQuoting(true);
    setQuoteError('');
    setConfirmed(false);
    const result = await validateAddress({
      street: addressOverride?.street ?? street,
      number: addressOverride?.number ?? number,
      neighborhood: addressOverride?.neighborhood ?? neighborhood,
      complement,
      referencePoint,
      latitude,
      longitude,
    });
    if (!result.ok) {
      setQuoteError(result.message);
    } else {
      setQuote(result.data);
    }
    setQuoting(false);
  };

  const handleResolvedPlace = (place: ResolvedPlace) => {
    const nextStreet = place.street || street;
    const nextNumber = place.number || number;
    const nextNeighborhood = place.neighborhood || neighborhood;
    setStreet(nextStreet);
    setNumber(nextNumber);
    setNeighborhood(nextNeighborhood);

    const hasCoords =
      Number.isFinite(place.latitude) && Number.isFinite(place.longitude);
    if (hasCoords && nextNumber.trim() && nextNeighborhood.trim()) {
      skipAutoValidateRef.current = true;
      void revalidateWithCoords(place.latitude, place.longitude, {
        street: nextStreet,
        number: nextNumber,
        neighborhood: nextNeighborhood,
      });
    }
  };

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
      <div className="grid min-w-0 grid-cols-3 gap-2">
        <AddressAutocomplete
          className="col-span-2"
          inputClassName={checkoutFieldClass}
          value={street}
          onChange={setStreet}
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
      <select
        value={neighborhood}
        onChange={(e) => setNeighborhood(e.target.value)}
        className={checkoutFieldClass}
      >
        <option value="">Bairro / localidade</option>
        {PEREIRO_URBAN_NEIGHBORHOODS.map((item) => (
          <option key={item.id} value={item.name}>
            {item.name}
          </option>
        ))}
      </select>
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
          Calculando rota…
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
              'Fora da área urbana de Pereiro. Escolha outro endereço.'}
          </p>
        </div>
      ) : null}

      {quote?.inServiceArea ? (
        <>
          {quote.routeDistanceMeters > 0 ? (
            <div className="flex items-start gap-2 rounded-md bg-muted p-2.5 text-sm text-muted-foreground">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
              <p>
                Distância por rota:{' '}
                {(quote.routeDistanceMeters / 1000).toFixed(1)} km
              </p>
            </div>
          ) : null}
          <DeliveryMapConfirm
            latitude={quote.latitude}
            longitude={quote.longitude}
            confirmed={confirmed}
            onConfirm={() => setConfirmed(true)}
            onCenterChange={(lat, lng) => {
              void revalidateWithCoords(lat, lng);
            }}
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
