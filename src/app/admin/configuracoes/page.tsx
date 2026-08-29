'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Loader2, LogOut, Plus, Trash2 } from 'lucide-react';
import AdminHeader from '@/components/admin/AdminHeader';
import { ADMIN_MIN_PASSWORD_LENGTH } from '@/config/admin';
import { useAppDialog } from '@/contexts/AppDialogContext';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, apiJson } from '@/lib/api';
import { WEEKDAY_LABELS } from '@/lib/constants';
import { cn } from '@/lib/cn';
import { adminKeys } from '@/lib/query-keys';
import type {
  AdminAuditLog,
  AdminBlackout,
  AdminBusinessHourInput,
} from '@/modules/admin/types';
import type { CatalogStore } from '@/modules/catalog/types';

const storeSchema = z
  .object({
    name: z.string().trim().min(1, 'Informe o nome.'),
    phoneE164: z.string().trim().min(8, 'Telefone inválido.'),
    whatsappE164: z.string().trim().min(8, 'WhatsApp inválido.'),
    pixCopyPaste: z.string().optional(),
    addressLine: z.string().trim().min(1, 'Informe o endereço.'),
    city: z.string().trim().min(1),
    state: z.string().trim().length(2, 'Use a UF com 2 letras.'),
    postalCode: z.string().optional(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    freeDeliveryRadiusMeters: z.number().int().min(0),
    fixedDeliveryFeeReais: z.number().min(0),
    acceptingOrders: z.boolean(),
    acceptsPix: z.boolean(),
    acceptsCash: z.boolean(),
    acceptsCard: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (!value.acceptsPix && !value.acceptsCash && !value.acceptsCard) {
      ctx.addIssue({
        code: 'custom',
        message: 'Mantenha ao menos uma forma de pagamento habilitada.',
        path: ['acceptsPix'],
      });
    }
  });

const blackoutSchema = z.object({
  startsAt: z.string().min(1, 'Informe o início.'),
  endsAt: z.string().min(1, 'Informe o fim.'),
  reason: z.string().optional(),
});

type StoreForm = z.infer<typeof storeSchema>;
type BlackoutForm = z.infer<typeof blackoutSchema>;
type HourFormRow = {
  weekday: number;
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
};

function toLocalInputValue(iso: string) {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInputValue(value: string) {
  return new Date(value).toISOString();
}

export default function AdminConfiguracoesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated, ready, logout, admin } = useRequireAdmin();
  const { confirm } = useAppDialog();
  const { isTablet } = useResponsiveLayout();

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

  const storeForm = useForm<StoreForm>({
    resolver: zodResolver(storeSchema),
    defaultValues: {
      name: '',
      phoneE164: '',
      whatsappE164: '',
      pixCopyPaste: '',
      addressLine: '',
      city: '',
      state: 'CE',
      postalCode: '',
      latitude: 0,
      longitude: 0,
      freeDeliveryRadiusMeters: 2000,
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

  useEffect(() => {
    const store = storeQuery.data?.store;
    if (!store) return;
    storeForm.reset({
      name: store.name,
      phoneE164: store.phoneE164,
      whatsappE164: store.whatsappE164,
      pixCopyPaste: store.pixCopyPaste ?? '',
      addressLine: store.addressLine,
      city: store.city,
      state: store.state,
      postalCode: store.postalCode ?? '',
      latitude: store.latitude,
      longitude: store.longitude,
      freeDeliveryRadiusMeters: store.freeDeliveryRadiusMeters,
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
      hours: [...Array.from({ length: 7 }, (_, weekday) => {
        const found = hours.find((item) => item.weekday === weekday);
        return {
          weekday,
          opensAt: found?.opensAt?.slice(0, 5) ?? '08:00',
          closesAt: found?.closesAt?.slice(0, 5) ?? '18:00',
          isClosed: found?.isClosed ?? true,
          deliveryEnabled: found?.deliveryEnabled ?? true,
          pickupEnabled: found?.pickupEnabled ?? true,
        };
      })],
    });
  }, [hoursQuery.data, hoursForm]);

  const storeMutation = useMutation({
    mutationFn: (values: StoreForm) =>
      apiJson('/api/v1/admin/store', {
        method: 'PATCH',
        body: JSON.stringify({
          name: values.name,
          phoneE164: values.phoneE164,
          whatsappE164: values.whatsappE164,
          pixCopyPaste: values.pixCopyPaste || null,
          addressLine: values.addressLine,
          city: values.city,
          state: values.state.toUpperCase(),
          postalCode: values.postalCode || null,
          latitude: values.latitude,
          longitude: values.longitude,
          freeDeliveryRadiusMeters: values.freeDeliveryRadiusMeters,
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
        queryClient.invalidateQueries({ queryKey: ['catalog', 'store'] }),
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
        queryClient.invalidateQueries({ queryKey: ['catalog', 'store'] }),
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

  const hours =
    useWatch({ control: hoursForm.control, name: 'hours' }) ?? [];
  const mutationError =
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
          'space-y-5 p-3.5 pb-8',
          isTablet && 'mx-auto w-full max-w-[760px] p-4',
        )}
      >
        {mutationError ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {mutationError}
          </p>
        ) : null}

        <form
          onSubmit={storeForm.handleSubmit((values) =>
            storeMutation.mutate(values),
          )}
          className="space-y-3 rounded-[11px] border border-border bg-card p-3.5"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Dados da loja</p>
            <Label className="inline-flex items-center gap-2 text-xs font-semibold">
              <input
                type="checkbox"
                {...storeForm.register('acceptingOrders')}
              />
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
                  <input type="checkbox" {...storeForm.register(field)} />
                  {label}
                </Label>
              ))}
            </div>
            {storeForm.formState.errors.acceptsPix?.message ? (
              <p className="mt-2 text-[11px] text-destructive">
                {storeForm.formState.errors.acceptsPix.message}
              </p>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ['name', 'Nome'],
                ['phoneE164', 'Telefone'],
                ['whatsappE164', 'WhatsApp'],
                ['pixCopyPaste', 'Pix copia e cola'],
                ['addressLine', 'Endereço'],
                ['city', 'Cidade'],
                ['state', 'UF'],
                ['postalCode', 'CEP'],
                ['latitude', 'Latitude'],
                ['longitude', 'Longitude'],
                ['freeDeliveryRadiusMeters', 'Raio grátis (m)'],
                ['fixedDeliveryFeeReais', 'Taxa fixa (R$)'],
              ] as const
            ).map(([field, label]) => {
              const numeric = [
                'latitude',
                'longitude',
                'freeDeliveryRadiusMeters',
                'fixedDeliveryFeeReais',
              ].includes(field);
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
                    {...storeForm.register(field, {
                      valueAsNumber: numeric,
                    })}
                    className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
                  />
                </Label>
              );
            })}
          </div>
          <button
            type="submit"
            disabled={storeMutation.isPending}
            className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {storeMutation.isPending ? 'Salvando…' : 'Salvar loja'}
          </button>
        </form>

        <form
          onSubmit={hoursForm.handleSubmit((values) =>
            hoursMutation.mutate(values),
          )}
          className="space-y-3 rounded-[11px] border border-border bg-card p-3.5"
        >
          <p className="text-sm font-semibold">Horários de funcionamento</p>
          <div className="space-y-2">
            {hours.map((hour, index) => (
              <div
                key={hour.weekday}
                className="grid gap-2 rounded-md border border-border p-2.5 sm:grid-cols-[1fr_auto_auto_auto]"
              >
                <p className="text-xs font-semibold">
                  {WEEKDAY_LABELS[hour.weekday]}
                </p>
                <Label className="inline-flex items-center gap-1.5 text-[11px]">
                  <input
                    type="checkbox"
                    checked={hour.isClosed}
                    onChange={(event) =>
                      hoursForm.setValue(
                        `hours.${index}.isClosed`,
                        event.target.checked,
                      )
                    }
                  />
                  Fechado
                </Label>
                <Input
                  type="time"
                  disabled={hour.isClosed}
                  value={hour.opensAt}
                  onChange={(event) =>
                    hoursForm.setValue(
                      `hours.${index}.opensAt`,
                      event.target.value,
                    )
                  }
                  className="h-8 rounded-md border border-border px-2 text-xs disabled:opacity-50"
                />
                <Input
                  type="time"
                  disabled={hour.isClosed}
                  value={hour.closesAt}
                  onChange={(event) =>
                    hoursForm.setValue(
                      `hours.${index}.closesAt`,
                      event.target.value,
                    )
                  }
                  className="h-8 rounded-md border border-border px-2 text-xs disabled:opacity-50"
                />
              </div>
            ))}
          </div>
          <button
            type="submit"
            disabled={hoursMutation.isPending}
            className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {hoursMutation.isPending ? 'Salvando…' : 'Salvar horários'}
          </button>
        </form>

        <section className="space-y-3 rounded-[11px] border border-border bg-card p-3.5">
          <p className="text-sm font-semibold">Períodos bloqueados</p>
          <form
            onSubmit={blackoutForm.handleSubmit((values) =>
              blackoutMutation.mutate(values),
            )}
            className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
          >
            <Input
              type="datetime-local"
              {...blackoutForm.register('startsAt')}
              className="h-10 rounded-md border border-border px-3 text-sm"
            />
            <Input
              type="datetime-local"
              {...blackoutForm.register('endsAt')}
              className="h-10 rounded-md border border-border px-3 text-sm"
            />
            <Input
              placeholder="Motivo"
              {...blackoutForm.register('reason')}
              className="h-10 rounded-md border border-border px-3 text-sm"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white"
            >
              <Plus className="size-3.5" />
              Add
            </button>
          </form>
          <div className="space-y-2">
            {(blackoutsQuery.data?.blackouts ?? []).map((blackout) => (
              <div
                key={blackout.id}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2"
              >
                <div className="min-w-0 flex-1 text-[11px] text-muted-foreground">
                  <p className="font-semibold text-foreground">
                    {blackout.reason || 'Bloqueio'}
                  </p>
                  <p>
                    {toLocalInputValue(blackout.startsAt).replace('T', ' ')} →{' '}
                    {toLocalInputValue(blackout.endsAt).replace('T', ' ')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteBlackoutMutation.mutate(blackout.id)}
                  className="rounded-md border border-border p-1.5 text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
            {(blackoutsQuery.data?.blackouts ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum período bloqueado.
              </p>
            ) : null}
          </div>
        </section>

        <section className="space-y-2 rounded-[11px] border border-border bg-card p-3.5">
          <p className="text-sm font-semibold">Auditoria recente</p>
          {(auditQuery.data?.logs ?? []).map((log) => (
            <div
              key={log.id}
              className="border-t border-border py-2 first:border-t-0 first:pt-0"
            >
              <p className="text-xs font-semibold">{log.action}</p>
              <p className="text-[11px] text-muted-foreground">
                {log.entityType}
                {log.entityId ? ` · ${log.entityId.slice(0, 8)}` : ''} ·{' '}
                {new Date(log.createdAt).toLocaleString('pt-BR')}
              </p>
            </div>
          ))}
          {(auditQuery.data?.logs ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem eventos ainda.</p>
          ) : null}
        </section>

        <p className="text-[11px] text-muted-foreground">
          Sessão: {admin?.displayName} ({admin?.email})
        </p>

        <AdminPasswordForm />

        <button
          type="button"
          onClick={async () => {
            const ok = await confirm({
              title: 'Encerrar sessão',
              description: 'Deseja encerrar a sessão administrativa?',
              confirmLabel: 'Sair',
              tone: 'destructive',
            });
            if (!ok) return;
            await logout();
            router.replace('/admin/login');
          }}
          className="flex w-full items-center justify-center gap-2 rounded-[9px] border border-border py-3 text-sm font-semibold text-destructive"
        >
          <LogOut className="size-4" />
          Sair do painel
        </button>
      </div>
    </div>
  );
}

function AdminPasswordForm() {
  const { alert } = useAppDialog();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= ADMIN_MIN_PASSWORD_LENGTH &&
    !saving;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError('');
    try {
      await apiJson<{ ok: true }>('/api/v1/admin/session/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      await alert({
        title: 'Senha atualizada',
        description: 'A nova senha já vale para o próximo acesso.',
      });
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Não foi possível alterar a senha.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-2.5 rounded-[11px] border border-border bg-card p-3.5">
      <p className="text-sm font-semibold">Alterar senha</p>
      <p className="text-[12px] leading-4 text-muted-foreground">
        Troque a senha inicial antes de publicar o painel.
      </p>
      <div>
        <Label className="mb-1 block text-[11px] font-semibold">
          Senha atual
        </Label>
        <Input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="h-10"
        />
      </div>
      <div>
        <Label className="mb-1 block text-[11px] font-semibold">
          Nova senha
        </Label>
        <Input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="h-10"
        />
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => void submit()}
        className="flex h-10 w-full items-center justify-center rounded-[9px] bg-primary text-sm font-semibold text-white disabled:opacity-60"
      >
        {saving ? <Loader2 className="size-4 animate-spin" /> : 'Salvar senha'}
      </button>
    </section>
  );
}
