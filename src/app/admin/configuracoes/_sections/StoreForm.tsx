'use client';

import type { UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export function StoreForm({ form, isPending, onSubmit }: Props) {
  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-3 rounded-lg border border-border bg-card p-3.5"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Dados da loja</p>
        <Label className="inline-flex items-center gap-2 text-xs font-semibold">
          <input type="checkbox" {...form.register('acceptingOrders')} />
          Receber pedidos
        </Label>
      </div>
      <div className="rounded-md border border-border bg-muted/40 p-2.5">
        <p className="mb-2 text-xs font-semibold">Formas de pagamento</p>
        <div className="flex flex-wrap gap-3">
          {(
            [
              ['acceptsPix', 'Pix'],
              ['acceptsCash', 'Dinheiro'],
              ['acceptsCard', 'Cartão'],
            ] as const
          ).map(([field, label]) => (
            <Label
              key={field}
              className="inline-flex items-center gap-2 text-xs font-semibold"
            >
              <input type="checkbox" {...form.register(field)} />
              {label}
            </Label>
          ))}
        </div>
        {form.formState.errors.acceptsPix?.message ? (
          <p className="mt-2 text-2xs text-destructive">
            {form.formState.errors.acceptsPix.message}
          </p>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ['name', 'Nome'],
            ['cnpj', 'CNPJ (MEI)'],
            ['phoneE164', 'Telefone'],
            ['whatsappE164', 'WhatsApp'],
            ['addressLine', 'Endereço'],
            ['city', 'Cidade'],
            ['state', 'UF'],
            ['postalCode', 'CEP'],
            ['latitude', 'Latitude'],
            ['longitude', 'Longitude'],
            ['freeDeliveryRadiusMeters', 'Raio grátis (m)'],
            ['maxDeliveryRadiusMeters', 'Raio máx. de entrega (m)'],
            ['fixedDeliveryFeeReais', 'Taxa fixa (R$)'],
          ] as const
        ).map(([field, label]) => {
          const numeric = (NUMERIC_FIELDS as readonly string[]).includes(field);
          return (
            <Label key={field} className="block text-xs font-semibold">
              {label}
              <Input
                type={numeric ? 'number' : 'text'}
                step={
                  field === 'fixedDeliveryFeeReais' ||
                  field === 'latitude' ||
                  field === 'longitude'
                    ? 'any'
                    : undefined
                }
                {...form.register(field, { valueAsNumber: numeric })}
                className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
              />
            </Label>
          );
        })}
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white transition-[background-color,transform] duration-100 hover:bg-primary/90 active:scale-[0.97] disabled:active:scale-100 disabled:opacity-60"
      >
        {isPending ? 'Salvando…' : 'Salvar loja'}
      </button>
    </form>
  );
}
