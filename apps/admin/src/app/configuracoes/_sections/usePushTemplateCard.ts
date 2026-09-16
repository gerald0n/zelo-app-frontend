import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppDialog } from '@/contexts/AppDialogContext';
import { ApiError, apiJson } from '@/lib/api';
import { adminKeys } from '@/lib/query-keys';
import {
  draftFrom,
  formatDateTime,
  fromDatetimeLocal,
  plural,
  reenvioWarning,
  toDatetimeLocal,
  type AdminPushTemplate,
  type PushTemplateDraft,
  type PushTemplateMode,
} from './push-template-format';

export function usePushTemplateCard(
  template: AdminPushTemplate,
  recipients: { customers: number; devices: number } | null,
) {
  const queryClient = useQueryClient();
  const { confirm } = useAppDialog();
  const [draft, setDraft] = useState<PushTemplateDraft>(() => draftFrom(template));
  const [dirty, setDirty] = useState(false);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: adminKeys.pushTemplates() });

  const patchMutation = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      apiJson(`/api/v1/admin/push-templates/${template.id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: invalidate,
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      apiJson(`/api/v1/admin/push-templates/${template.id}/send`, {
        method: 'POST',
      }),
    onSuccess: invalidate,
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      apiJson(`/api/v1/admin/push-templates/${template.id}/cancel`, {
        method: 'POST',
      }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      apiJson(`/api/v1/admin/push-templates/${template.id}`, {
        method: 'DELETE',
      }),
    onSuccess: invalidate,
  });

  const errorMsg =
    patchMutation.error instanceof ApiError
      ? patchMutation.error.message
      : sendMutation.error instanceof ApiError
        ? sendMutation.error.message
        : null;

  const setField = <K extends keyof PushTemplateDraft>(
    key: K,
    value: PushTemplateDraft[K],
  ) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  };

  const saveDraft = () => {
    patchMutation.mutate({
      title: draft.title.trim(),
      body: draft.body.trim(),
      url: draft.url.trim() || null,
    });
    setDirty(false);
  };

  const switchMode = (mode: PushTemplateMode) => {
    setField('mode', mode);
    if (mode === 'manual') {
      patchMutation.mutate({ mode: 'manual' });
      setDirty(false);
    }
  };

  const handleSendNow = async () => {
    const count = recipients?.customers ?? 0;
    const proceed = await confirm({
      title: 'Enviar notificação',
      description:
        (count > 0
          ? `Isso vai enviar "${draft.title}" para ${count} ${plural(count, 'cliente', 'clientes')} com notificações ativas agora. Não dá pra desfazer.`
          : `Nenhum cliente tem notificações ativas no momento. Enviar "${draft.title}" mesmo assim?`) +
        reenvioWarning(template),
      confirmLabel: 'Enviar',
      tone: 'destructive',
    });
    if (proceed) sendMutation.mutate();
  };

  const handleSchedule = async () => {
    if (!draft.scheduledAt) return;
    const scheduledIso = fromDatetimeLocal(draft.scheduledAt);
    if (!scheduledIso) return;
    const proceed = await confirm({
      title: 'Agendar notificação',
      description:
        `"${draft.title}" vai ser enviado automaticamente em ${formatDateTime(scheduledIso)} pra ${recipients?.customers ?? 0} ${plural(recipients?.customers ?? 0, 'cliente', 'clientes')} com notificações ativas na hora.` +
        reenvioWarning(template),
      confirmLabel: 'Agendar',
    });
    if (!proceed) return;
    patchMutation.mutate({
      title: draft.title.trim(),
      body: draft.body.trim(),
      url: draft.url.trim() || null,
      mode: 'scheduled',
      scheduledAt: scheduledIso,
    });
    setDirty(false);
  };

  const handleCancelSchedule = async () => {
    const proceed = await confirm({
      title: 'Cancelar agendamento',
      description: `"${template.title}" não vai mais ser enviado automaticamente. Ele volta pra rascunho.`,
      confirmLabel: 'Cancelar agendamento',
      tone: 'destructive',
    });
    if (proceed) cancelMutation.mutate();
  };

  const handleDelete = async () => {
    const proceed = await confirm({
      title: 'Remover modelo',
      description: `Remover "${template.title}"? O histórico de envios anteriores continua no relatório de auditoria.`,
      confirmLabel: 'Remover',
      tone: 'destructive',
    });
    if (proceed) deleteMutation.mutate();
  };

  const isScheduled = template.status === 'scheduled';
  const scheduleChanged =
    draft.mode === 'scheduled' &&
    (draft.scheduledAt !== toDatetimeLocal(template.scheduledAt) ||
      dirty ||
      !isScheduled);

  return {
    draft,
    dirty,
    errorMsg,
    isScheduled,
    scheduleChanged,
    setField,
    switchMode,
    saveDraft,
    handleSendNow,
    handleSchedule,
    handleCancelSchedule,
    handleDelete,
    patchPending: patchMutation.isPending,
    sendPending: sendMutation.isPending,
    cancelPending: cancelMutation.isPending,
    deletePending: deleteMutation.isPending,
  };
}
