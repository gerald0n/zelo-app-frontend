'use client';

import { useState } from 'react';
import { Loader2, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { pagePrimaryButtonClass } from '@/lib/layout';
import { useShopExperience } from '@/contexts/ShopExperienceContext';
import { useCatalogStore } from '@/hooks/useStoreOpen';
import type { CustomerOrder } from '@/modules/orders/types';
import { REVIEW_COMMENT_MAX } from '@/modules/reviews/types';

type Props = {
  order: CustomerOrder;
  autoFocus: boolean;
  onSubmitted: () => void;
};

function Stars({
  value,
  onChange,
}: {
  value: number;
  onChange?: (v: number) => void;
}) {
  const readOnly = !onChange;
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
          aria-pressed={value === n}
          onClick={() => onChange?.(n)}
          className={cn(
            'rounded-md p-0.5 transition-transform',
            !readOnly && 'hover:scale-110',
          )}
        >
          <Star
            className={cn(
              'size-7',
              n <= value
                ? 'fill-amber-400 text-amber-400'
                : 'fill-transparent text-muted-foreground/40',
            )}
          />
        </button>
      ))}
    </div>
  );
}

function useOrderProducts(order: CustomerOrder) {
  const products: Array<{ productId: string; name: string }> = [];
  const seen = new Set<string>();
  for (const item of order.items) {
    if (!item.productId || seen.has(item.productId)) continue;
    seen.add(item.productId);
    products.push({ productId: item.productId, name: item.name });
  }
  return products;
}

export function ReviewInvite({ order, autoFocus, onSubmitted }: Props) {
  const { notify } = useShopExperience();
  const { data: storeData } = useCatalogStore();
  const storeName = storeData?.store?.name ?? 'Zelo Confeitaria';
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const products = useOrderProducts(order);
  // Só guarda os ajustes individuais explícitos do cliente; produtos sem
  // ajuste usam a nota geral do pedido como padrão.
  const [productOverrides, setProductOverrides] = useState<
    Record<string, number>
  >({});

  if (order.review) {
    const pending = order.review.status === 'pending';
    return (
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-serif text-lg font-semibold text-foreground">
          Sua avaliação
        </h2>
        <div className="mt-2">
          <Stars value={order.review.rating} />
        </div>
        {order.review.comment ? (
          <p className="mt-2 text-sm text-card-foreground">
            “{order.review.comment}”
          </p>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">
          {pending
            ? 'Recebemos! Vamos revisar antes de publicar. Obrigado pelo retorno. 💛'
            : 'Obrigado pelo retorno. 💛'}
        </p>
      </section>
    );
  }

  if (!order.canReview) return null;

  const submit = async () => {
    if (rating < 1) {
      notify('Escolha de 1 a 5 estrelas.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const productRatings = products.map((product) => ({
        productId: product.productId,
        rating: productOverrides[product.productId] ?? rating,
      }));
      const response = await fetch(`/api/v1/orders/${order.id}/review`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          rating,
          comment: comment.trim() || undefined,
          productRatings,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        setSubmitting(false);
        notify(json?.error?.message ?? 'Não foi possível enviar.', 'error');
        return;
      }
      notify('Avaliação enviada. Obrigado! 💛');
      onSubmitted();
    } catch {
      setSubmitting(false);
      notify('Falha de rede ao enviar a avaliação.', 'error');
    }
  };

  return (
    <section
      className={cn(
        'rounded-xl border border-border bg-card p-4',
        autoFocus && 'ring-2 ring-primary/40',
      )}
    >
      <h2 className="font-serif text-lg font-semibold text-foreground">
        Como foi o seu pedido?
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Sua opinião ajuda a {storeName} e outros clientes.
      </p>

      <div className="mt-3">
        <Stars value={rating} onChange={setRating} />
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value.slice(0, REVIEW_COMMENT_MAX))}
        placeholder="Conte como foi (opcional)"
        rows={3}
        className="mt-3 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />

      {products.length > 1 ? (
        <div className="mt-4 space-y-2 border-t border-border pt-3">
          <p className="text-sm font-medium text-foreground">
            Quer avaliar os itens separadamente?
          </p>
          <ul className="space-y-2">
            {products.map((product) => (
              <li
                key={product.productId}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-sm text-muted-foreground">
                  {product.name}
                </span>
                <Stars
                  value={productOverrides[product.productId] ?? rating}
                  onChange={(value) =>
                    setProductOverrides((prev) => ({
                      ...prev,
                      [product.productId]: value,
                    }))
                  }
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={submitting}
        className={cn(pagePrimaryButtonClass, 'mt-3 gap-2')}
      >
        {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
        Enviar avaliação
      </button>
    </section>
  );
}
