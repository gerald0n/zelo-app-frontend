'use client';

import { useEffect, useMemo, useState, useEffectEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bike, ShoppingBag, AlertCircle } from 'lucide-react';
import { useCheckout } from '@/contexts/CheckoutContext';
import { useCart } from '@/modules/carts';
import { useAuth } from '@/contexts/AuthContext';
import { checkoutContinuePath } from '@/modules/auth/checkout-path';
import CheckoutProgress from '@/components/CheckoutProgress';
import { formatCatalogPrice } from '@/modules/catalog/types';
import type { SavedAddress } from '@/modules/customers/addresses';
import { cn } from '@/lib/cn';
import {
  checkoutFooterClass,
  checkoutDesktopContainerClass,
  pageHeaderBarClass,
  pageBodyPadClass,
  pageCtaBaseClass,
} from '@/lib/layout';
import {
  formatRadius,
  type CheckoutOptions,
} from '@/app/checkout/recebimento/recebimento-helpers';
import { useDeliveryQuote } from '@/app/checkout/recebimento/useDeliveryQuote';
import { ScheduleSection } from '@/app/checkout/recebimento/_sections/ScheduleSection';
import { DeliveryAddressSection } from '@/app/checkout/recebimento/_sections/DeliveryAddressSection';

export default function RecebimentoPage() {
  const router = useRouter();
  const {
    checkout,
    setDeliveryType,
    setScheduleType,
    setScheduledDate,
    setScheduledTime,
  } = useCheckout();
  const { user, identityReady } = useAuth();
  const { items } = useCart();

  const [options, setOptions] = useState<CheckoutOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [fetchedAddresses, setFetchedAddresses] = useState<SavedAddress[]>([]);
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);

  // Convidado (sem conta) nunca tem endereço salvo — derivado, sem setState
  // no corpo do effect para o caso "sem usuário".
  const savedAddresses = user ? fetchedAddresses : [];

  const productIdsKey = useMemo(
    () => [...new Set(items.map((item) => item.productId))].sort().join(','),
    [items],
  );

  const mixedCart = options?.scheduling.mixedCart ?? false;
  const storeOpen = options?.scheduling.storeOpen ?? false;
  const allowSameDay = options?.scheduling.allowSameDay ?? true;
  const allowImmediate = storeOpen && allowSameDay && !mixedCart;

  const { quoting, quoteError, quoteMessage, revalidateWithCoords } =
    useDeliveryQuote();

  const onOptionsLoaded = useEffectEvent((data: CheckoutOptions) => {
    setOptions(data);
    const canBeImmediate =
      data.scheduling.storeOpen &&
      data.scheduling.allowSameDay &&
      !data.scheduling.mixedCart;
    if (!canBeImmediate && checkout.scheduleType === 'now') {
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
        const response = await fetch('/api/v1/checkout/options', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            productIds: productIdsKey ? productIdsKey.split(',') : [],
          }),
        });
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
  }, [productIdsKey]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/v1/addresses', {
          cache: 'no-store',
        });
        const json = await response.json().catch(() => null);
        if (!response.ok || cancelled) return;
        setFetchedAddresses((json.addresses as SavedAddress[]) ?? []);
      } catch {
        /* o formulário continua disponível */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!allowImmediate && checkout.scheduleType === 'now') {
      setScheduleType('scheduled');
    }
  }, [allowImmediate, checkout.scheduleType, setScheduleType]);

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

  const isValid = deliveryReady && scheduleReady && !quoting && !mixedCart;

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

          {mixedCart ? (
            <div className="flex items-start gap-2 rounded-md border border-transparent bg-tone-warning p-3 text-sm text-tone-warning-foreground">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <p>
                Seu carrinho tem itens de categorias com regras de agendamento
                diferentes (ex.: cookies e pudins). Finalize uma categoria por
                vez —{' '}
                <Link href="/carrinho" className="font-semibold underline">
                  voltar ao carrinho
                </Link>
                .
              </p>
            </div>
          ) : null}

          <ScheduleSection
            allowImmediate={allowImmediate}
            allowSameDay={allowSameDay}
            hoursLabel={options?.scheduling.hoursLabel ?? null}
            availableDates={availableDates}
            availableTimes={availableTimes}
          />

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
                      : options
                        ? `Grátis até ${formatRadius(
                            options.store.freeDeliveryRadiusMeters,
                          )}`
                        : 'Grátis por perto'
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
            <DeliveryAddressSection
              options={options}
              savedAddresses={savedAddresses}
              selectedSavedId={selectedSavedId}
              onSelectSaved={setSelectedSavedId}
              quoting={quoting}
              quoteError={quoteError}
              quoteMessage={quoteMessage}
              revalidateWithCoords={revalidateWithCoords}
            />
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
