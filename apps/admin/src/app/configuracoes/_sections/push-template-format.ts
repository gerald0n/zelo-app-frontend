export type PushTemplateMode = 'manual' | 'scheduled';
export type PushTemplateStatus = 'draft' | 'scheduled' | 'canceled';

export type AdminPushTemplate = {
  id: string;
  title: string;
  body: string;
  url: string | null;
  mode: PushTemplateMode;
  scheduledAt: string | null;
  status: PushTemplateStatus;
  lastSentAt: string | null;
  sendCount: number;
  createdAt: string;
  updatedAt: string;
};

export type PushTemplateDraft = {
  title: string;
  body: string;
  url: string;
  mode: PushTemplateMode;
  scheduledAt: string;
};

export function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** `datetime-local` não aceita segundos/timezone do ISO — corta pro minuto. */
export function toDatetimeLocal(iso: string | null): string {
  return iso ? iso.slice(0, 16) : '';
}

export function fromDatetimeLocal(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

export function draftFrom(template: AdminPushTemplate): PushTemplateDraft {
  return {
    title: template.title,
    body: template.body,
    url: template.url ?? '',
    mode: template.mode,
    scheduledAt: toDatetimeLocal(template.scheduledAt),
  };
}

/** Aviso extra pro modal de confirmação quando o modelo já foi enviado antes. */
export function reenvioWarning(template: AdminPushTemplate): string {
  return template.sendCount > 0
    ? ` Atenção: esse modelo já foi enviado ${template.sendCount}x, o último em ${formatDateTime(template.lastSentAt ?? template.updatedAt)}.`
    : '';
}
