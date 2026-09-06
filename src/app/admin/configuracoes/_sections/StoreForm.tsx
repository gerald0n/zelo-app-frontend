'use client';

import type { UseFormReturn, Path } from 'react-hook-form';
import { Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import type { StoreForm as StoreFormValues } from '@/app/admin/configuracoes/configuracoes-forms';

type Props = {
  form: UseFormReturn<StoreFormValues>;
  isPending: boolean;
  onSubmit: (values: StoreFormValues) => void;
};

const NUMERIC_FIELDS = [
  'latitude',
  'longitude',
  'freeDeliveryRadiusMeters',
  'maxDeliveryRadiusMeters',
  'fixedDeliveryFeeReais',
] as const;

const PAYMENTS = [
  { field: 'acceptsPix', label: 'Pix', hint: 'Aprovação imediata' },
  { field: 'acceptsCash', label: 'Dinheiro', hint: 'Troco na entrega' },
  { field: 'acceptsCard', label: 'Cartão', hint: 'Maquininha na entrega' },
] as const;

const FIELDS: Array<[keyof StoreFormValues, string]> = [
  ['name', 'Nome do estabelecimento'],
  ['cnpj', 'CNPJ (opcional)'],
  ['phoneE164', 'Telefone de contato'],
  ['whatsappE164', 'WhatsApp para notificações'],
  ['addressLine', 'Endereço completo'],
  ['city', 'Cidade'],
  ['state', 'UF'],
  ['postalCode', 'CEP'],
  ['latitude', 'Latitude (GPS)'],
  ['longitude', 'Longitude (GPS)'],
  ['freeDeliveryRadiusMeters', 'Raio de entrega grátis (m)'],
  ['maxDeliveryRadiusMeters', 'Raio máximo de entrega (m)'],
  ['fixedDeliveryFeeReais', 'Taxa de entrega fixa (R$)'],
];

export function StoreForm({ form, isPending, onSubmit }: Props) {
  const accepting = form.watch('acceptingOrders');

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-4 rounded-xl border border-border bg-card p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-serif text-base font-bold">
            <span className="size-1.5 rounded-full bg-primary" />
            Dados da loja & meios de pagamento
          </p>
          <p className="mt-0.5 text-2xs text-muted-foreground">
            Informações cadastrais, geolocalização e formas de pagamento aceitas
            no cardápio.
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-2xs font-semibold">
          <span className="hidden sm:inline">Receber pedidos online</span>
          <input
            type="checkbox"
            className="sr-only"
            {...form.register('acceptingOrders')}
          />
          <span
            aria-hidden
            className={cn(
              'relative h-6 w-11 rounded-full transition-colors',
              accepting ? 'bg-primary' : 'bg-muted',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 size-5 rounded-full bg-white transition-transform',
                accepting ? 'left-5' : 'left-0.5',
              )}
            />
          </span>
        </label>
      </div>

      <div>
        <p className="mb-2 text-2xs font-bold uppercase tracking-wide text-muted-foreground">
          Formas de pagamento aceitas na finalização
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {PAYMENTS.map(({ field, label, hint }) => {
            const on = form.watch(field);
            return (
              <label
                key={field}
                className={cn(
                  'flex cursor-pointer items-start gap-2 rounded-lg border p-3 transition-colors',
                  on
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-accent',
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  {...form.register(field)}
                />
                <span
                  className={cn(
                    'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border',
                    on
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border',
                  )}
                >
                  {on ? <Check className="size-3" /> : null}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold">{label}</span>
                  <span className="block text-2xs text-muted-foreground">
                    {hint}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        {form.formState.errors.acceptsPix?.message ? (
          <p className="mt-2 text-2xs text-destructive">
            {form.formState.errors.acceptsPix.message}
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map(([field, label]) => {
          const numeric = (NUMERIC_FIELDS as readonly string[]).includes(field);
          const stepAny =
            field === 'fixedDeliveryFeeReais' ||
            field === 'latitude' ||
            field === 'longitude';
          return (
            <label key={field} className="block text-xs font-semibold">
              {label}
              <Input
                type={numeric ? 'number' : 'text'}
                step={stepAny ? 'any' : undefined}
                {...form.register(field as Path<StoreFormValues>, {
                  valueAsNumber: numeric,
                })}
                className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
              />
            </label>
          );
        })}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        {isPending ? 'Salvando…' : 'Salvar dados da loja'}
      </button>
    </form>
  );
}
