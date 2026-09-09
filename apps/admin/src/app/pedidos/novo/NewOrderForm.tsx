'use client';

import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Loader2, Pencil, Save } from 'lucide-react';
import AdminManualOrderItemPicker, {
  type ManualOrderItemDraft,
} from '@/components/admin/AdminManualOrderItemPicker';
import { useAdmin } from '@/contexts/AdminContext';
import { ApiError, apiJson } from '@/lib/api';
import { adminKeys } from '@/lib/query-keys';
import { formatCatalogPrice } from '@/modules/catalog/types';
import {
  buildManualOrderPayload,
  draftSubtotalCents,
  manualOrderSchema,
  type CatalogResponse,
  type ManualOrderForm,
} from '@/app/pedidos/novo/nova-comanda-form';
import { NewOrderStepper } from '@/app/pedidos/novo/NewOrderStepper';
import {
  IdentificationFields,
  PaymentFields,
} from '@/app/pedidos/novo/NewOrderFields';

type Props = {
  enabled?: boolean;
  onCreated: (orderId: string) => void;
  onCancel: () => void;
};

type Draft = { values: ManualOrderForm; items: ManualOrderItemDraft[] };
const DRAFT_KEY = 'zelo:comanda-draft';

const DEFAULTS: ManualOrderForm = {
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
  source: 'balcao',
  customerNote: '',
  couponCode: '',
};

function readDraft(): Draft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

const ghostBtn =
  'flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold transition-colors hover:bg-accent';
const primaryBtn =
  'flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60';

