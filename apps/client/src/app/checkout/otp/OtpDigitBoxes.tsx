import { cn } from '@/lib/cn';

export function OtpDigitBoxes({
  otp,
  length,
  onFocus,
}: {
  otp: string;
  length: number;
  onFocus: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onFocus}
      className="mt-1 flex w-full justify-center gap-2"
    >
      {Array.from({ length }).map((_, i) => (
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
  );
}
