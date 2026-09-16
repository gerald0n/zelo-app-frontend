'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Trash2, Upload } from 'lucide-react';
import { useAppDialog } from '@/contexts/AppDialogContext';
import { ImageCropDialog } from '@/components/ImageCropDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, apiJson } from '@/lib/api';
import { adminKeys } from '@/lib/query-keys';
import { cn } from '@/lib/cn';

/** Mesma proporção do resize no servidor (uploadPromoModalBannerImage). */
const VERTICAL_ASPECT = 941 / 1672;
const HORIZONTAL_ASPECT = 1672 / 941;

export type AdminPromoModalBanner = {
  id: string;
  title: string | null;
  linkHref: string | null;
  sortOrder: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  storagePathVertical: string | null;
  storagePathHorizontal: string | null;
  imageUrlVertical: string | null;
  imageUrlHorizontal: string | null;
};

type BannerDraft = {
  title: string;
  linkHref: string;
  sortOrder: string;
  startsAt: string;
  endsAt: string;
};

/** `datetime-local` não aceita segundos/timezone do ISO — corta pro minuto. */
function toDatetimeLocal(iso: string | null): string {
  return iso ? iso.slice(0, 16) : '';
}

function fromDatetimeLocal(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

function draftFrom(banner: AdminPromoModalBanner): BannerDraft {
  return {
    title: banner.title ?? '',
    linkHref: banner.linkHref ?? '',
    sortOrder: String(banner.sortOrder),
    startsAt: toDatetimeLocal(banner.startsAt),
    endsAt: toDatetimeLocal(banner.endsAt),
  };
}

function ImageSlot({
  label,
  aspect,
  ratioLabel,
  imageUrl,
  pending,
  onFileSelected,
}: {
  label: string;
  aspect: number;
  ratioLabel: string;
  imageUrl: string | null;
  pending: boolean;
  onFileSelected: (file: File) => void;
}) {
  return (
    <label
      className={cn(
        'relative flex h-24 w-full cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-md border border-dashed border-border bg-muted/40 text-muted-foreground',
        pending && 'opacity-60',
      )}
      style={{ aspectRatio: aspect }}
      title={`Proporção recomendada: ${ratioLabel}`}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="h-full w-full object-cover" />
      ) : pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <>
          <Upload className="size-4" />
          <span className="text-2xs">{label}</span>
        </>
      )}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFileSelected(file);
          event.target.value = '';
        }}
      />
    </label>
  );
}

export function PromoModalBannerCard({
  banner,
}: {
  banner: AdminPromoModalBanner;
}) {
  const queryClient = useQueryClient();
  const { confirm } = useAppDialog();
  const [draft, setDraft] = useState<BannerDraft>(() => draftFrom(banner));
  const [dirty, setDirty] = useState(false);
  const [cropFile, setCropFile] = useState<{
    file: File;
    variant: 'vertical' | 'horizontal';
  } | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: adminKeys.promoModalBanners() });

  const patchMutation = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      apiJson(`/api/v1/admin/promo-modal-banners/${banner.id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: invalidate,
  });

  const uploadMutation = useMutation({
    mutationFn: ({
      file,
      variant,
    }: {
      file: File;
      variant: 'vertical' | 'horizontal';
    }) => {
      const form = new FormData();
      form.set('file', file);
      form.set('variant', variant);
      return apiJson(`/api/v1/admin/promo-modal-banners/${banner.id}/image`, {
        method: 'POST',
        body: form,
      });
    },
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      apiJson(`/api/v1/admin/promo-modal-banners/${banner.id}`, {
        method: 'DELETE',
      }),
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
      title: draft.title.trim() || null,
      linkHref: draft.linkHref.trim() || null,
      sortOrder: Number(draft.sortOrder) || 0,
      startsAt: fromDatetimeLocal(draft.startsAt),
      endsAt: fromDatetimeLocal(draft.endsAt),
    });
    setDirty(false);
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Remover campanha',
      description: banner.title
        ? `Remover "${banner.title}" do banner modal?`
        : 'Remover este banner modal?',
      confirmLabel: 'Remover',
      tone: 'destructive',
    });
    if (ok) deleteMutation.mutate();
  };

  const bothImagesSet = banner.storagePathVertical && banner.storagePathHorizontal;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-background p-3">
      <Input
        value={draft.title}
        onChange={(e) => {
          setDraft((d) => ({ ...d, title: e.target.value }));
          setDirty(true);
        }}
        placeholder="Título (rótulo interno)"
        className="h-8 text-xs"
      />

      <div className="grid grid-cols-2 gap-2.5">
        <ImageSlot
          label="Vertical (mobile)"
          aspect={VERTICAL_ASPECT}
          ratioLabel="9:16"
          imageUrl={banner.imageUrlVertical}
          pending={uploadMutation.isPending && cropFile?.variant === 'vertical'}
          onFileSelected={(file) => setCropFile({ file, variant: 'vertical' })}
        />
        <ImageSlot
          label="Horizontal (desktop)"
          aspect={HORIZONTAL_ASPECT}
          ratioLabel="16:9"
          imageUrl={banner.imageUrlHorizontal}
          pending={uploadMutation.isPending && cropFile?.variant === 'horizontal'}
          onFileSelected={(file) => setCropFile({ file, variant: 'horizontal' })}
        />
      </div>

      <ImageCropDialog
        open={cropFile != null}
        file={cropFile?.file ?? null}
        aspect={cropFile?.variant === 'horizontal' ? HORIZONTAL_ASPECT : VERTICAL_ASPECT}
        title={
          cropFile?.variant === 'horizontal'
            ? 'Recortar imagem horizontal'
            : 'Recortar imagem vertical'
        }
        onCancel={() => setCropFile(null)}
        onConfirm={async (croppedFile) => {
          if (!cropFile) return;
          await uploadMutation.mutateAsync({
            file: croppedFile,
            variant: cropFile.variant,
          });
          setCropFile(null);
        }}
      />

      <Input
        value={draft.linkHref}
        onChange={(e) => {
          setDraft((d) => ({ ...d, linkHref: e.target.value }));
          setDirty(true);
        }}
        placeholder="Link ao tocar (opcional, ex.: /?categoria=esfirras)"
        className="h-8 text-xs"
      />

      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-2xs text-muted-foreground">Início</Label>
          <Input
            type="datetime-local"
            value={draft.startsAt}
            onChange={(e) => {
              setDraft((d) => ({ ...d, startsAt: e.target.value }));
              setDirty(true);
            }}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-2xs text-muted-foreground">Fim</Label>
          <Input
            type="datetime-local"
            value={draft.endsAt}
            onChange={(e) => {
              setDraft((d) => ({ ...d, endsAt: e.target.value }));
              setDirty(true);
            }}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-2xs text-muted-foreground">Ordem</Label>
          <Input
            value={draft.sortOrder}
            onChange={(e) => {
              setDraft((d) => ({ ...d, sortOrder: e.target.value }));
              setDirty(true);
            }}
            inputMode="numeric"
            className="h-8 text-xs"
          />
        </div>
      </div>

      {errorMsg ? <p className="text-2xs text-destructive">{errorMsg}</p> : null}

      <div className="flex items-center justify-between gap-2">
        <Label className="inline-flex items-center gap-1.5 text-2xs font-semibold">
          <input
            type="checkbox"
            checked={banner.isActive}
            disabled={!bothImagesSet}
            onChange={(e) => patchMutation.mutate({ isActive: e.target.checked })}
          />
          {bothImagesSet
            ? 'Ativa (dentro da vigência)'
            : 'Envie as duas imagens para ativar'}
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
