'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AccountAuthGate } from '@/components/account/AccountAuthGate';
import { AccountAddressForm } from '@/components/account/AccountAddressForm';
import { AccountPageHeader } from '@/components/account/AccountPageHeader';
import { useShopExperience } from '@/contexts/ShopExperienceContext';
import type { SavedAddress } from '@/modules/customers/addresses';
import { cn } from '@/lib/cn';
import {
  checkoutDesktopContainerClass,
  pageBodyPadClass,
} from '@/lib/layout';

export default function EditarEnderecoPage({
  params,
}: {
  params: Promise<{ addressId: string }>;
}) {
  const { addressId } = use(params);
  const router = useRouter();
  const { notify } = useShopExperience();
  const [address, setAddress] = useState<SavedAddress | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/v1/addresses', { cache: 'no-store' });
        const json = await response.json().catch(() => null);
        if (cancelled) return;
        const found = (json?.addresses as SavedAddress[] | undefined)?.find(
          (item) => item.id === addressId,
        );
        setAddress(found ?? null);
        if (!found) setError('Endereço não encontrado.');
      } catch {
        if (!cancelled) setError('Falha de rede ao carregar.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [addressId]);

  return (
    <div className="flex min-h-dvh min-w-0 flex-col bg-background">
      <AccountPageHeader title="Editar endereço" backHref="/conta/enderecos" />
      <div className={cn(pageBodyPadClass, checkoutDesktopContainerClass)}>
        <AccountAuthGate
          title="Entre para editar endereços"
          description="Identifique-se para alterar um local salvo."
        >
          {loading ? (
            <div className="flex justify-center pt-16 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : address ? (
            <AccountAddressForm
              initial={{
                label: address.label ?? '',
                street: address.street,
                number: address.number,
                neighborhood: address.neighborhood,
                complement: address.complement ?? '',
                referencePoint: address.referencePoint ?? '',
                latitude: address.latitude,
                longitude: address.longitude,
                isDefault: address.isDefault,
              }}
              submitting={submitting}
              error={error}
              submitLabel="Salvar alterações"
              onSubmit={async (value) => {
                setSubmitting(true);
                setError('');
                try {
                  const response = await fetch(
                    `/api/v1/addresses/${addressId}`,
                    {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(value),
                    },
                  );
                  const json = await response.json().catch(() => null);
                  if (!response.ok) {
                    setError(
                      json?.error?.message ?? 'Não foi possível salvar.',
                    );
                    return;
                  }
                  notify('Endereço atualizado.', 'success');
                  router.replace('/conta/enderecos');
                } catch {
                  setError('Falha de rede ao salvar.');
                } finally {
                  setSubmitting(false);
                }
              }}
            />
          ) : (
            <p className="pt-8 text-center text-sm text-destructive">{error}</p>
          )}
        </AccountAuthGate>
      </div>
    </div>
  );
}
