'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EyeOff, Loader2, Star, ThumbsUp, Undo2 } from 'lucide-react';
import { ApiError, apiJson } from '@/lib/api';
import { adminKeys } from '@/lib/query-keys';
import { cn } from '@/lib/cn';
import type { AdminProductReview, ReviewStatus } from '@/modules/admin/types';

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

export function ProductReviewsList({ status }: { status: ReviewStatus }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: adminKeys.productReviews(status),
    queryFn: () =>
      apiJson<{ reviews: AdminProductReview[] }>(
        `/api/v1/admin/product-reviews?status=${status}`,
      ),
  });

  const mutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: ReviewStatus }) =>
      apiJson(`/api/v1/admin/product-reviews/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.all }),
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
        Nenhuma avaliação de produto{' '}
        {status === 'pending' ? 'pendente' : 'aqui'}.
      </p>
    );
  }

  const act = (id: string, next: ReviewStatus) => mutation.mutate({ id, next });

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
            <span className="truncate text-2xs font-semibold text-muted-foreground">
              {review.productName ?? 'Produto removido'}
            </span>
          </div>

          {review.comment ? (
            <p className="text-sm text-card-foreground">“{review.comment}”</p>
          ) : (
            <p className="text-xs italic text-muted-foreground">
              Sem comentário — só a nota.
            </p>
          )}

          <p className="text-2xs text-muted-foreground">
            {review.customerDisplayName} ·{' '}
            {new Date(review.createdAt).toLocaleDateString('pt-BR')}
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            {review.status !== 'approved' ? (
              <button
                type="button"
                onClick={() => act(review.id, 'approved')}
                disabled={mutation.isPending}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-2xs font-semibold text-white disabled:opacity-60"
              >
                <ThumbsUp className="size-3" />
                Aprovar
              </button>
            ) : null}

            {review.status !== 'hidden' ? (
              <button
                type="button"
                onClick={() => act(review.id, 'hidden')}
                disabled={mutation.isPending}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-2xs font-semibold text-muted-foreground disabled:opacity-60"
              >
                <EyeOff className="size-3" />
                Esconder
              </button>
            ) : null}

            {review.status !== 'pending' ? (
              <button
                type="button"
                onClick={() => act(review.id, 'pending')}
                disabled={mutation.isPending}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-2xs font-semibold text-muted-foreground disabled:opacity-60"
              >
                <Undo2 className="size-3" />
                Voltar p/ pendente
              </button>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
