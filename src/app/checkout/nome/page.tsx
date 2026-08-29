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
import {
  mobilePageColumnClass,
  mobilePageScrollClass,
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
    if (!user) {
      router.replace('/checkout/identificacao');
      return;
    }
    if (hasCustomerName(user.name)) {
      router.replace('/checkout/recebimento');
    }
  }, [identityReady, user, router]);

  const handleContinue = async () => {
    if (!isValid || submitting) return;
    setError('');
    setSubmitting(true);
    const result = await updateProfile(name.trim());
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.push('/checkout/recebimento');
  };

  return (
    <div
      className={cn(
        'flex min-h-dvh min-w-0 flex-col bg-background',
        mobilePageColumnClass,
      )}
    >
      <header className={cn(pageHeaderBarClass, checkoutDesktopContainerClass)}>
        <Link href="/carrinho" aria-label="Voltar ao carrinho">
          <ArrowLeft className="size-6" />
        </Link>
        <h1 className="text-[17px] font-semibold">Seu nome</h1>
        <span className="w-6" />
      </header>

      <div className={mobilePageScrollClass}>
        <div
          className={cn(
            'space-y-4',
            pageBodyPadClass,
            checkoutDesktopContainerClass,
          )}
        >
          <div>
            <h2 className="text-xl font-bold tracking-[-0.3px]">
              Como podemos te chamar?
            </h2>
            <p className="mt-1.5 text-sm leading-5 text-muted-foreground">
              Precisamos do seu nome para identificar o pedido. Você só informa
              uma vez.
            </p>
          </div>

          <div>
            <Label className="mb-1.5 block text-[13px] font-medium">
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
