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
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-[9999px] h-px w-px overflow-hidden opacity-0"
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
