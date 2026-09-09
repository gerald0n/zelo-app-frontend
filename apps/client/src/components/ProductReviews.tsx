'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Star } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { useShopExperience } from '@/contexts/ShopExperienceContext';
import {
  REVIEW_COMMENT_MAX,
  type ProductReviewsView,
} from '@/modules/reviews/types';
import { cn } from '@/lib/utils';

function Stars({
  value,
  size = 'sm',
  onChange,
}: {
  value: number;
  size?: 'sm' | 'lg';
  onChange?: (v: number) => void;
}) {
  const readOnly = !onChange;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
          onClick={() => onChange?.(n)}
          className={cn(
            'p-0.5',
            !readOnly && 'transition-transform hover:scale-110',
          )}
        >
          <Star
            className={cn(
              size === 'lg' ? 'size-7' : 'size-4',
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

type Props = {
  productId: string;
  productName: string;
};

export default function ProductReviews({ productId, productName }: Props) {
  const { notify } = useShopExperience();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const query = useQuery({
    queryKey: ['catalog', 'product-reviews', productId],
    queryFn: () =>
      apiJson<ProductReviewsView>(
        `/api/v1/catalog/products/${productId}/reviews`,
      ),
  });
  const view = query.data ?? null;
  const loading = query.isLoading;

  const submit = async () => {
    if (rating < 1) {
      notify('Escolha de 1 a 5 estrelas.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(
        `/api/v1/catalog/products/${productId}/reviews`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            rating,
            comment: comment.trim() || undefined,
          }),
        },
      );
      const json = await response.json();
      if (!response.ok) {
        notify(json?.error?.message ?? 'Não foi possível enviar.', 'error');
        return;
      }
      notify('Avaliação enviada. Obrigado! 💛');
      setRating(0);
      setComment('');
      void query.refetch();
    } catch {
      notify('Falha de rede ao enviar a avaliação.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !view) {
    return (
      <section className="mt-6 flex justify-center py-6">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </section>
    );
  }
  if (!view) return null;

  const { summary, items, canReview, myReview } = view;

  return (
    <section className="mt-6 space-y-4 border-t border-border pt-5">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold">Avaliações</h2>
        {summary.count > 0 ? (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Star className="size-4 fill-amber-400 text-amber-400" />
            <span className="font-semibold text-foreground">
              {summary.average.toFixed(1)}
            </span>
            ({summary.count})
          </span>
        ) : null}
      </div>

      {myReview ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">Sua avaliação</p>
          <div className="mt-1.5">
            <Stars value={myReview.rating} />
          </div>
          {myReview.comment ? (
            <p className="mt-2 text-sm text-card-foreground">
              “{myReview.comment}”
            </p>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            {myReview.status === 'pending'
              ? 'Recebemos! Vamos revisar antes de publicar. 💛'
              : myReview.status === 'approved'
                ? 'Publicada. Obrigado pelo retorno! 💛'
                : 'Obrigado pelo retorno. 💛'}
          </p>
        </div>
      ) : canReview ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">
            Você já pediu {productName}. Que tal avaliar?
          </p>
          <div className="mt-2">
            <Stars value={rating} size="lg" onChange={setRating} />
          </div>
          <textarea
            value={comment}
            onChange={(e) =>
              setComment(e.target.value.slice(0, REVIEW_COMMENT_MAX))
            }
            placeholder="Conte o que achou (opcional)"
            rows={3}
            className="mt-3 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            className="mt-3 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition-transform active:scale-[0.99] disabled:opacity-60"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Enviar avaliação
          </button>
        </div>
      ) : null}

      {items.length > 0 ? (
        <ul className="space-y-3">
          {items.map((review) => (
            <li
              key={review.id}
              className="rounded-xl border border-border p-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{review.displayName}</p>
                <time className="shrink-0 text-2xs text-muted-foreground">
                  {formatDate(review.createdAt)}
                </time>
              </div>
              <div className="mt-1">
                <Stars value={review.rating} />
              </div>
              {review.comment ? (
                <p className="mt-1.5 text-sm text-card-foreground">
                  {review.comment}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Este produto ainda não tem avaliações.
        </p>
      )}
    </section>
  );
}
