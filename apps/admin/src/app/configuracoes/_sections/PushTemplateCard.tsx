'use client';

import { useEffect, useRef } from 'react';
import { Loader2, Send, Trash2, X } from 'lucide-react';
import { RouteLinkCombobox } from '@/components/admin/RouteLinkCombobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import { formatDateTime, type AdminPushTemplate } from './push-template-format';
import { usePushTemplateCard } from './usePushTemplateCard';

export type { AdminPushTemplate };

const TITLE_MAX = 80;
const BODY_MAX = 180;

export function PushTemplateCard({
  template,
  recipients,
  autoSelect,
}: {
  template: AdminPushTemplate;
  recipients: { customers: number; devices: number } | null;
  autoSelect?: boolean;
}) {
  const card = usePushTemplateCard(template, recipients);
  const { draft } = card;
  const titleRef = useRef<HTMLInputElement>(null);

  // Modelo recém-criado vem com texto de exemplo pronto pra digitar por cima
  // (sem precisar selecionar/apagar antes) — a API exige título/mensagem
  // não vazios, então não dá pra criar em branco.
  useEffect(() => {
    if (autoSelect) titleRef.current?.select();
  }, [autoSelect]);

  return (
    <div className="space-y-3 rounded-lg border border-border bg-background p-3">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => card.switchMode('manual')}
          className={cn(
            'rounded-full border px-2.5 py-1 text-2xs font-semibold transition-colors',
            draft.mode === 'manual'
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border text-muted-foreground hover:bg-accent',
          )}
        >
          Manual
        </button>
        <button
          type="button"
          onClick={() => card.switchMode('scheduled')}
          className={cn(
            'rounded-full border px-2.5 py-1 text-2xs font-semibold transition-colors',
            draft.mode === 'scheduled'
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border text-muted-foreground hover:bg-accent',
          )}
        >
          Agendado
        </button>

        {card.isScheduled && template.scheduledAt ? (
          <span className="ml-1 rounded-full bg-amber-500/15 px-2 py-1 text-2xs font-semibold text-amber-600">
            Agendado p/ {formatDateTime(template.scheduledAt)}
          </span>
        ) : null}

        {template.sendCount > 0 ? (
          <span className="ml-auto text-2xs text-muted-foreground">
            Enviado {template.sendCount}x
            {template.lastSentAt
              ? ` · último em ${formatDateTime(template.lastSentAt)}`
              : ''}
          </span>
        ) : null}
      </div>

      <div>
        <Label className="mb-1 block text-2xs font-semibold">
          Título ({draft.title.length}/{TITLE_MAX})
        </Label>
        <Input
          ref={titleRef}
          value={draft.title}
          maxLength={TITLE_MAX}
          onChange={(e) => card.setField('title', e.target.value)}
          placeholder="Ex.: Cupom BOLO10 até domingo 🎂"
          className="h-8 text-xs"
        />
      </div>

      <div>
        <Label className="mb-1 block text-2xs font-semibold">
          Mensagem ({draft.body.length}/{BODY_MAX})
        </Label>
        <Textarea
          value={draft.body}
          maxLength={BODY_MAX}
          onChange={(e) => card.setField('body', e.target.value)}
          rows={2}
          placeholder="Ex.: 10% de desconto em qualquer bolo até domingo."
          className="w-full resize-none rounded-md border border-border bg-background px-2.5 py-2 text-xs outline-none focus:border-primary"
        />
      </div>

      <RouteLinkCombobox
        value={draft.url}
        onChange={(href) => card.setField('url', href)}
        className="h-8 text-xs"
      />

      {draft.mode === 'scheduled' ? (
        <div className="space-y-1">
          <Label className="text-2xs text-muted-foreground">
            Dia e horário do envio
          </Label>
          <Input
            type="datetime-local"
            value={draft.scheduledAt}
            onChange={(e) => card.setField('scheduledAt', e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      ) : null}

      {card.errorMsg ? (
        <p className="text-2xs text-destructive">{card.errorMsg}</p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {card.isScheduled ? (
            <button
              type="button"
              onClick={() => void card.handleCancelSchedule()}
              disabled={card.cancelPending}
              className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-2xs font-semibold text-muted-foreground transition-colors hover:bg-accent"
            >
              <X className="size-3" />
              Cancelar agendamento
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void card.handleDelete()}
            disabled={card.deletePending}
            className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-2xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
          >
            <Trash2 className="size-3" />
            Remover
          </button>
        </div>

        <div className="flex items-center gap-2">
          {card.dirty && draft.mode === 'manual' ? (
            <button
              type="button"
              onClick={card.saveDraft}
              disabled={card.patchPending}
              className="rounded-md bg-primary px-3 py-1.5 text-2xs font-semibold text-primary-foreground disabled:opacity-60"
            >
              Salvar
            </button>
          ) : null}

          {draft.mode === 'scheduled' && card.scheduleChanged ? (
            <button
              type="button"
              onClick={() => void card.handleSchedule()}
              disabled={!draft.scheduledAt || card.patchPending}
              className="rounded-md bg-primary px-3 py-1.5 text-2xs font-semibold text-primary-foreground disabled:opacity-60"
            >
              {card.patchPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                'Agendar'
              )}
            </button>
          ) : null}

          {draft.mode === 'manual' ? (
            <button
              type="button"
              onClick={() => void card.handleSendNow()}
              disabled={
                card.sendPending || !draft.title.trim() || !draft.body.trim()
              }
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-2xs font-semibold text-primary-foreground disabled:opacity-60"
            >
              {card.sendPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3" />
              )}
              Enviar agora
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
