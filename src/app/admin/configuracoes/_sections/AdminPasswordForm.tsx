'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ADMIN_MIN_PASSWORD_LENGTH } from '@/config/admin';
import { useAppDialog } from '@/contexts/AppDialogContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, apiJson } from '@/lib/api';

export function AdminPasswordForm() {
  const { alert } = useAppDialog();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= ADMIN_MIN_PASSWORD_LENGTH &&
    !saving;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError('');
    try {
      await apiJson<{ ok: true }>('/api/v1/admin/session/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      await alert({
        title: 'Senha atualizada',
        description: 'A nova senha já vale para o próximo acesso.',
      });
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Não foi possível alterar a senha.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-2.5 rounded-lg border border-border bg-card p-3.5">
      <p className="text-sm font-semibold">Alterar senha</p>
      <p className="text-xs leading-4 text-muted-foreground">
        Troque a senha inicial antes de publicar o painel.
      </p>
      <div>
        <Label className="mb-1 block text-2xs font-semibold">Senha atual</Label>
        <Input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="h-10"
        />
      </div>
      <div>
        <Label className="mb-1 block text-2xs font-semibold">Nova senha</Label>
        <Input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
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
        {saving ? <Loader2 className="size-4 animate-spin" /> : 'Salvar senha'}
      </button>
    </section>
  );
}
