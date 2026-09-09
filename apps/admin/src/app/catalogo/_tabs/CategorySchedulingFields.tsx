'use client';

import type { UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CategoryForm } from '@/app/catalogo/catalog-forms';

const fieldClass =
  'mt-1 h-10 w-full rounded-md border border-border px-3 text-sm';

/** Campos das regras de agendamento de uma categoria (o checkout deriva
 *  dias/horários a partir daqui + do horário de funcionamento). */
export function CategorySchedulingFields({
  form,
}: {
  form: UseFormReturn<CategoryForm>;
}) {
  const { register, formState } = form;
  const hasError =
    formState.errors.schedulingWeekdayEarliest ||
    formState.errors.schedulingWeekendEarliest ||
    formState.errors.schedulingSameDayLeadMinutes ||
    formState.errors.schedulingSlotIntervalMinutes;

  return (
    <>
      <fieldset className="space-y-3 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-semibold">
          Regras de agendamento
        </legend>
        <p className="text-2xs leading-4 text-muted-foreground">
          O checkout deriva os dias e horários a partir daqui + do horário de
          funcionamento. Não há mais lista de horários fixa.
        </p>
        <Label className="inline-flex items-center gap-2 text-xs font-semibold">
          <input type="checkbox" {...register('schedulingAllowSameDay')} />
          Permite pedido para o mesmo dia
        </Label>
        <Label className="block text-xs font-semibold">
          Antecedência p/ liberar hoje (min antes de abrir)
          <Input
            type="number"
            {...register('schedulingSameDayLeadMinutes', {
              valueAsNumber: true,
            })}
            className={fieldClass}
          />
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <Label className="block text-xs font-semibold">
            Horário mínimo (seg–sex)
            <Input
              type="time"
              {...register('schedulingWeekdayEarliest')}
              className={fieldClass}
            />
          </Label>
          <Label className="block text-xs font-semibold">
            Horário mínimo (sáb–dom)
            <Input
              type="time"
              {...register('schedulingWeekendEarliest')}
              className={fieldClass}
            />
          </Label>
        </div>
        <Label className="block text-xs font-semibold">
          Intervalo entre horários (min)
          <Input
            type="number"
            {...register('schedulingSlotIntervalMinutes', {
              valueAsNumber: true,
            })}
            className={fieldClass}
          />
        </Label>
      </fieldset>

      {hasError ? (
        <p className="text-2xs text-destructive">
          Revise as regras de agendamento (horários em HH:MM, minutos dentro do
          limite).
        </p>
      ) : null}
    </>
  );
}
