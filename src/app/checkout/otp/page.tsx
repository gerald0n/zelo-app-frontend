'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { formatPhoneDisplay } from '@/lib/phone';
import { BotTrap } from '@/components/BotTrap';
import {
  mobilePageColumnClass,
  checkoutDesktopContainerClass,
  pageHeaderBarClass,
  pageBodyPadClass,
  pageCtaBaseClass,
} from '@/lib/layout';

const OTP_LENGTH = 6;
const PENDING_PHONE_KEY = '@zelo/pendingPhone';
const DEBUG_OTP_KEY = '@zelo/debugOtp';
const OTP_CHANNEL_KEY = '@zelo/otpChannel';

function readSessionItem(key: string): string {
  try {
    return sessionStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function useSessionItem(key: string): string {
  return useSyncExternalStore(
    () => () => {},
    () => readSessionItem(key),
    () => '',
  );
}

export default function OtpPage() {
  const router = useRouter();
  const { pendingPhone, setPendingPhone, requestOtp, verifyOtp } = useAuth();
  const [otp, setOtp] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [website, setWebsite] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const onCaptchaToken = useCallback((token: string) => {
    setCaptchaToken(token);
  }, []);
  const storedPhone = useSessionItem(PENDING_PHONE_KEY);
  const storedDebug = useSessionItem(DEBUG_OTP_KEY);
  const [debugCode, setDebugCode] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const resolvedPhone = pendingPhone || storedPhone;
  const visibleDebug = debugCode || storedDebug;

  useEffect(() => {
    if (!resolvedPhone) {
      router.replace('/checkout/identificacao');
      return;
    }
    if (!pendingPhone) setPendingPhone(resolvedPhone);
  }, [pendingPhone, resolvedPhone, router, setPendingPhone]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedPhone = resolvedPhone ? formatPhoneDisplay(resolvedPhone) : '';

  const handleConfirm = async (code = otp) => {
    if (code.length < OTP_LENGTH || submitting) return;
    setError('');
    setSubmitting(true);
    const result = await verifyOtp(resolvedPhone, code);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    try {
      sessionStorage.removeItem(DEBUG_OTP_KEY);
    } catch {
      /* ignore */
    }
    router.push(result.needsName ? '/checkout/nome' : '/checkout/recebimento');
  };

  const handleInput = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setOtp(digits);
    if (digits.length === OTP_LENGTH) {
      void handleConfirm(digits);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || submitting) return;
    setError('');
    const result = await requestOtp(resolvedPhone, {
      captchaToken,
      website,
    });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    try {
      if (result.debugCode) {
        sessionStorage.setItem(DEBUG_OTP_KEY, result.debugCode);
        setDebugCode(result.debugCode);
      } else {
        sessionStorage.removeItem(DEBUG_OTP_KEY);
        setDebugCode('');
      }
      if (result.deliveredVia) {
        sessionStorage.setItem(OTP_CHANNEL_KEY, result.deliveredVia);
      }
    } catch {
      /* ignore */
    }
    setCountdown(60);
    setOtp('');
  };

  return (
    <div
      className={cn(
        'flex min-h-dvh min-w-0 flex-col bg-background',
        mobilePageColumnClass,
      )}
    >
      <header className={cn(pageHeaderBarClass, checkoutDesktopContainerClass)}>
        <Link
          href="/checkout/identificacao"
          aria-label="Voltar à identificação"
        >
          <ArrowLeft className="size-6" />
        </Link>
        <h1 className="text-lg font-semibold">Verificação</h1>
        <span className="w-6" />
      </header>

      <div
        className={cn(
          'flex flex-1 flex-col items-start gap-4',
          pageBodyPadClass,
          checkoutDesktopContainerClass,
        )}
      >
        <div>
          <h2 className="text-xl font-bold tracking-[-0.3px]">
            Código de verificação
          </h2>
          <p className="mt-2 text-sm leading-5 text-muted-foreground">
            Enviamos um código por SMS para{' '}
            <span className="font-semibold text-foreground">
              {formattedPhone}
            </span>
          </p>
          {visibleDebug ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Ambiente local: use o código{' '}
              <span className="font-semibold">{visibleDebug}</span>
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.focus()}
          className="mt-1 flex w-full justify-center gap-2"
        >
          {Array.from({ length: OTP_LENGTH }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'flex h-12 w-10 items-center justify-center rounded-md border-[1.5px] bg-card transition-colors duration-150',
                i === otp.length
                  ? 'border-primary'
                  : otp[i]
                    ? 'border-foreground'
                    : 'border-border',
              )}
            >
              <span className="font-mono text-2xl font-bold tabular-nums">
                {otp[i] ?? ''}
              </span>
            </div>
          ))}
        </button>

        <Input
          ref={inputRef}
          value={otp}
          onChange={(e) => handleInput(e.target.value)}
          inputMode="numeric"
          maxLength={OTP_LENGTH}
          autoFocus
          className="sr-only"
          aria-label="Código OTP"
        />

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <button
          type="button"
          onClick={() => void handleResend()}
          disabled={countdown > 0}
          className={cn(
            'text-sm font-medium',
            countdown > 0 ? 'text-muted-foreground' : 'text-primary',
          )}
        >
          {countdown > 0
            ? `Reenviar código em ${countdown}s`
            : 'Reenviar código'}
        </button>

        <div className="relative">
          <BotTrap
            website={website}
            onWebsiteChange={setWebsite}
            onCaptchaToken={onCaptchaToken}
          />
        </div>
      </div>

      <div
        className={cn(
          'border-t border-border px-3 pb-4 pt-2.5',
          checkoutDesktopContainerClass,
        )}
      >
        <button
          type="button"
          disabled={otp.length < OTP_LENGTH || submitting}
          onClick={() => void handleConfirm()}
          className={cn(
            pageCtaBaseClass,
            otp.length === OTP_LENGTH && !submitting
              ? 'bg-primary text-white'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {submitting ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            'Confirmar'
          )}
        </button>
      </div>
    </div>
  );
}