export function NewOrderForm({ enabled = true, onCreated, onCancel }: Props) {
  const queryClient = useQueryClient();
  const { admin } = useAdmin();
  const draft = useMemo(() => readDraft(), []);
  const openedAt = useMemo(() => new Date(), []);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [items, setItems] = useState<ManualOrderItemDraft[]>(
    () => draft?.items ?? [],
  );
  const [formError, setFormError] = useState('');

  const catalogQuery = useQuery({
    queryKey: adminKeys.catalog(),
    enabled,
    queryFn: () => apiJson<CatalogResponse>('/api/v1/admin/catalog'),
  });
  const products = catalogQuery.data?.products ?? [];
  const addons = catalogQuery.data?.addons ?? [];

  const form = useForm<ManualOrderForm>({
    resolver: zodResolver(manualOrderSchema),
    defaultValues: draft?.values ?? DEFAULTS,
  });
  const [deliveryMethod, timing, paymentMethod, guestName, guestPhone] =
    useWatch({
      control: form.control,
      name: [
        'deliveryMethod',
        'timing',
        'paymentMethod',
        'guestName',
        'guestPhone',
      ],
    });

  const mutation = useMutation({
    mutationFn: (values: ManualOrderForm) =>
      apiJson<{ order: { id: string } }>('/api/v1/admin/orders', {
        method: 'POST',
        body: JSON.stringify(buildManualOrderPayload(values, items)),
      }),
    onSuccess: async (data) => {
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        // ignore
      }
      await queryClient.invalidateQueries({
        queryKey: [...adminKeys.all, 'orders'],
      });
      onCreated(data.order.id);
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError ? error.message : 'Falha ao criar comanda.',
      );
    },
  });

  const subtotalCents = draftSubtotalCents(items, products, addons);

  const handleNext = form.handleSubmit(
    (values) => {
      setFormError('');
      if (step === 1) {
        setStep(2);
        return;
      }
      if (step === 2) {
        if (items.length === 0) {
          setFormError('Adicione ao menos um item à comanda.');
          return;
        }
        setStep(3);
        return;
      }
      mutation.mutate(values);
    },
    () => {
      if (step > 1) setStep(1);
    },
  );

  const saveDraft = () => {
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ values: form.getValues(), items }),
      );
    } catch {
      // ignore
    }
    onCancel();
  };

  const addQuick = (productId: string) =>
    setItems((prev) => [
      ...prev,
      { productId, quantity: 1, customerNote: '', addOnIds: [] },
    ]);

  const shortcuts = products
    .filter((p) => p.isActive && p.stockQuantity !== 0)
    .slice(0, 4);
  const modeBadge = `${deliveryMethod === 'delivery' ? 'Entrega' : 'Balcão'} / ${
    timing === 'immediate' ? 'Imediato' : 'Agendado'
  }`;

  return (
    <form onSubmit={handleNext} className="space-y-3 p-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-serif text-lg font-bold">Nova comanda</h2>
          <span className="rounded-full bg-tone-warning px-2 py-0.5 text-2xs font-semibold text-tone-warning-foreground">
            Em preenchimento
          </span>
          <span className="rounded-full bg-tone-info/15 px-2 py-0.5 text-2xs font-semibold text-tone-info-foreground">
            {modeBadge}
          </span>
        </div>
        <p className="text-2xs text-muted-foreground">
          Abertura:{' '}
          {openedAt.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
          {admin?.displayName ? ` · Atendente: ${admin.displayName}` : ''}
        </p>
      </div>

      <NewOrderStepper current={step} />

      {formError ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {formError}
        </p>
      ) : null}

      {step > 1 ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {guestName || 'Cliente'}{' '}
              <span className="text-2xs font-normal text-muted-foreground">
                {guestPhone}
              </span>
            </p>
            <p className="text-2xs text-muted-foreground">
              {deliveryMethod === 'delivery' ? 'Entrega' : 'Retirada no balcão'}{' '}
              ({timing === 'immediate' ? 'Imediato' : 'Agendado'}) ·{' '}
              {paymentMethod === 'card' ? 'Cartão' : 'Dinheiro'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary"
          >
            <Pencil className="size-3" />
            Editar
          </button>
        </div>
      ) : null}

      {step === 1 ? <IdentificationFields form={form} /> : null}

      {step === 2 ? (
        <section className="space-y-3 rounded-xl border border-border bg-card p-3.5">
          <div className="flex items-center justify-between">
            <p className="text-2xs font-bold uppercase tracking-wide text-muted-foreground">
              Itens do pedido
            </p>
            <span className="text-2xs text-muted-foreground">
              {items.length} {items.length === 1 ? 'item' : 'itens'}
            </span>
          </div>
          {shortcuts.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-2xs font-semibold text-muted-foreground">
                Atalhos:
              </span>
              {shortcuts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addQuick(product.id)}
                  className="rounded-full border border-border px-2.5 py-1 text-2xs font-semibold transition-colors hover:bg-accent"
                >
                  + {product.name}
                </button>
              ))}
            </div>
          ) : null}
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
      ) : null}

      {step === 3 ? (
        <div className="space-y-3">
          <PaymentFields form={form} />
          <div className="space-y-1 rounded-xl border border-border bg-card p-3.5 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal ({items.length} itens)</span>
              <span>{formatCatalogPrice(subtotalCents)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1.5 text-sm font-bold">
              <span>Total previsto</span>
              <span className="text-primary">
                {formatCatalogPrice(subtotalCents)}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
            className={ghostBtn}
          >
            <ArrowLeft className="size-3.5" />
            Voltar
          </button>
        ) : null}
        <button type="button" onClick={saveDraft} className={ghostBtn}>
          <Save className="size-3.5" />
          Salvar rascunho
        </button>
        {step >= 2 ? (
          <span className="mx-1 text-2xs font-semibold text-muted-foreground">
            Subtotal {formatCatalogPrice(subtotalCents)}
          </span>
        ) : null}
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={onCancel} className={ghostBtn}>
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className={primaryBtn}
          >
            {step === 1
              ? 'Avançar para itens'
              : step === 2
                ? 'Avançar para pagamento'
                : mutation.isPending
                  ? 'Criando…'
                  : 'Criar comanda'}
            {step < 3 ? <ArrowRight className="size-3.5" /> : null}
          </button>
        </div>
      </div>
    </form>
  );
}
