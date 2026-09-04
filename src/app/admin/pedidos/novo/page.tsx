'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import AdminHeader from '@/components/admin/AdminHeader';
import AdminManualOrderItemPicker, {
  type ManualOrderItemDraft,
} from '@/components/admin/AdminManualOrderItemPicker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { ApiError, apiJson } from '@/lib/api';
import { adminFormContainerClass } from '@/lib/layout';
import { adminKeys } from '@/lib/query-keys';
import { cn } from '@/lib/cn';
import type {
  AdminAddon,
  AdminCategory,
  AdminProduct,
} from '@/modules/admin/types';

type CatalogResponse = {
  categories: AdminCategory[];
  products: AdminProduct[];
  addons: AdminAddon[];
};

const manualOrderSchema = z
  .object({
    guestName: z.string().trim().min(1, 'Informe o nome.'),
    guestPhone: z.string().trim().min(8, 'Telefone inválido.'),
    deliveryMethod: z.enum(['pickup', 'delivery']),
    street: z.string().trim().optional(),
    number: z.string().trim().optional(),
    neighborhood: z.string().trim().optional(),
    city: z.string().trim().optional(),
    state: z.string().trim().optional(),
    complement: z.string().trim().optional(),
    referencePoint: z.string().trim().optional(),
    deliveryFeeReais: z.number().min(0),
    timing: z.enum(['immediate', 'scheduled']),
    scheduledFor: z.string().optional(),
    paymentMethod: z.enum(['cash', 'card']),
    alreadyPaid: z.boolean(),
    customerNote: z.string().trim().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.deliveryMethod === 'delivery') {
      const required: Array<[keyof typeof value, string]> = [
        ['street', 'Informe a rua.'],
        ['number', 'Informe o número.'],
        ['neighborhood', 'Informe o bairro.'],
        ['city', 'Informe a cidade.'],
        ['state', 'Informe a UF.'],
      ];
      for (const [field, message] of required) {
        if (!value[field]) {
          ctx.addIssue({ code: 'custom', message, path: [field] });
        }
      }
    }
    if (value.timing === 'scheduled' && !value.scheduledFor) {
      ctx.addIssue({
        code: 'custom',
        message: 'Informe data e hora do agendamento.',
        path: ['scheduledFor'],
      });
    }
  });

type ManualOrderForm = z.infer<typeof manualOrderSchema>;

function reaisToCents(value: number) {
  return Math.round(value * 100);
}

