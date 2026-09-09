'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EyeOff, Loader2, Star, ThumbsUp } from 'lucide-react';
import { ApiError, apiJson } from '@/lib/api';
import { adminKeys } from '@/lib/query-keys';
import { cn } from '@/lib/cn';
import type { AdminReview, ReviewStatus } from '@/modules/admin/types';

function Stars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${value} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            'size-3.5',
            n <= value
              ? 'fill-amber-400 text-amber-400'
              : 'fill-transparent text-muted-foreground/30',
          )}
        />
      ))}
    </div>
  );
}

type Patch = { status?: ReviewStatus; isFeatured?: boolean };

export function ReviewsList({ status }: { status: ReviewStatus }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: adminKeys.reviews(status),
    queryFn: () =>
      apiJson<{ reviews: AdminReview[] }>(
        `/api/v1/admin/reviews?status=${status}`,
      ),
  });

  const mutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Patch }) =>
      apiJson(`/api/v1/admin/reviews/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.all }),
      ]);
    },
  });

  const errorMsg =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
        ? 'Falha ao atualizar a avaliação.'
        : null;

  if (query.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const reviews = query.data?.reviews ?? [];
  if (reviews.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Nenhuma avaliação {status === 'pending' ? 'pendente' : 'aqui'}.
      </p>
    );
  }

  const act = (id: string, patch: Patch) => mutation.mutate({ id, patch });

  return (
    <div className="space-y-2.5">
      {errorMsg ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {errorMsg}
        </p>
      ) : null}

      {reviews.map((review) => (
        <article
          key={review.id}
          className="space-y-2 rounded-xl border border-border bg-card p-3.5"
        >
          <div className="flex items-center justify-between gap-2">
            <Stars value={review.rating} />
            {review.isFeatured ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-2xs font-bold text-amber-700">
                Destaque
              </span>
            ) : null}
          </div>

          {review.comment ? (
            <p className="text-sm text-card-foreground">“{review.comment}”</p>
          ) : (
            <p className="text-xs italic text-muted-foreground">
              Sem comentário — só a nota.
            </p>
          )}

          <p className="text-2xs text-muted-foreground">
            {review.orderNumber ? `Pedido #${review.orderNumber} · ` : ''}
            {review.customerDisplayName} ·{' '}
            {new Date(review.createdAt).toLocaleDateString('pt-BR')}
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            {review.status !== 'approved' ? (
              <button
                type="button"
                onClick={() => act(review.id, { status: 'approved' })}
                disabled={mutation.isPending}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-2xs font-semibold text-white disabled:opacity-60"
              >
                <ThumbsUp className="size-3" />
                Aprovar
              </button>
            ) : null}

            {review.status === 'approved' ? (
              <button
                type="button"
                onClick={() =>
                  act(review.id, { isFeatured: !review.isFeatured })
                }
                disabled={mutation.isPending}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-2xs font-semibold disabled:opacity-60',
                  review.isFeatured
                    ? 'border-amber-300 bg-amber-50 text-amber-700'
                    : 'border-border',
                )}
              >
                <Star className="size-3" />
                {review.isFeatured ? 'Tirar destaque' : 'Destacar'}
              </button>
            ) : null}

            {review.status !== 'hidden' ? (
              <button
                type="button"
                onClick={() => act(review.id, { status: 'hidden' })}
                disabled={mutation.isPending}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-2xs font-semibold text-muted-foreground disabled:opacity-60"
              >
                <EyeOff className="size-3" />
                Esconder
              </button>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
