'use client';

import { useWatch } from 'react-hook-form';
import {
  useSatelliteLocation,
  type SatelliteHourFormRow,
} from '@/app/configuracoes/useSatelliteLocation';
import { SatelliteLocationInfoForm } from '@/app/configuracoes/_sections/SatelliteLocationInfoForm';
import { SatelliteLocationHoursForm } from '@/app/configuracoes/_sections/SatelliteLocationHoursForm';
import {
  SatelliteDeliverySlotsEditor,
  type SlotDraft,
} from '@/app/configuracoes/_sections/SatelliteDeliverySlotsEditor';
import type { SatelliteDeliverySlot } from '@/modules/catalog/types';

function slotsToDrafts(
  slots: SatelliteDeliverySlot[],
  weekday: number,
): SlotDraft[] {
  return slots
    .filter((slot) => slot.weekday === weekday)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((slot) => ({
      startsAt: slot.startsAt.slice(0, 5),
      endsAt: slot.endsAt?.slice(0, 5) ?? '',
      label: slot.label ?? '',
    }));
}

/** Chave estável que muda só quando os slots salvos desse dia mudam de verdade. */
function slotsKey(drafts: SlotDraft[]): string {
  return drafts.map((slot) => `${slot.startsAt}|${slot.endsAt}|${slot.label}`).join(',');
}

export function SatelliteLocationSection() {
  const {
    location,
    isLoading,
    locationForm,
    hoursForm,
    locationMutation,
    hoursMutation,
    deliverySlotsMutation,
    mutationError,
  } = useSatelliteLocation();

  const hours = useWatch({ control: hoursForm.control, name: 'hours' }) ?? [];

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-3.5 text-xs text-muted-foreground">
        Carregando unidade…
      </div>
    );
  }

  if (!location) {
    return (
      <div className="rounded-lg border border-border bg-card p-3.5 text-xs text-muted-foreground">
        Nenhuma unidade satélite configurada.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {mutationError ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {mutationError}
        </p>
      ) : null}

      <SatelliteLocationInfoForm
        form={locationForm}
        isPending={locationMutation.isPending}
        onSubmit={(values) => locationMutation.mutate(values)}
      />

      <SatelliteLocationHoursForm
        form={hoursForm}
        isPending={hoursMutation.isPending}
        onSubmit={(values) => hoursMutation.mutate(values)}
      />

      <div className="space-y-3 rounded-lg border border-border bg-card p-3.5">
        <p className="text-sm font-semibold">Horários fixos de entrega</p>
        <p className="text-2xs text-muted-foreground">
          Lista curta por dia (ex.: rota do meio-dia + um horário à noite) — não
          é uma grade automática.
        </p>
        <div className="space-y-3">
          {hours
            .filter((hour: SatelliteHourFormRow) => !hour.isClosed)
            .map((hour: SatelliteHourFormRow) => {
              const drafts = slotsToDrafts(location.deliverySlots, hour.weekday);
              return (
                <SatelliteDeliverySlotsEditor
                  key={`${hour.weekday}:${slotsKey(drafts)}`}
                  weekday={hour.weekday}
                  initialSlots={drafts}
                  isPending={deliverySlotsMutation.isPending}
                  onSave={(slots) =>
                    deliverySlotsMutation.mutate({ weekday: hour.weekday, slots })
                  }
                />
              );
            })}
        </div>
      </div>
    </div>
  );
}