export default function AdminNovaComandaPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated, ready } = useRequireAdmin();
  const [items, setItems] = useState<ManualOrderItemDraft[]>([]);
  const [formError, setFormError] = useState('');

  const catalogQuery = useQuery({
    queryKey: adminKeys.catalog(),
    enabled: ready && isAuthenticated,
    queryFn: () => apiJson<CatalogResponse>('/api/v1/admin/catalog'),
  });
  const products = catalogQuery.data?.products ?? [];
  const addons = catalogQuery.data?.addons ?? [];

  const form = useForm<ManualOrderForm>({
    resolver: zodResolver(manualOrderSchema),
    defaultValues: {
      guestName: '',
      guestPhone: '',
      deliveryMethod: 'pickup',
      street: '',
      number: '',
      neighborhood: '',
      city: '',
      state: '',
      complement: '',
      referencePoint: '',
      deliveryFeeReais: 0,
      timing: 'immediate',
      scheduledFor: '',
      paymentMethod: 'cash',
      alreadyPaid: false,
      customerNote: '',
    },
  });

  const deliveryMethod = useWatch({
    control: form.control,
    name: 'deliveryMethod',
  });
  const timing = useWatch({ control: form.control, name: 'timing' });

  const mutation = useMutation({
    mutationFn: async (values: ManualOrderForm) => {
      const payload = {
        guestName: values.guestName,
        guestPhone: values.guestPhone,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          customerNote: item.customerNote || null,
          addOns: item.addOnIds.map((addOnId) => ({ addOnId, quantity: 1 })),
        })),
        deliveryMethod: values.deliveryMethod,
        timing: values.timing,
        scheduledFor:
          values.timing === 'scheduled' && values.scheduledFor
            ? new Date(values.scheduledFor).toISOString()
            : null,
        address:
          values.deliveryMethod === 'delivery'
            ? {
                street: values.street ?? '',
                number: values.number ?? '',
                neighborhood: values.neighborhood ?? '',
                city: values.city ?? '',
                state: values.state ?? '',
                complement: values.complement || null,
                referencePoint: values.referencePoint || null,
              }
            : null,
        deliveryFeeCents:
          values.deliveryMethod === 'delivery'
            ? reaisToCents(values.deliveryFeeReais)
            : undefined,
        paymentMethod: values.paymentMethod,
        alreadyPaid: values.alreadyPaid,
        customerNote: values.customerNote || null,
      };
      return apiJson<{ order: { id: string } }>('/api/v1/admin/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: [...adminKeys.all, 'orders'],
      });
      router.push(`/admin/pedido/${data.order.id}`);
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError ? error.message : 'Falha ao criar comanda.',
      );
    },
  });

  const onSubmit = (values: ManualOrderForm) => {
    setFormError('');
    if (items.length === 0) {
      setFormError('Adicione ao menos um item.');
      return;
    }
    mutation.mutate(values);
  };

  if (!ready || !isAuthenticated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background lg:pl-52">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background lg:pl-52">
      <AdminHeader title="Nova comanda" backTo="/admin/pedidos" />
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn(
          'space-y-3 p-3 pb-8 md:px-6 md:pt-6',
          adminFormContainerClass,
        )}
      >
        {formError ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {formError}
          </p>
        ) : null}

        <section className="space-y-3 rounded-lg border border-border bg-card p-3.5">
          <h2 className="text-sm font-bold">Cliente</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Label className="block text-xs font-semibold">
              Nome
              <Input
                {...form.register('guestName')}
                className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
              />
              {form.formState.errors.guestName ? (
                <p className="mt-1 text-2xs text-destructive">
                  {form.formState.errors.guestName.message}
                </p>
              ) : null}
            </Label>
            <Label className="block text-xs font-semibold">
              Telefone
              <Input
                {...form.register('guestPhone')}
                placeholder="(88) 99999-9999"
                className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
              />
              {form.formState.errors.guestPhone ? (
                <p className="mt-1 text-2xs text-destructive">
                  {form.formState.errors.guestPhone.message}
                </p>
              ) : null}
            </Label>
          </div>
          <p className="text-2xs text-muted-foreground">
            Se o telefone já pertence a um cliente com conta, o pedido é
            vinculado a ela automaticamente.
          </p>
        </section>

        <section className="space-y-3 rounded-lg border border-border bg-card p-3.5">
          <h2 className="text-sm font-bold">Itens</h2>
          {catalogQuery.isLoading ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : (
            <AdminManualOrderItemPicker
              products={products}
              addons={addons}
              items={items}
              onChange={setItems}
            />
          )}
        </section>

        <section className="space-y-3 rounded-lg border border-border bg-card p-3.5">
          <h2 className="text-sm font-bold">Entrega</h2>
          <div className="flex gap-4 text-xs">
            <Label className="inline-flex items-center gap-2 font-semibold">
              <input
                type="radio"
                value="pickup"
                {...form.register('deliveryMethod')}
              />
              Retirada
            </Label>
            <Label className="inline-flex items-center gap-2 font-semibold">
              <input
                type="radio"
                value="delivery"
                {...form.register('deliveryMethod')}
              />
              Entrega
            </Label>
          </div>
          {deliveryMethod === 'delivery' ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Label className="block text-xs font-semibold">
                  Rua
                  <Input
                    {...form.register('street')}
                    className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
                  />
                </Label>
                <Label className="block text-xs font-semibold">
                  Número
                  <Input
                    {...form.register('number')}
                    className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
                  />
                </Label>
                <Label className="block text-xs font-semibold">
                  Bairro
                  <Input
                    {...form.register('neighborhood')}
                    className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
                  />
                </Label>
                <Label className="block text-xs font-semibold">
                  Cidade
                  <Input
                    {...form.register('city')}
                    className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
                  />
                </Label>
                <Label className="block text-xs font-semibold">
                  UF
                  <Input
                    {...form.register('state')}
                    maxLength={2}
                    className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm uppercase"
                  />
                </Label>
                <Label className="block text-xs font-semibold">
                  Complemento
                  <Input
                    {...form.register('complement')}
                    className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
                  />
                </Label>
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
                    {...form.register('deliveryFeeReais', {
                      valueAsNumber: true,
                    })}
                    className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
                  />
                </Label>
              </div>
              {form.formState.errors.street ||
              form.formState.errors.number ||
              form.formState.errors.neighborhood ||
              form.formState.errors.city ||
              form.formState.errors.state ? (
                <p className="text-2xs text-destructive">
                  Preencha o endereço completo para entrega.
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="space-y-3 rounded-lg border border-border bg-card p-3.5">
          <h2 className="text-sm font-bold">Quando</h2>
          <div className="flex gap-4 text-xs">
            <Label className="inline-flex items-center gap-2 font-semibold">
              <input
                type="radio"
                value="immediate"
                {...form.register('timing')}
              />
              Agora
            </Label>
            <Label className="inline-flex items-center gap-2 font-semibold">
              <input
                type="radio"
                value="scheduled"
                {...form.register('timing')}
              />
              Agendar
            </Label>
          </div>
          {timing === 'scheduled' ? (
            <Label className="block text-xs font-semibold">
              Data e hora
              <Input
                type="datetime-local"
                {...form.register('scheduledFor')}
                className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
              />
              {form.formState.errors.scheduledFor ? (
                <p className="mt-1 text-2xs text-destructive">
                  {form.formState.errors.scheduledFor.message}
                </p>
              ) : null}
            </Label>
          ) : null}
        </section>

        <section className="space-y-3 rounded-lg border border-border bg-card p-3.5">
          <h2 className="text-sm font-bold">Pagamento</h2>
          <div className="flex gap-4 text-xs">
            <Label className="inline-flex items-center gap-2 font-semibold">
              <input
                type="radio"
                value="cash"
                {...form.register('paymentMethod')}
              />
              Dinheiro
            </Label>
            <Label className="inline-flex items-center gap-2 font-semibold">
              <input
                type="radio"
                value="card"
                {...form.register('paymentMethod')}
              />
              Cartão
            </Label>
          </div>
          <Label className="inline-flex items-center gap-2 text-xs font-semibold">
            <input type="checkbox" {...form.register('alreadyPaid')} />
            Já pago
          </Label>
          <Label className="block text-xs font-semibold">
            Observação do pedido (opcional)
            <Input
              {...form.register('customerNote')}
              className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
            />
          </Label>
        </section>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full rounded-lg bg-primary py-3.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {mutation.isPending ? 'Criando…' : 'Criar comanda'}
        </button>
      </form>
    </div>
  );
}
