'use client';

import { useEffect, useState } from 'react';
import { Loader2, Megaphone } from 'lucide-react';
import { useAppDialog } from '@/contexts/AppDialogContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiError, apiJson } from '@/lib/api';

const TITLE_MAX = 80;
const BODY_MAX = 180;

type Recipients = { customers: number; devices: number };
type BroadcastResult = {
  customers: number;
  devices: number;
  sent: number;
  failed: number;
  revoked: number;
};

function plural(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

/** Dispara um push pra todo cliente com notificações ativas — promoção, cupom, aviso geral. */
export function PushBroadcastSection() {
  const { confirm, alert } = useAppDialog();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [recipients, setRecipients] = useState<Recipients | null>(null);
  const [loadingRecipients, setLoadingRecipients] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    apiJson<Recipients>('/api/v1/admin/notifications/broadcast')
      .then((data) => {
        if (!cancelled) setRecipients(data);
      })
      .catch(() => {
        if (!cancelled) setRecipients(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingRecipients(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const canSubmit = title.trim().length > 0 && body.trim().length > 0 && !sending;

  const submit = async () => {
    if (!canSubmit) return;

    const count = recipients?.customers ?? 0;
    const proceed = await confirm({
      title: 'Enviar notificação',
      description:
        count > 0
          ? `Isso vai enviar para ${count} ${plural(count, 'cliente', 'clientes')} com notificações ativas. Não dá pra desfazer. Confirmar?`
          : 'Nenhum cliente tem notificações ativas no momento. Enviar mesmo assim?',
      confirmLabel: 'Enviar',
      tone: 'destructive',
    });
    if (!proceed) return;

    setSending(true);
    setError('');
    try {
      const result = await apiJson<BroadcastResult>(
        '/api/v1/admin/notifications/broadcast',
        {
          method: 'POST',
          body: JSON.stringify({
            title: title.trim(),
            body: body.trim(),
            url: url.trim() || undefined,
          }),
        },
      );
      setTitle('');
      setBody('');
      setUrl('');
      setRecipients({ customers: result.customers, devices: result.devices });
      await alert({
        title: 'Notificação enviada',
        description: `Entregue em ${result.sent} de ${result.devices} ${plural(result.devices, 'dispositivo', 'dispositivos')}.`,
      });
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Não foi possível enviar a notificação.',
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-3.5">
      <div className="flex items-start gap-2.5">
        <Megaphone className="mt-0.5 size-4 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Avisar todos os clientes</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Envia um push pra todo cliente com notificações ativadas — bom
            pra promoção, cupom novo ou aviso geral.
          </p>
        </div>
      </div>

      <p className="text-2xs text-muted-foreground">
        {loadingRecipients
          ? 'Verificando clientes com notificações ativas…'
          : recipients
            ? `${recipients.customers} ${plural(recipients.customers, 'cliente', 'clientes')} vão receber (${recipients.devices} ${plural(recipients.devices, 'dispositivo', 'dispositivos')}).`
            : 'Não foi possível verificar quantos clientes receberiam.'}
      </p>

      <div>
        <Label className="mb-1 block text-2xs font-semibold">
          Título ({title.length}/{TITLE_MAX})
        </Label>
        <Input
          value={title}
          maxLength={TITLE_MAX}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Ex.: Cupom BOLO10 até domingo 🎂"
          className="h-10"
        />
      </div>

      <div>
        <Label className="mb-1 block text-2xs font-semibold">
          Mensagem ({body.length}/{BODY_MAX})
        </Label>
        <Textarea
          value={body}
          maxLength={BODY_MAX}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          placeholder="Ex.: 10% de desconto em qualquer bolo até domingo. Use o cupom no carrinho."
          className="w-full resize-none rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
      </div>

      <div>
        <Label className="mb-1 block text-2xs font-semibold">
          Link ao tocar (opcional)
        </Label>
        <Input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="/cardapio"
          className="h-10"
        />
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => void submit()}
        className="flex h-10 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-white disabled:opacity-60"
      >
        {sending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          'Enviar para todos os clientes'
        )}
      </button>
    </section>
  );
}
