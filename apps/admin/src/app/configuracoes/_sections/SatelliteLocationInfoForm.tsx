'use client';

import type { UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SatelliteLocationForm } from '@/app/configuracoes/useSatelliteLocation';

const NUMERIC_FIELDS = [
  'latitude',
  'longitude',
  'freeDeliveryRadiusMeters',
  'maxDeliveryRadiusMeters',
  'fixedDeliveryFeeReais',
  'minLeadMinutes',
] as const;

const FIELDS: Array<[keyof SatelliteLocationForm, string]> = [
  ['name', 'Nome da unidade'],
  ['addressLine', 'Endereço completo'],
  ['city', 'Cidade'],
  ['state', 'UF'],
  ['postalCode', 'CEP'],
  ['latitude', 'Latitude (GPS)'],
  ['longitude', 'Longitude (GPS)'],
  ['freeDeliveryRadiusMeters', 'Raio de entrega grátis (m)'],
  ['maxDeliveryRadiusMeters', 'Raio máximo de entrega (m)'],
  ['fixedDeliveryFeeReais', 'Taxa de entrega fixa (R$)'],
  ['minLeadMinutes', 'Antecedência mínima (min)'],
];

type Props = {
  form: UseFormReturn<SatelliteLocationForm>;
  isPending: boolean;
  onSubmit: (values: SatelliteLocationForm) => void;
};

export function SatelliteLocationInfoForm({ form, isPending, onSubmit }: Props) {
  const isActive = form.watch('isActive');

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-4 rounded-xl border border-border bg-card p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-serif text-base font-bold">
            <span className="size-1.5 rounded-full bg-primary" />
            São Miguel/RN — dados & entrega
          </p>
          <p className="mt-0.5 text-2xs text-muted-foreground">
            Endereço de retirada, raio/taxa de entrega e antecedência mínima
            desta unidade — independentes de Pereiro.
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-2xs font-semibold">
          <span className="hidden sm:inline">Unidade ativa</span>
          <input
            type="checkbox"
            className="sr-only"
            checked={isActive}
            onChange={(event) => form.setValue('isActive', event.target.checked)}
          />
          <span
            className={`relative h-5 w-9 rounded-full transition-colors ${
              isActive ? 'bg-primary' : 'bg-muted'
            }`}
          >
            <span
              className={`absolute top-0.5 size-4 rounded-full bg-white transition-transform ${
                isActive ? 'translate-x-[18px]' : 'translate-x-0.5'
              }`}
            />
          </span>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map(([field, label]) => (
          <Label key={field} className="block text-xs font-semibold">
            {label}
            <Input
              type={
                (NUMERIC_FIELDS as readonly string[]).includes(field)
                  ? 'number'
                  : 'text'
              }
              step={
                field === 'latitude' || field === 'longitude'
                  ? 'any'
                  : field === 'fixedDeliveryFeeReais'
                    ? '0.01'
                    : undefined
              }
              {...form.register(field, {
                valueAsNumber: (NUMERIC_FIELDS as readonly string[]).includes(
                  field,
                ),
              })}
              className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
            />
          </Label>
        ))}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white transition-[background-color,transform] duration-100 hover:bg-primary/90 active:scale-[0.97] disabled:active:scale-100 disabled:opacity-60"
      >
        {isPending ? 'Salvando…' : 'Salvar dados'}
      </button>
    </form>
  );
}
