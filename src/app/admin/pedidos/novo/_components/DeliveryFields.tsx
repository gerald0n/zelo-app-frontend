'use client';

import type { UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ManualOrderForm } from '@/app/admin/pedidos/novo/nova-comanda-form';

const TEXT_FIELDS: Array<[keyof ManualOrderForm, string, string | undefined]> = [
  ['street', 'Rua', undefined],
  ['number', 'Número', undefined],
  ['neighborhood', 'Bairro', undefined],
  ['city', 'Cidade', undefined],
  ['state', 'UF', 'uppercase'],
  ['complement', 'Complemento', undefined],
];

export function DeliveryFields({
  form,
}: {
  form: UseFormReturn<ManualOrderForm>;
}) {
  const e = form.formState.errors;
  const hasAddressError =
    e.street || e.number || e.neighborhood || e.city || e.state;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {TEXT_FIELDS.map(([field, label, extra]) => (
          <Label key={field} className="block text-xs font-semibold">
            {label}
            <Input
              {...form.register(field)}
              maxLength={field === 'state' ? 2 : undefined}
              className={`mt-1 h-10 w-full rounded-md border border-border px-3 text-sm${
                extra ? ` ${extra}` : ''
              }`}
            />
          </Label>
        ))}
        <Label className="block text-xs font-semibold sm:col-span-2">
          Ponto de referência
          <Input
            {...form.register('referencePoint')}
            className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
          />
        </Label>
        <Label className="block text-xs font-semibold">
          Taxa de entrega (R$)
          <Input
            type="number"
            step="0.01"
            min={0}
            {...form.register('deliveryFeeReais', { valueAsNumber: true })}
            className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
          />
        </Label>
      </div>
      {hasAddressError ? (
        <p className="text-2xs text-destructive">
          Preencha o endereço completo para entrega.
        </p>
      ) : null}
    </div>
  );
}
