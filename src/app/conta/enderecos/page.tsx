'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin, Plus, Star } from 'lucide-react';
import { AccountAuthGate } from '@/components/account/AccountAuthGate';
import { AccountPageHeader } from '@/components/account/AccountPageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useAppDialog } from '@/contexts/AppDialogContext';
import type { SavedAddress } from '@/modules/customers/addresses';
import { cn } from '@/lib/cn';
import {
  checkoutDesktopContainerClass,
  pageBodyPadClass,
  pagePrimaryButtonClass,
} from '@/lib/layout';

export default function EnderecosPage() {
  const { user, identityReady } = useAuth();
  const { confirm } = useAppDialog();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!identityReady || !user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/v1/addresses', { cache: 'no-store' });
        const json = await response.json().catch(() => null);
        if (cancelled) return;
        if (!response.ok) {
          setError(json?.error?.message ?? 'Não foi possível carregar.');
          setAddresses([]);
          return;
        }
        setAddresses(json.addresses as SavedAddress[]);
      } catch {
        if (!cancelled) setError('Falha de rede ao carregar endereços.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [identityReady, user]);

  const removeAddress = async (address: SavedAddress) => {
    const ok = await confirm({
      title: 'Remover endereço',
      description: `Remover ${address.label || `${address.street}, ${address.number}`}?`,
      confirmLabel: 'Remover',
      tone: 'destructive',
    });
    if (!ok) return;
    const response = await fetch(`/api/v1/addresses/${address.id}`, {
      method: 'DELETE',
    });
    if (!response.ok) return;
    setAddresses((prev) => prev.filter((item) => item.id !== address.id));
  };

  return (
    <div className="flex min-h-dvh min-w-0 flex-col bg-background">
      <AccountPageHeader title="Meus endereços" />
      <div className={cn(pageBodyPadClass, checkoutDesktopContainerClass)}>
        <AccountAuthGate
          title="Entre para salvar endereços"
          description="Com a conta identificada, você reutiliza o endereço no próximo pedido."
        >
          {loading ? (
            <p className="pt-6 text-center text-sm text-muted-foreground">
              Carregando endereços…
            </p>
          ) : error ? (
            <p className="pt-6 text-center text-sm text-destructive">{error}</p>
          ) : addresses.length === 0 ? (
            <div className="flex flex-col items-center gap-2 pt-8 text-center">
              <MapPin className="size-10 text-muted-foreground" />
              <p className="text-base font-semibold">Nenhum endereço ainda</p>
              <p className="text-sm text-muted-foreground">
                Cadastre um endereço de Pereiro para agilizar a entrega.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {addresses.map((address) => (
                <div
                  key={address.id}
                  className="rounded-lg border border-border bg-card p-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-semibold">
                        {address.label || 'Endereço'}
                        {address.isDefault ? (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-2xs font-semibold text-primary">
                            <Star className="size-2.5" />
                            Padrão
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-sm leading-snug text-muted-foreground">
                        {address.street}, {address.number}
                        {address.complement ? ` · ${address.complement}` : ''}
                        <br />
                        {address.neighborhood}, {address.city}/{address.state}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Link
                      href={`/conta/enderecos/${address.id}`}
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold"
                    >
                      Editar
                    </Link>
                    <button
                      type="button"
                      onClick={() => void removeAddress(address)}
                      className="rounded-md px-3 py-1.5 text-xs font-semibold text-destructive"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Link
            href="/conta/enderecos/novo"
            className={cn(pagePrimaryButtonClass, 'mt-4 gap-2')}
          >
            <Plus className="size-4" />
            Adicionar endereço
          </Link>
        </AccountAuthGate>
      </div>
    </div>
  );
}
