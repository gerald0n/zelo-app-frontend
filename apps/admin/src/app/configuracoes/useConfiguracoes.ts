'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { ApiError, apiJson } from '@/lib/api';
import { adminKeys } from '@/lib/query-keys';
import {
  blackoutSchema,
  fromLocalInputValue,
  storeSchema,
  type BlackoutForm,
  type HourFormRow,
  type StoreForm as StoreFormValues,
} from '@/app/configuracoes/configuracoes-forms';
import type {
  AdminAuditLog,
  AdminBlackout,
  AdminBusinessHourInput,
} from '@/modules/admin/types';
import type { CatalogStore } from '@/modules/catalog/types';

const CATALOG_STORE_KEY = ['catalog', 'store'] as const;

/** Toda a carga de dados, formulários e mutations da tela de configurações. */
export function useConfiguracoes() {
  const queryClient = useQueryClient();
  const { isAuthenticated, ready, logout, admin } = useRequireAdmin();
  const enabled = ready && isAuthenticated;

  const storeQuery = useQuery({
    queryKey: adminKeys.store(),
    enabled,
    queryFn: () =>
      apiJson<{ store: CatalogStore | null; acceptingOrders: boolean }>(
        '/api/v1/admin/store',
      ),
  });

  const hoursQuery = useQuery({
    queryKey: adminKeys.hours(),
    enabled,
    queryFn: () =>
      apiJson<{ hours: AdminBusinessHourInput[] }>(
        '/api/v1/admin/business-hours',
      ),
  });

  const blackoutsQuery = useQuery({
    queryKey: adminKeys.blackouts(),
    enabled,
    queryFn: () =>
      apiJson<{ blackouts: AdminBlackout[] }>('/api/v1/admin/blackouts'),
  });

  const auditQuery = useQuery({
    queryKey: adminKeys.audit(),
    enabled,
    queryFn: () =>
      apiJson<{ logs: AdminAuditLog[] }>('/api/v1/admin/audit-logs?limit=20'),
  });

  const storeForm = useForm<StoreFormValues>({
    resolver: zodResolver(storeSchema),
    defaultValues: {
      name: '',
      phoneE164: '',
      whatsappE164: '',
      addressLine: '',
      city: '',
      state: 'CE',
      postalCode: '',
      cnpj: '',
      latitude: 0,
      longitude: 0,
      freeDeliveryRadiusMeters: 1000,
      maxDeliveryRadiusMeters: 3000,
      fixedDeliveryFeeReais: 5,
      acceptingOrders: true,
      acceptsPix: true,
      acceptsCash: true,
      acceptsCard: true,
    },
  });

  const hoursForm = useForm<{ hours: HourFormRow[] }>({
    defaultValues: { hours: [] },
  });

  const blackoutForm = useForm<BlackoutForm>({
    resolver: zodResolver(blackoutSchema),
    defaultValues: { startsAt: '', endsAt: '', reason: '' },
  });

  const serverSlotTimes = storeQuery.data?.store?.scheduleSlotTimes;
  const [slotTimes, setSlotTimes] = useState<string[]>([]);
  const [seededFrom, setSeededFrom] = useState<string[] | undefined>(undefined);
  if (serverSlotTimes && serverSlotTimes !== seededFrom) {
    setSeededFrom(serverSlotTimes);
    setSlotTimes(serverSlotTimes);
  }
  const slotsDirty =
    JSON.stringify(slotTimes) !== JSON.stringify(serverSlotTimes ?? []);

  useEffect(() => {
    const store = storeQuery.data?.store;
    if (!store) return;
    storeForm.reset({
      name: store.name,
      cnpj: store.cnpj ?? '',
      phoneE164: store.phoneE164,
      whatsappE164: store.whatsappE164,
      addressLine: store.addressLine,
      city: store.city,
      state: store.state,
      postalCode: store.postalCode ?? '',
      latitude: store.latitude,
      longitude: store.longitude,
      freeDeliveryRadiusMeters: store.freeDeliveryRadiusMeters,
      maxDeliveryRadiusMeters: store.maxDeliveryRadiusMeters,
      fixedDeliveryFeeReais: store.fixedDeliveryFeeCents / 100,
      acceptingOrders: storeQuery.data?.acceptingOrders ?? true,
      acceptsPix: store.acceptsPayments.pix,
      acceptsCash: store.acceptsPayments.cash,
      acceptsCard: store.acceptsPayments.card,
    });
  }, [storeQuery.data, storeForm]);

  useEffect(() => {
    const hours = hoursQuery.data?.hours;
    if (!hours?.length) return;
    hoursForm.reset({
      hours: Array.from({ length: 7 }, (_, weekday) => {
        const found = hours.find((item) => item.weekday === weekday);
        return {
          weekday,
          opensAt: found?.opensAt?.slice(0, 5) ?? '08:00',
          closesAt: found?.closesAt?.slice(0, 5) ?? '18:00',
          isClosed: found?.isClosed ?? true,
          deliveryEnabled: found?.deliveryEnabled ?? true,
          pickupEnabled: found?.pickupEnabled ?? true,
        };
      }),
    });
  }, [hoursQuery.data, hoursForm]);

  const invalidateStore = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.store() }),
      queryClient.invalidateQueries({ queryKey: adminKeys.audit() }),
      queryClient.invalidateQueries({ queryKey: CATALOG_STORE_KEY }),
    ]);

  const storeMutation = useMutation({
    mutationFn: (values: StoreFormValues) =>
      apiJson('/api/v1/admin/store', {
        method: 'PATCH',
        body: JSON.stringify({
          name: values.name,
          cnpj: values.cnpj?.trim() || null,
          phoneE164: values.phoneE164,
          whatsappE164: values.whatsappE164,
          addressLine: values.addressLine,
          city: values.city,
          state: values.state.toUpperCase(),
          postalCode: values.postalCode || null,
          latitude: values.latitude,
          longitude: values.longitude,
          freeDeliveryRadiusMeters: values.freeDeliveryRadiusMeters,
          maxDeliveryRadiusMeters: values.maxDeliveryRadiusMeters,
          fixedDeliveryFeeCents: Math.round(values.fixedDeliveryFeeReais * 100),
          acceptingOrders: values.acceptingOrders,
          acceptsPix: values.acceptsPix,
          acceptsCash: values.acceptsCash,
          acceptsCard: values.acceptsCard,
        }),
      }),
    onSuccess: invalidateStore,
  });

  const hoursMutation = useMutation({
    mutationFn: (values: { hours: HourFormRow[] }) =>
      apiJson('/api/v1/admin/business-hours', {
        method: 'PUT',
        body: JSON.stringify({
          hours: values.hours.map((hour) => ({
            weekday: hour.weekday,
            opensAt: hour.isClosed ? null : `${hour.opensAt}:00`,
            closesAt: hour.isClosed ? null : `${hour.closesAt}:00`,
            isClosed: hour.isClosed,
            deliveryEnabled: hour.deliveryEnabled,
            pickupEnabled: hour.pickupEnabled,
          })),
        }),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.hours() }),
        invalidateStore(),
      ]);
    },
  });

  const slotsMutation = useMutation({
    mutationFn: (times: string[]) =>
      apiJson('/api/v1/admin/store', {
        method: 'PATCH',
        body: JSON.stringify({ scheduleSlotTimes: times }),
      }),
    onSuccess: invalidateStore,
  });

  const blackoutMutation = useMutation({
    mutationFn: (values: BlackoutForm) =>
      apiJson('/api/v1/admin/blackouts', {
        method: 'POST',
        body: JSON.stringify({
          startsAt: fromLocalInputValue(values.startsAt),
          endsAt: fromLocalInputValue(values.endsAt),
          reason: values.reason || null,
        }),
      }),
    onSuccess: async () => {
      blackoutForm.reset();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.blackouts() }),
        queryClient.invalidateQueries({ queryKey: adminKeys.audit() }),
      ]);
    },
  });

  const deleteBlackoutMutation = useMutation({
    mutationFn: (id: string) =>
      apiJson(`/api/v1/admin/blackouts/${id}`, { method: 'DELETE' }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: adminKeys.blackouts() }),
  });

  const mutationError =
    [slotsMutation, storeMutation, hoursMutation, blackoutMutation]
      .map((m) => (m.error instanceof ApiError ? m.error.message : ''))
      .find(Boolean) ?? '';

  return {
    ready,
    isAuthenticated,
    admin,
    logout,
    storeForm,
    hoursForm,
    blackoutForm,
    slotTimes,
    setSlotTimes,
    slotsDirty,
    blackouts: blackoutsQuery.data?.blackouts ?? [],
    auditLogs: auditQuery.data?.logs ?? [],
    storeMutation,
    hoursMutation,
    slotsMutation,
    blackoutMutation,
    deleteBlackoutMutation,
    mutationError,
  };
}
