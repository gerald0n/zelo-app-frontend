'use client';

import { useEffect } from 'react';
import { type UseFormReturn, useWatch } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ManualOrderForm } from '@/app/pedidos/novo/nova-comanda-form';
import { DeliveryFields } from '@/app/pedidos/novo/_components/DeliveryFields';
import {
  ManualOrderCouponField,
  type AppliedManualOrderCoupon,
} from '@/app/pedidos/novo/_components/ManualOrderCouponField';

type FieldProps = { form: UseFormReturn<ManualOrderForm> };

const card = 'space-y-3 rounded-xl border border-border bg-card p-3.5';
const field =
  'mt-1 h-10 w-full rounded-md border border-border bg-card px-3 text-sm';
const heading =
  'text-2xs font-bold uppercase tracking-wide text-muted-foreground';

function ErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span className="mt-1 block text-2xs text-destructive">{message}</span>
  );
}

/** Passo 1 — cliente, modalidade de entrega e canal de origem. */
export function IdentificationFields({ form }: FieldProps) {
  const deliveryMethod = useWatch({
    control: form.control,
    name: 'deliveryMethod',
  });
  const timing = useWatch({ control: form.control, name: 'timing' });
  const noGuestPhone = useWatch({
    control: form.control,
    name: 'noGuestPhone',
  });
  const e = form.formState.errors;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <section className={card}>
        <p className={heading}>Cliente</p>
        <Label className="block text-xs font-semibold">
          Nome do cliente
          <Input {...form.register('guestName')} className={field} />
          <ErrorText message={e.guestName?.message} />
        </Label>
        <Label className="block text-xs font-semibold">
          Telefone / WhatsApp
          <Input
            {...form.register('guestPhone')}
            placeholder="(88) 99999-9999"
            disabled={noGuestPhone}
            className={field}
          />
          <ErrorText message={e.guestPhone?.message} />
        </Label>
        <Label className="inline-flex items-center gap-2 text-xs font-semibold">
          <input type="checkbox" {...form.register('noGuestPhone')} />
          Cliente não informou telefone
        </Label>
        {!noGuestPhone ? (
          <p className="text-2xs text-muted-foreground">
            Se o telefone já tem conta, o pedido é vinculado a ela.
          </p>
        ) : null}
      </section>

      <section className={card}>
        <p className={heading}>Modalidade & canal</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-semibold">
            Tipo de entrega
            <select {...form.register('deliveryMethod')} className={field}>
              <option value="pickup">Retirada no balcão</option>
              <option value="delivery">Entrega</option>
            </select>
          </label>
          <label className="block text-xs font-semibold">
            Quando
            <select {...form.register('timing')} className={field}>
              <option value="immediate">Imediato</option>
              <option value="scheduled">Agendar</option>
            </select>
          </label>
          <label className="col-span-2 block text-xs font-semibold">
            Canal de origem
            <select {...form.register('source')} className={field}>
              <option value="balcao">Balcão presencial</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
            </select>
          </label>
        </div>
        {timing === 'scheduled' ? (
          <Label className="block text-xs font-semibold">
            Data e hora
            <Input
              type="datetime-local"
              {...form.register('scheduledFor')}
              className={field}
            />
            <ErrorText message={e.scheduledFor?.message} />
          </Label>
        ) : null}
        {deliveryMethod === 'delivery' ? <DeliveryFields form={form} /> : null}
      </section>
    </div>
  );
}

type PaymentFieldsProps = FieldProps & {
  subtotalCents: number;
  deliveryFeeCents: number;
  productIds: string[];
  appliedCoupon: AppliedManualOrderCoupon | null;
  onCouponChange: (coupon: AppliedManualOrderCoupon | null) => void;
};

/** Passo 3 — forma de pagamento, cupom e observação. */
export function PaymentFields({
  form,
  subtotalCents,
  deliveryFeeCents,
  productIds,
  appliedCoupon,
  onCouponChange,
}: PaymentFieldsProps) {
  const paymentMethod = useWatch({ control: form.control, name: 'paymentMethod' });
  const isPixManual = paymentMethod === 'pix_manual';

  // Pix confirmado manualmente é por definição já pago — não existe
  // versão "pendente" dele na comanda manual.
  useEffect(() => {
    if (isPixManual) form.setValue('alreadyPaid', true);
  }, [isPixManual, form]);

  return (
    <section className={card}>
      <p className={heading}>Pagamento</p>
      <label className="block text-xs font-semibold">
        Forma de pagamento
        <select {...form.register('paymentMethod')} className={field}>
          <option value="cash">Dinheiro</option>
          <option value="card">Cartão</option>
          <option value="pix_manual">Pix (confirmado)</option>
        </select>
      </label>
      <Label className="inline-flex items-center gap-2 text-xs font-semibold">
        <input
          type="checkbox"
          disabled={isPixManual}
          {...form.register('alreadyPaid')}
        />
        Pagamento já confirmado
      </Label>
      {isPixManual ? (
        <p className="text-2xs text-muted-foreground">
          Pix confirmado manualmente já entra como pago.
        </p>
      ) : null}
      <ManualOrderCouponField
        subtotalCents={subtotalCents}
        deliveryFeeCents={deliveryFeeCents}
        productIds={productIds}
        applied={appliedCoupon}
        onChange={onCouponChange}
      />
      <Label className="block text-xs font-semibold">
        Observação da comanda (opcional)
        <Input {...form.register('customerNote')} className={field} />
      </Label>
    </section>
  );
}
