'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useShopExperience } from '@/contexts/ShopExperienceContext';
import { AccountAuthGate } from '@/components/account/AccountAuthGate';
import { AccountPageHeader } from '@/components/account/AccountPageHeader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatPhoneDisplay } from '@/lib/phone';
import { cn } from '@/lib/cn';
import {
  checkoutDesktopContainerClass,
  checkoutFieldClass,
  pageBodyPadClass,
  pagePrimaryButtonClass,
} from '@/lib/layout';

export default function DadosPessoaisPage() {
  const { user, updateProfile } = useAuth();
  const { notify } = useShopExperience();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError('Informe seu nome.');
      return;
    }
    setSaving(true);
    setError('');
    const result = await updateProfile(trimmed);
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    notify('Dados atualizados.', 'success');
  };

  return (
    <div className="flex min-h-dvh min-w-0 flex-col bg-background">
      <AccountPageHeader title="Dados pessoais" />
      <div className={cn(pageBodyPadClass, checkoutDesktopContainerClass)}>
        <AccountAuthGate
          title="Entre para ver seus dados"
          description="Seu nome e celular ficam vinculados à conta identificada por código no celular."
        >
          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block text-xs font-semibold">Nome</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={checkoutFieldClass}
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-semibold">
                Celular
              </Label>
              <Input
                value={formatPhoneDisplay(user?.phone ?? '')}
                readOnly
                className={cn(checkoutFieldClass, 'bg-muted')}
              />
              <p className="mt-1.5 text-xs leading-4 text-muted-foreground">
                O celular é a chave da conta. Para usar outro número, saia e
                identifique-se de novo.
              </p>
            </div>
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
            <button
              type="button"
              disabled={saving || name.trim().length < 2}
              onClick={() => void handleSave()}
              className={pagePrimaryButtonClass}
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </AccountAuthGate>
      </div>
    </div>
  );
}
