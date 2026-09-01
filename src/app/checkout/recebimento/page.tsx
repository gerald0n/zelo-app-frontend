'use client';

import { useEffect, useMemo, useState, useEffectEvent, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Zap,
  Calendar,
  Bike,
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useCheckout } from '@/contexts/CheckoutContext';
import { useAuth } from '@/contexts/AuthContext';
import { checkoutContinuePath } from '@/modules/auth/checkout-path';
import { Input } from '@/components/ui/input';
import CheckoutProgress from '@/components/CheckoutProgress';
import { DeliveryMapConfirm } from '@/components/checkout/DeliveryMapConfirm';
import { formatCatalogPrice } from '@/modules/catalog/types';
import type { DeliveryQuoteSource } from '@/modules/delivery';
import type { SavedAddress } from '@/modules/customers/addresses';
import { cn } from '@/lib/cn';
import {
  checkoutFieldClass,
  checkoutFooterClass,
  checkoutDesktopContainerClass,
  pageHeaderBarClass,
  pageBodyPadClass,
  pageCtaBaseClass,
} from '@/lib/layout';

type CheckoutOptions = {
  store: {
    id: string;
    name: string;
    addressLine: string;
    city: string;
    state: string;
    freeDeliveryRadiusMeters: number;
    fixedDeliveryFeeCents: number;
  };
  neighborhoods: Array<{ id: string; name: string }>;
  scheduling: {
    storeOpen: boolean;
    availableDates: string[];
    timesByDate: Record<string, { delivery: string[]; pickup: string[] }>;
  };
};

type ValidationResult = {
  inServiceArea: boolean;
  routeDistanceMeters: number;
  deliveryFeeCents: number;
  latitude: number;
  longitude: number;
  formattedAddress: string;
  source: DeliveryQuoteSource;
  message?: string;
};

function formatDateLabel(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  return date.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
}

