'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { ApiError, apiJson } from '@/lib/api';
import { adminKeys } from '@/lib/query-keys';
import type { SatelliteLocation } from '@/modules/catalog/types';

export type SatelliteLocationForm = {
  name: string;
  addressLine: string;
  city: string;
  state: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  freeDeliveryRadiusMeters: number;
  fixedDeliveryFeeReais: number;
  maxDeliveryRadiusMeters: number;
  minLeadMinutes: number;
  isActive: boolean;
};

export type SatelliteHourFormRow = {
  weekday: number;
  isClosed: boolean;
  pickupOpensAt: string;
  pickupClosesAt: string;
  deliveryEnabled: boolean;
};

/** Config do local satélite (São Miguel/RN): dados, horários e slots de entrega. */
export function useSatelliteLocation() {
  const queryClient = useQueryClient();
  const { isAuthenticated, ready } = useRequireAdmin();
  const enabled = ready && isAuthenticated;

  const locationQuery = useQuery({
    queryKey: adminKeys.satelliteLocation(),
    enabled,
    queryFn: () =>
      apiJson<{ location: SatelliteLocation | null }>(
        '/api/v1/admin/satellite-location',
      ),
  });

  const location = locationQuery.data?.location ?? null;

  const locationForm = useForm<SatelliteLocationForm>({
    defaultValues: {
      name: '',
      addressLine: '',
      city: '',
      state: 'RN',
      postalCode: '',
      latitude: 0,
      longitude: 0,
      freeDeliveryRadiusMeters: 0,
      fixedDeliveryFeeReais: 0,
      maxDeliveryRadiusMeters: 0,
      minLeadMinutes: 120,
      isActive: true,
    },
  });

  const hoursForm = useForm<{ hours: SatelliteHourFormRow[] }>({
    defaultValues: { hours: [] },
  });

  useEffect(() => {
    if (!location) return;
    locationForm.reset({
      name: location.name,
      addressLine: location.addressLine,
      city: location.city,
      state: location.state,
      postalCode: location.postalCode ?? '',
      latitude: location.latitude,
      longitude: location.longitude,
      freeDeliveryRadiusMeters: location.freeDeliveryRadiusMeters,
      fixedDeliveryFeeReais: location.fixedDeliveryFeeCents / 100,
      maxDeliveryRadiusMeters: location.maxDeliveryRadiusMeters,
      minLeadMinutes: location.minLeadMinutes,
      isActive: location.isActive,
    });
    hoursForm.reset({
      hours: Array.from({ length: 7 }, (_, weekday) => {
        const found = location.hours.find((item) => item.weekday === weekday);
        return {
          weekday,
          isClosed: found?.isClosed ?? true,
          pickupOpensAt: found?.pickupOpensAt?.slice(0, 5) ?? '08:00',
          pickupClosesAt: found?.pickupClosesAt?.slice(0, 5) ?? '18:00',
          deliveryEnabled: found?.deliveryEnabled ?? false,
        };
      }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: adminKeys.satelliteLocation() });

  const locationMutation = useMutation({
    mutationFn: (values: SatelliteLocationForm) =>
      apiJson('/api/v1/admin/satellite-location', {
        method: 'PATCH',
        body: JSON.stringify({
          name: values.name,
          addressLine: values.addressLine,
          city: values.city,
          state: values.state.toUpperCase(),
          postalCode: values.postalCode || null,
          latitude: values.latitude,
          longitude: values.longitude,
          freeDeliveryRadiusMeters: values.freeDeliveryRadiusMeters,
          fixedDeliveryFeeCents: Math.round(values.fixedDeliveryFeeReais * 100),
          maxDeliveryRadiusMeters: values.maxDeliveryRadiusMeters,
          minLeadMinutes: values.minLeadMinutes,
          isActive: values.isActive,
        }),
      }),
    onSuccess: invalidate,
  });

  const hoursMutation = useMutation({
    mutationFn: (values: { hours: SatelliteHourFormRow[] }) =>
      apiJson('/api/v1/admin/satellite-location/hours', {
        method: 'PUT',
        body: JSON.stringify({
          hours: values.hours.map((hour) => ({
            weekday: hour.weekday,
            isClosed: hour.isClosed,
            pickupOpensAt: hour.isClosed ? null : `${hour.pickupOpensAt}:00`,
            pickupClosesAt: hour.isClosed ? null : `${hour.pickupClosesAt}:00`,
            deliveryEnabled: hour.deliveryEnabled,
          })),
        }),
      }),
    onSuccess: invalidate,
  });

  const deliverySlotsMutation = useMutation({
    mutationFn: (values: {
      weekday: number;
      slots: Array<{ startsAt: string; endsAt: string | null; label: string | null }>;
    }) =>
      apiJson('/api/v1/admin/satellite-location/delivery-slots', {
        method: 'PUT',
        body: JSON.stringify({
          weekday: values.weekday,
          slots: values.slots.map((slot, index) => ({
            startsAt: `${slot.startsAt}:00`,
            endsAt: slot.endsAt ? `${slot.endsAt}:00` : null,
            label: slot.label,
            sortOrder: index,
          })),
        }),
      }),
    onSuccess: invalidate,
  });

  const mutationError =
    [locationMutation, hoursMutation, deliverySlotsMutation]
      .map((m) => (m.error instanceof ApiError ? m.error.message : ''))
      .find(Boolean) ?? '';

  return {
    location,
    isLoading: locationQuery.isLoading,
    locationForm,
    hoursForm,
    locationMutation,
    hoursMutation,
    deliverySlotsMutation,
    mutationError,
  };
}
