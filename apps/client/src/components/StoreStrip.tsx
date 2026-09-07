'use client';

import { Clock, MapPin } from 'lucide-react';
import { useStoreHoursLabel, useStoreOpen } from '@/hooks/useStoreOpen';
import { cn } from '@/lib/cn';

/**
 * Faixa da loja no desktop. A marca e as ações (sacola, informações) já vivem
 * na barra do topo e no painel lateral do carrinho, então aqui fica só o
 * contexto: status, horário, área de entrega e a linha de apresentação.
 *
 * No mobile quem manda é o `StoreHeader` retrátil; este componente é
 * `hidden lg:flex`.
 */
export default function StoreStrip() {
  const storeOpen = useStoreOpen();
  const hoursLabel = useStoreHoursLabel();

  return (
    <div className="hidden flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-border/50 bg-background px-5 py-3.5 lg:flex">
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold',
          storeOpen
            ? 'bg-pistachio/60 text-pistachio-foreground'
            : 'bg-destructive/15 text-destructive',
        )}
      >
        <span
          className={cn(
            'size-1.5 rounded-full',
            storeOpen ? 'bg-pistachio-foreground' : 'bg-destructive',
          )}
        />
        {storeOpen ? 'Aberto agora' : 'Fechado'}
      </span>

      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <Clock className="size-3.5 shrink-0" aria-hidden="true" />
        {hoursLabel}
      </span>

      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
        Pereiro, CE · Entrega e retirada
      </span>

      <span className="hidden text-sm text-muted-foreground xl:inline">
        Cookies, pudins e salgados artesanais
      </span>
    </div>
  );
}
