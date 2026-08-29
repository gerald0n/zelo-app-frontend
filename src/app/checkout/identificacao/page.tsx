'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/cn';
import { formatPhoneDisplay } from '@/lib/phone';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BotTrap } from '@/components/BotTrap';
import { checkoutContinuePath } from '@/modules/auth/checkout-path';
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

const PENDING_PHONE_KEY = '@zelo/pendingPhone';
const DEBUG_OTP_KEY = '@zelo/debugOtp';
const OTP_CHANNEL_KEY = '@zelo/otpChannel';

export default function IdentificacaoPage() {
  const router = useRouter();
  const { user, identityReady, setPendingPhone, requestOtp } = useAuth();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [website, setWebsite] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const onCaptchaToken = useCallback((token: string) => {
    setCaptchaToken(token);
  }, []);

  const rawPhone = phone.replace(/\D/g, '');
  const isValid = rawPhone.length >= 10;

  useEffect(() => {
    if (!identityReady) return;
    if (user) router.replace(checkoutContinuePath(user));
  }, [identityReady, user, router]);

  const handleContinue = async () => {
    if (!isValid || submitting) return;
    setError('');
    setSubmitting(true);
    setPendingPhone(rawPhone);
    try {
      sessionStorage.setItem(PENDING_PHONE_KEY, rawPhone);
    } catch {
      /* ignore */
    }
    const result = await requestOtp(rawPhone, {
      captchaToken,
      website,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    try {
      if (result.debugCode) {
        sessionStorage.setItem(DEBUG_OTP_KEY, result.debugCode);
      } else {
        sessionStorage.removeItem(DEBUG_OTP_KEY);
      }
      if (result.deliveredVia) {
        sessionStorage.setItem(OTP_CHANNEL_KEY, result.deliveredVia);
      } else {
        sessionStorage.removeItem(OTP_CHANNEL_KEY);
      }
    } catch {
      /* ignore */
    }
    router.push('/checkout/otp');
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
        <h1 className="text-[17px] font-semibold">Identificação</h1>
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
              Entrar ou criar conta
            </h2>
            <p className="mt-1.5 text-sm leading-5 text-muted-foreground">
              Informe seu celular. Enviaremos um código por SMS para continuar.
            </p>
          </div>

          <div>
            <Label className="mb-1.5 block text-[13px] font-medium">
              Celular
            </Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(formatPhoneDisplay(e.target.value))}
              placeholder="(88) 99999-9999"
              inputMode="tel"
              autoComplete="tel"
              className={checkoutFieldClass}
            />
          </div>

          <div className="relative">
            <BotTrap
              website={website}
              onWebsiteChange={setWebsite}
              onCaptchaToken={onCaptchaToken}
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
                'Receber código de verificação'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
