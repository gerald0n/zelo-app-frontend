import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div
      className="flex min-h-dvh items-center justify-center bg-background"
      role="status"
      aria-label="Carregando"
    >
      <Loader2
        className="size-6 text-muted-foreground motion-safe:animate-spin"
        aria-hidden="true"
      />
    </div>
  );
}
