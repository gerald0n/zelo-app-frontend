'use client';

import { WhatsappIcon } from '@/components/icons/WhatsappIcon';
import {
  buildOrderWhatsappLink,
  type WhatsappOrderInfo,
} from '@/lib/admin/whatsapp-notify';
import { cn } from '@/lib/cn';
import { useStoreBrandName } from '@/contexts/StoreBrandContext';

type Props = WhatsappOrderInfo & {
  /** `compact` cabe na fileira de ações do card do quadro. */
  variant?: 'full' | 'compact';
  className?: string;
};

/**
 * Botão "Avisar no WhatsApp" — abre o `wa.me` do cliente com a mensagem pronta.
 * Some sozinho quando o status não pede aviso ou não há telefone.
 */
export default function WhatsappNotifyButton({
  variant = 'full',
  className,
  ...order
}: Props) {
  const storeName = useStoreBrandName();
  const href = buildOrderWhatsappLink({ ...order, storeName: order.storeName ?? storeName });
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      className={cn(
        'flex items-center justify-center gap-1.5 rounded-md bg-whatsapp font-semibold text-whatsapp-foreground transition-colors hover:bg-whatsapp/90',
        variant === 'full' ? 'w-full py-2 text-xs' : 'flex-1 py-1.5 text-2xs',
        className,
      )}
    >
      <WhatsappIcon size={14} className="shrink-0" />
      Avisar no WhatsApp
    </a>
  );
}
