'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AccountAuthGate } from '@/components/account/AccountAuthGate';
import { AccountAddressForm } from '@/components/account/AccountAddressForm';
import { AccountPageHeader } from '@/components/account/AccountPageHeader';
import { useShopExperience } from '@/contexts/ShopExperienceContext';
import { cn } from '@/lib/cn';
import {
  checkoutDesktopContainerClass,
  mobilePageColumnClass,
  mobilePageScrollClass,
  pageBodyPadClass,
} from '@/lib/layout';

export default function NovoEnderecoPage() {
  const router = useRouter();
  const { notify } = useShopExperience();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  return (
    <div
      className={cn(
        'flex min-h-dvh min-w-0 flex-col bg-background',
        mobilePageColumnClass,
      )}
    >
      <AccountPageHeader title="Novo endereço" backHref="/conta/enderecos" />
      <div
        className={cn(
          mobilePageScrollClass,
          pageBodyPadClass,
          checkoutDesktopContainerClass,
        )}
      >
        <AccountAuthGate
          title="Entre para salvar um endereço"
          description="Identifique-se para cadastrar um local de entrega."
        >
          <AccountAddressForm
            submitting={submitting}
            error={error}
            submitLabel="Salvar endereço"
            onSubmit={async (value) => {
              setSubmitting(true);
              setError('');
              try {
                const response = await fetch('/api/v1/addresses', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(value),
                });
                const json = await response.json().catch(() => null);
                if (!response.ok) {
                  setError(
                    json?.error?.message ?? 'Não foi possível salvar.',
                  );
                  return;
                }
                notify('Endereço salvo.', 'success');
                router.replace('/conta/enderecos');
              } catch {
                setError('Falha de rede ao salvar.');
              } finally {
                setSubmitting(false);
              }
            }}
          />
        </AccountAuthGate>
      </div>
    </div>
  );
}
