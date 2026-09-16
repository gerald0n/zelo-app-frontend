'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Megaphone, Plus } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { adminKeys } from '@/lib/query-keys';
import {
  PushTemplateCard,
  type AdminPushTemplate,
} from './PushTemplateCard';

type Recipients = { customers: number; devices: number };

/**
 * Modelos de push notification reutilizáveis — cada um pode ser disparado
 * manualmente (botão + confirmação) ou agendado pra um dia/horário. Substitui
 * o antigo "escreve e dispara" (PushBroadcastSection).
 */
export function PushTemplatesSection() {
  const queryClient = useQueryClient();

  const templatesQuery = useQuery({
    queryKey: adminKeys.pushTemplates(),
    queryFn: () =>
      apiJson<{ templates: AdminPushTemplate[] }>(
        '/api/v1/admin/push-templates',
      ),
  });

  const recipientsQuery = useQuery({
    queryKey: adminKeys.pushBroadcastRecipients(),
    queryFn: () =>
      apiJson<Recipients>('/api/v1/admin/notifications/broadcast'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiJson('/api/v1/admin/push-templates', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Novo modelo',
          body: 'Escreva a mensagem deste push aqui.',
          mode: 'manual',
        }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: adminKeys.pushTemplates() }),
  });

  const templates = templatesQuery.data?.templates ?? [];
  const recipients = recipientsQuery.data ?? null;

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-3.5">
      <div className="flex items-start gap-2.5">
        <Megaphone className="mt-0.5 size-4 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Modelos de push notification</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Crie modelos com antecedência e dispare quando quiser — na hora ou
            agendado pra um dia e horário. Vai pra todo cliente com
            notificações ativas.
          </p>
        </div>
      </div>

      <p className="text-2xs text-muted-foreground">
        {recipientsQuery.isLoading
          ? 'Verificando clientes com notificações ativas…'
          : recipients
            ? `${recipients.customers} ${recipients.customers === 1 ? 'cliente' : 'clientes'} vão receber (${recipients.devices} ${recipients.devices === 1 ? 'dispositivo' : 'dispositivos'}).`
            : 'Não foi possível verificar quantos clientes receberiam.'}
      </p>

      {templatesQuery.isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <p className="rounded-md border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
          Nenhum modelo criado ainda.
        </p>
      ) : (
        <div className="space-y-2.5">
          {templates.map((template) => (
            <PushTemplateCard
              key={template.id}
              template={template}
              recipients={recipients}
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
        Novo modelo
      </button>
    </section>
  );
}
