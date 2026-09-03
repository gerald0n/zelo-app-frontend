'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, QrCode, Banknote, CreditCard, Check } from 'lucide-react';
import { useCheckout, type PaymentMethod } from '@/contexts/CheckoutContext';
import { useCart } from '@/contexts/CartContext';
import { Input } from '@/components/ui/input';
import CheckoutProgress from '@/components/CheckoutProgress';
import { formatCatalogPrice } from '@/modules/catalog/types';
import { cn } from '@/lib/cn';
import {
  checkoutFieldClass,
  checkoutFooterClass,
  checkoutDesktopContainerClass,
  pageHeaderBarClass,
  pageBodyPadClass,
  pageCtaBaseClass,
} from '@/lib/layout';

const METHODS: {
  id: PaymentMethod;
  label: string;
  icon: React.ElementType;
  desc: string;
}[] = [
  {
    id: 'pix',
    label: 'Pix',
    icon: QrCode,
    desc: 'QR Code na próxima etapa; a confirmação é automática.',
  },
  {
    id: 'cash',
    label: 'Dinheiro',
    icon: Banknote,
    desc: 'Pague na entrega ou retirada.',
  },
  {
    id: 'card',
    label: 'Cartão',
    icon: CreditCard,
    desc: 'Débito ou crédito na entrega ou retirada.',
  },
];

type CheckoutOptionsStore = {
  acceptsPayments?: {
    pix: boolean;
    cash: boolean;
    card: boolean;
  };
};

