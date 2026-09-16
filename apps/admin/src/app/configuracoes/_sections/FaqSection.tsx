'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HelpCircle, Loader2, Plus, Trash2 } from 'lucide-react';
import { useAppDialog } from '@/contexts/AppDialogContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, apiJson } from '@/lib/api';
import { adminKeys } from '@/lib/query-keys';

type AdminFaqItem = {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  isActive: boolean;
};

type FaqDraft = {
  question: string;
  answer: string;
  sortOrder: string;
};

function draftFrom(item: AdminFaqItem): FaqDraft {
  return {
    question: item.question,
    answer: item.answer,
    sortOrder: String(item.sortOrder),
  };
}

function FaqItemCard({
  item,
  autoSelect,
}: {
  item: AdminFaqItem;
  autoSelect?: boolean;
}) {
  const queryClient = useQueryClient();
  const { confirm } = useAppDialog();
  const [draft, setDraft] = useState<FaqDraft>(() => draftFrom(item));
  const [dirty, setDirty] = useState(false);
  const questionRef = useRef<HTMLInputElement>(null);

  // Item recém-criado vem com texto de exemplo pronto pra digitar por cima
  // (sem precisar selecionar/apagar antes) — a API exige pergunta/resposta
  // não vazias, então não dá pra criar em branco.
  useEffect(() => {
    if (autoSelect) questionRef.current?.select();
  }, [autoSelect]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: adminKeys.faq() });

  const patchMutation = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      apiJson(`/api/v1/admin/faq/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      apiJson(`/api/v1/admin/faq/${item.id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  const errorMsg =
    patchMutation.error instanceof ApiError ? patchMutation.error.message : null;

  const saveDraft = () => {
    patchMutation.mutate({
      question: draft.question.trim(),
      answer: draft.answer.trim(),
      sortOrder: Number(draft.sortOrder) || 0,
    });
    setDirty(false);
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Remover pergunta',
      description: `Remover "${item.question}" do FAQ?`,
      confirmLabel: 'Remover',
      tone: 'destructive',
    });
    if (ok) deleteMutation.mutate();
  };

  return (
    <div className="space-y-2.5 rounded-lg border border-border bg-background p-3">
      <div className="space-y-2">
        <Input
          ref={questionRef}
          value={draft.question}
          onChange={(e) => {
            setDraft((d) => ({ ...d, question: e.target.value }));
            setDirty(true);
          }}
          placeholder="Pergunta"
          className="h-8 text-xs"
        />
        <textarea
          value={draft.answer}
          onChange={(e) => {
            setDraft((d) => ({ ...d, answer: e.target.value }));
            setDirty(true);
          }}
          placeholder="Resposta"
          rows={3}
          className="w-full resize-none rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs shadow-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div />
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
            checked={item.isActive}
            onChange={(e) => patchMutation.mutate({ isActive: e.target.checked })}
          />
          Visível no app
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

/** Perguntas frequentes do popover de ajuda do client. */
export function FaqSection() {
  const queryClient = useQueryClient();
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: adminKeys.faq(),
    queryFn: () => apiJson<{ items: AdminFaqItem[] }>('/api/v1/admin/faq'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiJson<{ item: AdminFaqItem }>('/api/v1/admin/faq', {
        method: 'POST',
        body: JSON.stringify({
          question: 'Nova pergunta',
          answer: 'Resposta...',
        }),
      }),
    onSuccess: (result) => {
      setJustCreatedId(result.item.id);
      void queryClient.invalidateQueries({ queryKey: adminKeys.faq() });
    },
  });

  const items = query.data?.items ?? [];

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-3.5">
      <div className="flex items-start gap-2.5">
        <HelpCircle className="mt-0.5 size-4 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Perguntas frequentes</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Conteúdo do popover de ajuda do client. Sem nenhuma ativa, o app
            mostra as perguntas padrão.
          </p>
        </div>
      </div>

      {query.isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <FaqItemCard
              key={item.id}
              item={item}
              autoSelect={item.id === justCreatedId}
            />
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
        Nova pergunta
      </button>
    </section>
  );
}
