'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GalleryHorizontal, Loader2, Plus, Trash2, Upload } from 'lucide-react';
import { useAppDialog } from '@/contexts/AppDialogContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, apiJson } from '@/lib/api';
import { adminKeys } from '@/lib/query-keys';
import { cn } from '@/lib/cn';

type AdminBanner = {
  id: string;
  title: string;
  subtitle: string | null;
  linkHref: string | null;
  sortOrder: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  storagePath: string | null;
  imageUrl: string | null;
};

type BannerDraft = {
  title: string;
  subtitle: string;
  linkHref: string;
  sortOrder: string;
};

function draftFrom(banner: AdminBanner): BannerDraft {
  return {
    title: banner.title,
    subtitle: banner.subtitle ?? '',
    linkHref: banner.linkHref ?? '',
    sortOrder: String(banner.sortOrder),
  };
}

function BannerCard({ banner }: { banner: AdminBanner }) {
  const queryClient = useQueryClient();
  const { confirm } = useAppDialog();
  const [draft, setDraft] = useState<BannerDraft>(() => draftFrom(banner));
  const [dirty, setDirty] = useState(false);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: adminKeys.banners() });

  const patchMutation = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      apiJson(`/api/v1/admin/banners/${banner.id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: invalidate,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.set('file', file);
      return apiJson(`/api/v1/admin/banners/${banner.id}/image`, {
        method: 'POST',
        body: form,
      });
    },
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      apiJson(`/api/v1/admin/banners/${banner.id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  const errorMsg =
    patchMutation.error instanceof ApiError
      ? patchMutation.error.message
      : uploadMutation.error instanceof ApiError
        ? uploadMutation.error.message
        : null;

  const saveDraft = () => {
    patchMutation.mutate({
      title: draft.title.trim(),
      subtitle: draft.subtitle.trim() || null,
      linkHref: draft.linkHref.trim() || null,
      sortOrder: Number(draft.sortOrder) || 0,
    });
    setDirty(false);
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Remover banner',
      description: `Remover "${banner.title}" do carrossel?`,
      confirmLabel: 'Remover',
      tone: 'destructive',
    });
    if (ok) deleteMutation.mutate();
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-background p-3">
      <div className="flex gap-3">
        <label
          className={cn(
            'relative flex h-20 w-32 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-muted/40 text-muted-foreground',
            uploadMutation.isPending && 'opacity-60',
          )}
        >
          {banner.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={banner.imageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : uploadMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) uploadMutation.mutate(file);
              event.target.value = '';
            }}
          />
        </label>

        <div className="min-w-0 flex-1 space-y-2">
          <Input
            value={draft.title}
            onChange={(e) => {
              setDraft((d) => ({ ...d, title: e.target.value }));
              setDirty(true);
            }}
            placeholder="Título"
            className="h-8 text-xs"
          />
          <Input
            value={draft.subtitle}
            onChange={(e) => {
              setDraft((d) => ({ ...d, subtitle: e.target.value }));
              setDirty(true);
            }}
            placeholder="Subtítulo (opcional)"
            className="h-8 text-xs"
          />
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Input
          value={draft.linkHref}
          onChange={(e) => {
            setDraft((d) => ({ ...d, linkHref: e.target.value }));
            setDirty(true);
          }}
          placeholder="Link ao tocar (opcional, ex.: /produto/bolo-de-ninho)"
          className="h-8 text-xs"
        />
        <Input
          value={draft.sortOrder}
          onChange={(e) => {
            setDraft((d) => ({ ...d, sortOrder: e.target.value }));
            setDirty(true);
          }}
          inputMode="numeric"
          placeholder="Ordem"
          className="h-8 w-16 text-xs"
        />
      </div>

      {errorMsg ? <p className="text-2xs text-destructive">{errorMsg}</p> : null}

      <div className="flex items-center justify-between gap-2">
        <Label className="inline-flex items-center gap-1.5 text-2xs font-semibold">
          <input
            type="checkbox"
            checked={banner.isActive}
            disabled={!banner.storagePath}
            onChange={(e) =>
              patchMutation.mutate({ isActive: e.target.checked })
            }
          />
          {banner.storagePath ? 'Ativo no carrossel' : 'Envie uma imagem para ativar'}
        </Label>

        <div className="flex items-center gap-2">
          {dirty ? (
            <button
              type="button"
              onClick={saveDraft}
              disabled={patchMutation.isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-2xs font-semibold text-primary-foreground disabled:opacity-60"
            >
              Salvar
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleteMutation.isPending}
            className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-2xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
          >
            <Trash2 className="size-3" />
            Remover
          </button>
        </div>
      </div>
    </div>
  );
}

/** Banners do carrossel da home do client — imagem, título, link opcional. */
export function BannersSection() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: adminKeys.banners(),
    queryFn: () => apiJson<{ banners: AdminBanner[] }>('/api/v1/admin/banners'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiJson('/api/v1/admin/banners', {
        method: 'POST',
        body: JSON.stringify({ title: 'Novo banner' }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: adminKeys.banners() }),
  });

  const banners = query.data?.banners ?? [];

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-3.5">
      <div className="flex items-start gap-2.5">
        <GalleryHorizontal className="mt-0.5 size-4 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Carrossel da home</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Banners promocionais mostrados no topo do cardápio do cliente. Sem
            nenhum ativo, o carrossel mostra o texto padrão da marca.
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
            <BannerCard key={banner.id} banner={banner} />
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
        Novo banner
      </button>
    </section>
  );
}
