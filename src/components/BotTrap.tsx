'use client';

import { TurnstileWidget } from '@/components/TurnstileWidget';

export function BotTrap({
  website,
  onWebsiteChange,
  onCaptchaToken,
}: {
  website: string;
  onWebsiteChange: (value: string) => void;
  onCaptchaToken: (token: string) => void;
}) {
  return (
    <>
      {/*
        Honeypot: invisível para humanos, mas presente no DOM para bots.
        Sem deslocar o layout — `-left-[9999px]` criava área rolável e
        forçava scroll horizontal/vertical na tela de OTP.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 h-px w-px overflow-hidden opacity-0"
      >
        <label>
          Website
          <input
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(event) => onWebsiteChange(event.target.value)}
          />
        </label>
      </div>
      <TurnstileWidget onToken={onCaptchaToken} />
    </>
  );
}