export default function PagamentoPage() {
  const router = useRouter();
  const { checkout, setPaymentMethod, setChangeFor } = useCheckout();
  const { subtotal } = useCart();
  const [needsChange, setNeedsChange] = useState<boolean | null>(null);
  const [acceptsPayments, setAcceptsPayments] = useState({
    pix: true,
    cash: true,
    card: true,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/v1/checkout/options');
        const json = await response.json();
        if (cancelled || !response.ok) return;
        const store = json?.store as CheckoutOptionsStore | undefined;
        if (store?.acceptsPayments) {
          setAcceptsPayments(store.acceptsPayments);
          const enabled = METHODS.filter(
            (method) => store.acceptsPayments?.[method.id],
          );
          if (
            enabled.length > 0 &&
            !store.acceptsPayments[checkout.paymentMethod]
          ) {
            setPaymentMethod(enabled[0].id);
            setNeedsChange(null);
          }
        }
      } catch {
        // Opções opcionais nesta fase; falha silenciosa.
      }
    })();
    return () => {
      cancelled = true;
    };
    // Intencional: só no mount; paymentMethod atual é lido uma vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const availableMethods = useMemo(
    () => METHODS.filter((method) => acceptsPayments[method.id]),
    [acceptsPayments],
  );

  const activePaymentMethod = acceptsPayments[checkout.paymentMethod]
    ? checkout.paymentMethod
    : (availableMethods[0]?.id ?? checkout.paymentMethod);

  const deliveryFee =
    checkout.deliveryType === 'delivery' ? checkout.deliveryFeeCents : 0;
  const total = subtotal + deliveryFee;

  const changeAmountCents = checkout.changeFor
    ? Math.round(parseFloat(checkout.changeFor.replace(',', '.')) * 100)
    : 0;
  const changeInvalid =
    activePaymentMethod === 'cash' &&
    needsChange === true &&
    checkout.changeFor.trim().length > 0 &&
    changeAmountCents < total;

  const isValid =
    availableMethods.length > 0 &&
    acceptsPayments[activePaymentMethod] &&
    (activePaymentMethod !== 'cash' ||
      needsChange === false ||
      (needsChange === true &&
        checkout.changeFor.trim().length > 0 &&
        !changeInvalid));

  return (
    <div className="flex min-h-dvh min-w-0 flex-col bg-background">
      <header className={cn(pageHeaderBarClass, checkoutDesktopContainerClass)}>
        <Link href="/checkout/recebimento" aria-label="Voltar ao recebimento">
          <ArrowLeft className="size-6" />
        </Link>
        <h1 className="text-lg font-semibold">Pagamento</h1>
        <span className="w-6" />
      </header>

      <CheckoutProgress
        current={2}
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
          <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
            <span className="text-sm text-muted-foreground">Total a pagar</span>
            <span className="text-xl font-bold">
              {formatCatalogPrice(total)}
            </span>
          </div>

          <p className="mt-1 text-base font-semibold">Forma de pagamento</p>

          {availableMethods.length === 0 ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Nenhuma forma de pagamento disponível no momento. Tente novamente
              mais tarde.
            </p>
          ) : null}

          {availableMethods.map((method) => {
            const selected = activePaymentMethod === method.id;
            const Icon = method.icon;
            return (
              <button
                key={method.id}
                type="button"
                onClick={() => {
                  setPaymentMethod(method.id);
                  setNeedsChange(null);
                }}
                className={cn(
                  'flex w-full items-center gap-3.5 rounded-md border-[1.5px] p-4 text-left transition-[background-color,border-color,transform] duration-100 active:scale-[0.99]',
                  selected
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-card',
                )}
              >
                <span
                  className={cn(
                    'flex size-12 items-center justify-center rounded-lg',
                    selected ? 'bg-primary/20' : 'bg-muted',
                  )}
                >
                  <Icon
                    className={cn(
                      'size-6',
                      selected ? 'text-primary' : 'text-muted-foreground',
                    )}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'text-base',
                      selected ? 'font-semibold' : 'font-normal',
                    )}
                  >
                    {method.label}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {method.desc}
                  </p>
                </div>
                <span
                  className={cn(
                    'flex size-[22px] items-center justify-center rounded-full border-[1.5px]',
                    selected
                      ? 'border-primary bg-primary'
                      : 'border-border bg-transparent',
                  )}
                >
                  {selected ? <Check className="size-3 text-white" /> : null}
                </span>
              </button>
            );
          })}

          {activePaymentMethod === 'pix' && acceptsPayments.pix ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-3">
              <QrCode className="mt-0.5 size-[18px] shrink-0 text-primary" />
              <p className="text-sm leading-5 text-muted-foreground">
                Ao continuar, você recebe um QR Code (e o código copia e cola)
                para pagar de qualquer banco. O pedido é confirmado
                automaticamente assim que o Pix cai — sem enviar comprovante.
              </p>
            </div>
          ) : null}

          {activePaymentMethod === 'cash' && acceptsPayments.cash ? (
            <div className="space-y-2.5">
              <p className="text-base font-semibold">Precisa de troco?</p>
              <div className="flex min-w-0 gap-2.5">
                {([false, true] as const).map((val) => {
                  const active = needsChange === val;
                  return (
                    <button
                      key={String(val)}
                      type="button"
                      onClick={() => {
                        setNeedsChange(val);
                        if (!val) setChangeFor('');
                      }}
                      className={cn(
                        'flex-1 rounded-md border-[1.5px] py-3.5 text-center text-base',
                        active
                          ? 'border-primary bg-primary/[0.07] font-semibold text-primary'
                          : 'border-border bg-card',
                      )}
                    >
                      {val ? 'Sim' : 'Não'}
                    </button>
                  );
                })}
              </div>

              {needsChange === true ? (
                <div className="space-y-1.5">
                  <p className="text-sm leading-snug text-muted-foreground">
                    Troco para quanto? (total: {formatCatalogPrice(total)})
                  </p>
                  <Input
                    value={checkout.changeFor}
                    onChange={(e) => setChangeFor(e.target.value)}
                    placeholder="Ex: 50,00"
                    inputMode="decimal"
                    className={cn(
                      checkoutFieldClass,
                      changeInvalid ? 'border-destructive' : 'border-border',
                    )}
                  />
                  {changeInvalid ? (
                    <p className="text-xs text-destructive">
                      O valor do troco deve ser igual ou maior que{' '}
                      {formatCatalogPrice(total)}.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {needsChange === false ? (
                <p className="text-sm leading-snug text-muted-foreground">
                  Tenha o valor exato de {formatCatalogPrice(total)}.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className={checkoutFooterClass}>
            <button
              type="button"
              disabled={!isValid}
              onClick={() => router.push('/checkout/revisao')}
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
