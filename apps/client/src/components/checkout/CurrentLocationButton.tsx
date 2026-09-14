'use client';

import { LocateFixed, Loader2 } from 'lucide-react';
import {
  useCurrentLocation,
  type CurrentLocationResult,
} from '@/hooks/useCurrentLocation';
import { cn } from '@/lib/cn';

type CurrentLocationButtonProps = {
  onResolve: (result: CurrentLocationResult) => void;
  className?: string;
};

export function CurrentLocationButton({
  onResolve,
  className,
}: CurrentLocationButtonProps) {
  const { status, errorMessage, infoMessage, supported, locate } =
    useCurrentLocation();

  if (!supported) return null;

  const locating = status === 'locating';

  return (
    <div className={cn('space-y-1', className)}>
      <button
        type="button"
        disabled={locating}
        onClick={async () => {
          const result = await locate();
          if (result) onResolve(result);
        }}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card py-2.5 text-sm font-medium text-foreground',
          locating && 'opacity-70',
        )}
      >
        {locating ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <LocateFixed className="size-4 text-primary" />
        )}
        Usar minha localização atual como local de entrega
      </button>
      {errorMessage ? (
        <p className="text-xs text-destructive">{errorMessage}</p>
      ) : null}
      {infoMessage ? (
        <p className="text-xs text-muted-foreground">{infoMessage}</p>
      ) : null}
    </div>
  );
}
