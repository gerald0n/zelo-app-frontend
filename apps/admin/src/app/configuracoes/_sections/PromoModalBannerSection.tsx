'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, SquareStack } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { adminKeys } from '@/lib/query-keys';
import {
  PromoModalBannerCard,
  type AdminPromoModalBanner,
} from './PromoModalBannerCard';

/** Banner modal (popup 1x por sessão) mostrado ao abrir o app do client. */
export function PromoModalBannerSection() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: adminKeys.promoModalBanners(),
    queryFn: () =>
      apiJson<{ banners: AdminPromoModalBanner[] }>(
        '/api/v1/admin/promo-modal-banners',
      ),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiJson('/api/v1/admin/promo-modal-banners', {
        method: 'POST',
        body: JSON.stringify({ title: 'Nova campanha' }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: adminKeys.promoModalBanners() }),
  });

  const banners = query.data?.banners ?? [];

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-3.5">
      <div className="flex items-start gap-2.5">
        <SquareStack className="mt-0.5 size-4 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Banner modal (popup)</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Popup mostrado 1x por sessão ao abrir o app. Sem nenhuma campanha
            ativa dentro da vigência, o app mostra a arte padrão.
          </p>
        </div>
      </div>

      {query.isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2.5">
          {banners.map((banner) => (
            <PromoModalBannerCard key={banner.id} banner={banner} />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => createMutation.mutate()}
        disabled={createMutation.isPending}
        className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-xs font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
      >
        {createMutation.isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Plus className="size-3.5" />
        )}
        Nova campanha
      </button>
    </section>
  );
}
