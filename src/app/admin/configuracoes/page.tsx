'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import AdminHeader from '@/components/admin/AdminHeader';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { ApiError, apiJson } from '@/lib/api';
import { adminFormContainerClass } from '@/lib/layout';
import { cn } from '@/lib/cn';
import { adminKeys } from '@/lib/query-keys';
import {
  blackoutSchema,
  fromLocalInputValue,
  storeSchema,
  type BlackoutForm,
  type HourFormRow,
  type StoreForm as StoreFormValues,
} from '@/app/admin/configuracoes/configuracoes-forms';
import { AdminPasswordForm } from '@/app/admin/configuracoes/_sections/AdminPasswordForm';
import { AuditLogSection } from '@/app/admin/configuracoes/_sections/AuditLogSection';
import { BlackoutsSection } from '@/app/admin/configuracoes/_sections/BlackoutsSection';
import { LogoutButton } from '@/app/admin/configuracoes/_sections/LogoutButton';
import { BusinessHoursForm } from '@/app/admin/configuracoes/_sections/BusinessHoursForm';
import { PrinterSection } from '@/app/admin/configuracoes/_sections/PrinterSection';
import { SlotTimesSection } from '@/app/admin/configuracoes/_sections/SlotTimesSection';
import { StoreForm } from '@/app/admin/configuracoes/_sections/StoreForm';
import type {
  AdminAuditLog,
  AdminBlackout,
  AdminBusinessHourInput,
} from '@/modules/admin/types';
import type { CatalogStore } from '@/modules/catalog/types';

const CATALOG_STORE_KEY = ['catalog', 'store'] as const;

export default function AdminConfiguracoesPage() {
  const queryClient = useQueryClient();
  const { isAuthenticated, ready, logout, admin } = useRequireAdmin();

  const storeQuery = useQuery({
    queryKey: adminKeys.store(),
    enabled: ready && isAuthenticated,
    queryFn: () =>
      apiJson<{ store: CatalogStore | null; acceptingOrders: boolean }>(
        '/api/v1/admin/store',
      ),
  });

  const hoursQuery = useQuery({
    queryKey: adminKeys.hours(),
    enabled: ready && isAuthenticated,
    queryFn: () =>
      apiJson<{ hours: AdminBusinessHourInput[] }>(
        '/api/v1/admin/business-hours',
      ),
  });

  const blackoutsQuery = useQuery({
    queryKey: adminKeys.blackouts(),
    enabled: ready && isAuthenticated,
    queryFn: () =>
      apiJson<{ blackouts: AdminBlackout[] }>('/api/v1/admin/blackouts'),
  });

  const auditQuery = useQuery({
    queryKey: adminKeys.audit(),
    enabled: ready && isAuthenticated,
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
  // Re-semeia a lista editável sempre que a query traz uma referência nova
  // (carga inicial ou refetch pós-save). Ajuste de estado no render, não em
  // effect.
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
      hours: [
        ...Array.from({ length: 7 }, (_, weekday) => {
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
      ],
    });
  }, [hoursQuery.data, hoursForm]);

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
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.store() }),
        queryClient.invalidateQueries({ queryKey: adminKeys.audit() }),
        queryClient.invalidateQueries({ queryKey: CATALOG_STORE_KEY }),
      ]);
    },
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
        queryClient.invalidateQueries({ queryKey: adminKeys.store() }),
        queryClient.invalidateQueries({ queryKey: adminKeys.audit() }),
        queryClient.invalidateQueries({ queryKey: CATALOG_STORE_KEY }),
      ]);
    },
  });

  const slotsMutation = useMutation({
    mutationFn: (times: string[]) =>
      apiJson('/api/v1/admin/store', {
        method: 'PATCH',
        body: JSON.stringify({ scheduleSlotTimes: times }),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.store() }),
        queryClient.invalidateQueries({ queryKey: adminKeys.audit() }),
        queryClient.invalidateQueries({ queryKey: CATALOG_STORE_KEY }),
      ]);
    },
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.blackouts() });
    },
  });

  const mutationError =
    (slotsMutation.error instanceof ApiError && slotsMutation.error.message) ||
    (storeMutation.error instanceof ApiError && storeMutation.error.message) ||
    (hoursMutation.error instanceof ApiError && hoursMutation.error.message) ||
    (blackoutMutation.error instanceof ApiError &&
      blackoutMutation.error.message) ||
    '';

  if (!ready || !isAuthenticated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background lg:pl-52">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background lg:pl-52">
      <AdminHeader title="Configurações" subtitle="Loja, horários e auditoria" />
      <div
        className={cn(
          'space-y-5 p-3.5 pb-8 md:px-6 md:pt-6',
          adminFormContainerClass,
        )}
      >
        {mutationError ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {mutationError}
          </p>
        ) : null}

        <StoreForm
          form={storeForm}
          isPending={storeMutation.isPending}
          onSubmit={(values) => storeMutation.mutate(values)}
        />

        <PrinterSection />

        <BusinessHoursForm
          form={hoursForm}
          isPending={hoursMutation.isPending}
          onSubmit={(values) => hoursMutation.mutate(values)}
        />

        <SlotTimesSection
          slotTimes={slotTimes}
          setSlotTimes={setSlotTimes}
          dirty={slotsDirty}
          isPending={slotsMutation.isPending}
          onSave={(times) => slotsMutation.mutate(times)}
        />

        <BlackoutsSection
          form={blackoutForm}
          blackouts={blackoutsQuery.data?.blackouts ?? []}
          onCreate={(values) => blackoutMutation.mutate(values)}
          onDelete={(id) => deleteBlackoutMutation.mutate(id)}
        />

        <AuditLogSection logs={auditQuery.data?.logs ?? []} />

        <p className="text-2xs text-muted-foreground">
          Sessão: {admin?.displayName} ({admin?.email})
        </p>

        <AdminPasswordForm />

        <LogoutButton logout={logout} />
      </div>
    </div>
  );
}
