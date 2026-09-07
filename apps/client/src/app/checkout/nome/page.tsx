'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/cn';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { hasCustomerName } from '@/modules/auth/customer-name';
import { consumeAuthReturnTo } from '@/modules/auth/auth-return';
import {
  checkoutFieldClass,
  checkoutFooterClass,
  checkoutDesktopContainerClass,
  pageHeaderBarClass,
  pageBodyPadClass,
  pageCtaBaseClass,
} from '@/lib/layout';

export default function CheckoutNomePage() {
  const router = useRouter();
  const { user, identityReady, updateProfile } = useAuth();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isValid = name.trim().length >= 2;

  useEffect(() => {
    if (!identityReady) return;
    // Enquanto o próprio submit está navegando, ele é quem decide o destino
    // (e consome o `authReturnTo`). Sem esse guard, o efeito dispararia ao
    // `user.name` chegar e consumiria o retorno de novo — caindo no checkout.
    if (submitting) return;
    if (!user) {
      router.replace('/checkout/identificacao');
      return;
    }
    if (hasCustomerName(user.name)) {
      router.replace(consumeAuthReturnTo() ?? '/checkout/recebimento');
    }
  }, [identityReady, user, router, submitting]);

  const handleContinue = async () => {
    if (!isValid || submitting) return;
    setError('');
    setSubmitting(true);
    const result = await updateProfile(name.trim());
    if (!result.ok) {
      setSubmitting(false);
      setError(result.message);
      return;
    }
    router.push(consumeAuthReturnTo() ?? '/checkout/recebimento');
  };

  return (
    <div className="flex min-h-dvh min-w-0 flex-col bg-background">
      <header className={cn(pageHeaderBarClass, checkoutDesktopContainerClass)}>
        <Link href="/carrinho" aria-label="Voltar ao carrinho">
          <ArrowLeft className="size-6" />
        </Link>
        <h1 className="text-lg font-semibold">Seu nome</h1>
        <span className="w-6" />
      </header>

      <div>
        <div
          className={cn(
            'space-y-4',
            pageBodyPadClass,
            checkoutDesktopContainerClass,
          )}
        >
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              Como podemos te chamar?
            </h2>
            <p className="mt-1.5 text-sm leading-5 text-muted-foreground">
              Precisamos do seu nome para identificar o pedido. Você só informa
              uma vez.
            </p>
          </div>

          <div>
            <Label className="mb-1.5 block text-sm font-medium">
              Seu nome
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Maria"
              autoCapitalize="words"
              autoComplete="name"
              className={checkoutFieldClass}
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className={checkoutFooterClass}>
            <button
              type="button"
              disabled={!isValid || submitting}
              onClick={() => void handleContinue()}
              className={cn(
                pageCtaBaseClass,
                isValid && !submitting
                  ? 'bg-primary text-white'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {submitting ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                'Continuar'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