export default function RecebimentoPage() {
  const router = useRouter();
  const {
    checkout,
    setDeliveryType,
    setScheduleType,
    setScheduledDate,
    setScheduledTime,
    setAddressDetails,
    setDeliveryQuote,
    clearDeliveryQuote,
    setLocationConfirmed,
  } = useCheckout();
  const { user, identityReady } = useAuth();

  const [options, setOptions] = useState<CheckoutOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteMessage, setQuoteMessage] = useState<string | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);

  const storeOpen = options?.scheduling.storeOpen ?? false;
  const allowImmediate = storeOpen;

  const onOptionsLoaded = useEffectEvent((data: CheckoutOptions) => {
    setOptions(data);
    if (!data.scheduling.storeOpen && checkout.scheduleType === 'now') {
      setScheduleType('scheduled');
    }
    if (
      checkout.scheduleType === 'scheduled' &&
      !checkout.scheduledDate &&
      data.scheduling.availableDates[0]
    ) {
      setScheduledDate(data.scheduling.availableDates[0]);
    }
  });

  useEffect(() => {
    if (!identityReady) return;
    const next = checkoutContinuePath(user);
    if (next !== '/checkout/recebimento') {
      router.replace(next);
    }
  }, [identityReady, user, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/v1/checkout/options');
        const json = await response.json();
        if (!response.ok) {
          if (!cancelled) {
            setOptionsError(
              json?.error?.message ?? 'Não foi possível carregar opções.',
            );
          }
          return;
        }
        if (!cancelled) onOptionsLoaded(json as CheckoutOptions);
      } catch {
        if (!cancelled) {
          setOptionsError('Falha de rede ao carregar opções de checkout.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setSavedAddresses([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/v1/addresses', {
          cache: 'no-store',
        });
        const json = await response.json().catch(() => null);
        if (!response.ok || cancelled) return;
        setSavedAddresses((json.addresses as SavedAddress[]) ?? []);
      } catch {
        /* o formulário continua disponível */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setSavedAddresses([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/v1/addresses', {
          cache: 'no-store',
        });
        const json = await response.json().catch(() => null);
        if (!response.ok || cancelled) return;
        setSavedAddresses((json.addresses as SavedAddress[]) ?? []);
      } catch {
        /* o formulário continua disponível */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!storeOpen && checkout.scheduleType === 'now') {
      setScheduleType('scheduled');
    }
  }, [storeOpen, checkout.scheduleType, setScheduleType]);

  const availableDates = options?.scheduling.availableDates ?? [];

  const availableTimes = useMemo(() => {
    if (!options || !checkout.scheduledDate) return [];
    const bucket = options.scheduling.timesByDate[checkout.scheduledDate];
    if (!bucket) return [];
    return checkout.deliveryType === 'delivery'
      ? bucket.delivery
      : bucket.pickup;
  }, [options, checkout.scheduledDate, checkout.deliveryType]);

  useEffect(() => {
    if (
      checkout.scheduleType === 'scheduled' &&
      checkout.scheduledTime &&
      availableTimes.length > 0 &&
      !availableTimes.includes(checkout.scheduledTime)
    ) {
      setScheduledTime(availableTimes[0] ?? '');
    }
  }, [
    availableTimes,
    checkout.scheduleType,
    checkout.scheduledTime,
    setScheduledTime,
  ]);

  const details = checkout.addressDetails;
  const canQuote =
    checkout.deliveryType === 'delivery' &&
    details.street.trim().length > 1 &&
    details.number.trim().length > 0 &&
    details.neighborhood.trim().length > 0;

  const applyValidation = useEffectEvent((validation: ValidationResult) => {
    setQuoteMessage(validation.message ?? null);
    setDeliveryQuote({
      routeDistanceMeters: validation.routeDistanceMeters,
      deliveryFeeCents: validation.deliveryFeeCents,
      inServiceArea: validation.inServiceArea,
      source: validation.source,
      latitude: validation.latitude,
      longitude: validation.longitude,
      formattedAddress: validation.formattedAddress,
      locationConfirmed: false,
    });
  });

  const lastValidationKeyRef = useRef<string | null>(null);

  const buildValidationKey = useEffectEvent(
    (coords?: { latitude?: number; longitude?: number }) =>
      JSON.stringify({
        street: details.street.trim(),
        number: details.number.trim(),
        neighborhood: details.neighborhood.trim(),
        complement: details.complement.trim(),
        referencePoint: details.referencePoint.trim(),
        city: details.city || 'Pereiro',
        state: details.state || 'CE',
        postalCode: details.postalCode.trim(),
        latitude: coords?.latitude ?? details.latitude ?? null,
        longitude: coords?.longitude ?? details.longitude ?? null,
      }),
  );

  const runValidation = useEffectEvent(
    async (coords?: { latitude?: number; longitude?: number }) => {
      if (!canQuote) return;

      const validationKey = buildValidationKey(coords);
      if (validationKey === lastValidationKeyRef.current) return;
      lastValidationKeyRef.current = validationKey;

      setQuoting(true);
      setQuoteError(null);
      try {
        const response = await fetch('/api/v1/addresses/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            street: details.street,
            number: details.number,
            neighborhood: details.neighborhood,
            complement: details.complement || undefined,
            referencePoint: details.referencePoint || undefined,
            city: details.city || 'Pereiro',
            state: details.state || 'CE',
            postalCode: details.postalCode || undefined,
            latitude: coords?.latitude ?? details.latitude,
            longitude: coords?.longitude ?? details.longitude,
          }),
        });
        const json = await response.json();
        if (!response.ok) {
          lastValidationKeyRef.current = null;
          clearDeliveryQuote();
          setQuoteError(
            json?.error?.message ?? 'Não foi possível validar o endereço.',
          );
          return;
        }
        applyValidation(json.validation as ValidationResult);
      } catch {
        lastValidationKeyRef.current = null;
        clearDeliveryQuote();
        setQuoteError('Falha de rede ao validar o endereço.');
      } finally {
        setQuoting(false);
      }
    },
  );

  useEffect(() => {
    if (!canQuote) {
      lastValidationKeyRef.current = null;
      return;
    }

    const timer = window.setTimeout(() => {
      void runValidation();
    }, 450);

    return () => window.clearTimeout(timer);
  }, [
    canQuote,
    details.street,
    details.number,
    details.neighborhood,
    details.complement,
    details.referencePoint,
    details.city,
    details.state,
    details.postalCode,
  ]);

  const pendingCoordsRef = useRef<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [coordsRevalidateNonce, setCoordsRevalidateNonce] = useState(0);

  const revalidateWithCoords = (latitude: number, longitude: number) => {
    setAddressDetails({ latitude, longitude });
    setLocationConfirmed(false);
    pendingCoordsRef.current = { latitude, longitude };
    setCoordsRevalidateNonce((nonce) => nonce + 1);
  };

  // Dispara a validação a partir de coordenadas do mapa. Passa por um nonce
  // para que `runValidation` (useEffectEvent) só seja chamado de dentro de
  // um Effect — nunca direto do handler.
  useEffect(() => {
    if (coordsRevalidateNonce === 0) return;
    const timer = window.setTimeout(() => {
      const coords = pendingCoordsRef.current;
      if (coords) void runValidation(coords);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [coordsRevalidateNonce]);

  const deliveryFee =
    checkout.deliveryType === 'delivery' ? checkout.deliveryFeeCents : 0;

  const deliveryReady =
    checkout.deliveryType === 'pickup' ||
    (checkout.deliveryInServiceArea === true &&
      checkout.routeDistanceMeters != null &&
      checkout.locationConfirmed);

  const scheduleReady =
    checkout.scheduleType === 'now'
      ? allowImmediate
      : Boolean(checkout.scheduledDate && checkout.scheduledTime);

  const isValid = deliveryReady && scheduleReady && !quoting;

  return (
    <div className="flex min-h-dvh min-w-0 flex-col bg-background">
      <header className={cn(pageHeaderBarClass, checkoutDesktopContainerClass)}>
        <Link href="/carrinho" aria-label="Voltar ao carrinho">
          <ArrowLeft className="size-6" />
        </Link>
        <h1 className="text-lg font-semibold">Recebimento</h1>
        <span className="w-6" />
      </header>

      <CheckoutProgress
        current={1}
        total={3}
        labels={['Recebimento', 'Pagamento', 'Revisão']}
        className={checkoutDesktopContainerClass}
      />

      <div>
        <div
          className={cn(
            'space-y-3',
            pageBodyPadClass,
            checkoutDesktopContainerClass,
          )}
        >
          {optionsError ? (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <p>{optionsError}</p>
            </div>
          ) : null}

          <p className="text-base font-semibold">Quando?</p>
          <div className="flex min-w-0 gap-2.5">
            <button
              type="button"
              disabled={!allowImmediate}
              onClick={() => allowImmediate && setScheduleType('now')}
              className={cn(
                'flex flex-1 flex-col items-center gap-1.5 rounded-md border-[1.5px] py-3.5 transition-[background-color,border-color,transform] duration-100 active:scale-[0.98]',
                checkout.scheduleType === 'now'
                  ? 'border-primary bg-primary/[0.07]'
                  : 'border-border bg-card',
                !allowImmediate && 'opacity-40',
              )}
            >
              <Zap
                className={cn(
                  'size-[22px]',
                  checkout.scheduleType === 'now'
                    ? 'text-primary'
                    : 'text-muted-foreground',
                )}
              />
              <span
                className={cn(
                  'text-sm',
                  checkout.scheduleType === 'now'
                    ? 'font-semibold text-primary'
                    : 'text-foreground',
                )}
              >
                Agora
              </span>
              {!allowImmediate ? (
                <span className="text-2xs text-muted-foreground">
                  Loja fechada
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => setScheduleType('scheduled')}
              className={cn(
                'flex flex-1 flex-col items-center gap-1.5 rounded-md border-[1.5px] py-3.5 transition-[background-color,border-color,transform] duration-100 active:scale-[0.98]',
                checkout.scheduleType === 'scheduled'
                  ? 'border-primary bg-primary/[0.07]'
                  : 'border-border bg-card',
              )}
            >
              <Calendar
                className={cn(
                  'size-[22px]',
                  checkout.scheduleType === 'scheduled'
                    ? 'text-primary'
                    : 'text-muted-foreground',
                )}
              />
              <span
                className={cn(
                  'text-sm',
                  checkout.scheduleType === 'scheduled'
                    ? 'font-semibold text-primary'
                    : 'text-foreground',
                )}
              >
                Agendar
              </span>
            </button>
          </div>

          {checkout.scheduleType === 'scheduled' ? (
            <div className="mt-1 space-y-2.5">
              <p className="text-sm font-semibold">Data</p>
              <div className="no-scrollbar -mx-1 min-w-0 overflow-x-auto px-1">
                {availableDates.map((key) => {
                  const selected = checkout.scheduledDate === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setScheduledDate(key)}
                      className={cn(
                        'mr-2 inline-flex shrink-0 rounded-lg border px-3.5 py-2 text-sm font-medium last:mr-0',
                        selected
                          ? 'border-primary bg-primary text-white'
                          : 'border-border bg-card',
                      )}
                    >
                      {formatDateLabel(key)}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-sm font-semibold">Horário</p>
              <div className="flex flex-wrap gap-2">
                {availableTimes.map((time) => {
                  const selected = checkout.scheduledTime === time;
                  return (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setScheduledTime(time)}
                      className={cn(
                        'rounded-md border px-4 py-2 text-sm font-medium',
                        selected
                          ? 'border-primary bg-primary text-white'
                          : 'border-border bg-card',
                      )}
                    >
                      {time}
                    </button>
                  );
                })}
                {availableTimes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum horário disponível nesta data.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          <p className="mt-2 text-base font-semibold">Como?</p>
          <div className="flex min-w-0 gap-2.5">
            {(['delivery', 'pickup'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setDeliveryType(t)}
                className={cn(
                  'flex flex-1 flex-col items-center gap-1.5 rounded-md border-[1.5px] py-3.5 transition-[background-color,border-color,transform] duration-100 active:scale-[0.98]',
                  checkout.deliveryType === t
                    ? 'border-primary bg-primary/[0.07]'
                    : 'border-border bg-card',
                )}
              >
                {t === 'delivery' ? (
                  <Bike
                    className={cn(
                      'size-[22px]',
                      checkout.deliveryType === t
                        ? 'text-primary'
                        : 'text-muted-foreground',
                    )}
                  />
                ) : (
                  <ShoppingBag
                    className={cn(
                      'size-[22px]',
                      checkout.deliveryType === t
                        ? 'text-primary'
                        : 'text-muted-foreground',
                    )}
                  />
                )}
                <span
                  className={cn(
                    'text-sm',
                    checkout.deliveryType === t
                      ? 'font-semibold text-primary'
                      : 'text-foreground',
                  )}
                >
                  {t === 'delivery' ? 'Entrega' : 'Retirada'}
                </span>
                <span className="text-2xs text-muted-foreground">
                  {t === 'delivery'
                    ? checkout.routeDistanceMeters != null
                      ? deliveryFee === 0
                        ? 'Grátis'
                        : formatCatalogPrice(deliveryFee)
                      : 'Grátis até 2 km'
                    : 'Grátis'}
                </span>
              </button>
            ))}
          </div>

          {checkout.deliveryType === 'pickup' && options ? (
            <div className="rounded-md bg-muted p-3 text-sm leading-5 text-muted-foreground">
              Retire em {options.store.name} · {options.store.addressLine},{' '}
              {options.store.city}/{options.store.state}
            </div>
          ) : null}

          {checkout.deliveryType === 'delivery' ? (
            <div className="mt-2 min-w-0 space-y-2.5">
              <p className="text-base font-semibold">Endereço de entrega</p>
              {savedAddresses.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {savedAddresses.map((address) => (
                    <button
                      key={address.id}
                      type="button"
                      onClick={() => {
                        setSelectedSavedId(address.id);
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
                        {address.label || address.neighborhood}
                      </span>
                      {address.street}, {address.number}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="grid min-w-0 grid-cols-3 gap-2">
                <Input
                  value={details.street}
                  onChange={(e) =>
                    setAddressDetails({
                      street: e.target.value,
                      latitude: undefined,
                      longitude: undefined,
                    })
                  }
                  placeholder="Rua"
                  className={cn(checkoutFieldClass, 'col-span-2')}
                />
                <Input
                  value={details.number}
                  onChange={(e) =>
                    setAddressDetails({
                      number: e.target.value,
                      latitude: undefined,
                      longitude: undefined,
                    })
                  }
                  placeholder="Nº"
                  className={checkoutFieldClass}
                />
              </div>
              <select
                value={details.neighborhood}
                onChange={(e) =>
                  setAddressDetails({
                    neighborhood: e.target.value,
                    latitude: undefined,
                    longitude: undefined,
                  })
                }
                className={checkoutFieldClass}
              >
                <option value="">Bairro / localidade</option>
                {(options?.neighborhoods ?? []).map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
              <Input
                value={details.complement}
                onChange={(e) =>
                  setAddressDetails({ complement: e.target.value })
                }
                placeholder="Complemento (opcional)"
                className={checkoutFieldClass}
              />
              <Input
                value={details.referencePoint}
                onChange={(e) =>
                  setAddressDetails({ referencePoint: e.target.value })
                }
                placeholder="Ponto de referência"
                className={checkoutFieldClass}
              />

              {quoting ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Calculando rota…
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
                      'Fora da área urbana de Pereiro. Escolha retirada na loja.'}
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
                        {deliveryFee === 0
                          ? 'Grátis'
                          : formatCatalogPrice(deliveryFee)}
                      </span>{' '}
                      · Distância por rota:{' '}
                      {(checkout.routeDistanceMeters / 1000).toFixed(1)} km
                      {checkout.deliveryQuoteSource === 'local_fallback'
                        ? ' (estimativa local)'
                        : checkout.deliveryQuoteSource === 'openstreetmap'
                          ? ' (rota)'
                          : null}
                    </p>
                  </div>

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
                    />
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}

          <div className={checkoutFooterClass}>
            <button
              type="button"
              disabled={!isValid}
              onClick={() => router.push('/checkout/pagamento')}
              className={cn(
                pageCtaBaseClass,
                isValid
                  ? 'bg-primary text-white'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              Continuar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
