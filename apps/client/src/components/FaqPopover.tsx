'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { ChevronDown, CircleHelp, MessageCircle, X } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { catalogKeys } from '@/lib/query-keys';
import { FAQ_FALLBACK_ITEMS, type FaqItem } from '@/lib/faq-content';
import { buildSupportWhatsappLink } from '@/lib/support-whatsapp';
import { shouldHideCustomerNav } from '@/lib/layout';
import { cn } from '@/lib/utils';

function FaqAccordionItem({
  question,
  answer,
  open,
  onToggle,
}: {
  question: string;
  answer: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-border last:border-none">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 py-3 text-left text-sm font-medium text-foreground"
      >
        {question}
        <ChevronDown
          aria-hidden
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform duration-150',
            open && 'rotate-180',
          )}
        />
      </button>
      {open ? (
        <p className="pb-3 text-sm leading-relaxed text-muted-foreground">{answer}</p>
      ) : null}
    </div>
  );
}

export function FaqPopover() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);
  // Só uma pergunta aberta por vez — abrir outra fecha a anterior.
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqQuery = useQuery({
    queryKey: catalogKeys.faq(),
    queryFn: () => apiJson<{ items: FaqItem[] }>('/api/v1/catalog/faq'),
  });
  const items = faqQuery.data?.items.length
    ? faqQuery.data.items
    : FAQ_FALLBACK_ITEMS;

  if (shouldHideCustomerNav(pathname)) {
    return null;
  }

  const handleReportProblem = async () => {
    setSendingReport(true);
    try {
      const link = await buildSupportWhatsappLink(
        'Encontrei um problema no app e queria reportar.',
      );
      if (link) {
        window.open(link, '_blank');
        setOpen(false);
      }
    } finally {
      setSendingReport(false);
    }
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={open ? 'Fechar ajuda' : 'Abrir ajuda e perguntas frequentes'}
          className={cn(
            'fixed right-4 z-40 flex size-12 items-center justify-center rounded-full',
            'bg-primary text-primary-foreground shadow-lg shadow-black/15',
            'transition-transform duration-150 active:scale-95',
            'bottom-[calc(96px+env(safe-area-inset-bottom,0px))] lg:bottom-6',
          )}
        >
          {open ? (
            <X aria-hidden className="size-5" />
          ) : (
            <CircleHelp aria-hidden className="size-5" />
          )}
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="top"
          align="end"
          sideOffset={12}
          collisionPadding={16}
          className="z-40 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-4 shadow-xl outline-none"
        >
          <p className="font-serif text-lg font-semibold text-foreground">
            Perguntas frequentes
          </p>
          <div className="mt-1">
            {items.map((item, index) => (
              <FaqAccordionItem
                key={item.question}
                question={item.question}
                answer={item.answer}
                open={openIndex === index}
                onToggle={() =>
                  setOpenIndex((current) => (current === index ? null : index))
                }
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => void handleReportProblem()}
            disabled={sendingReport}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background py-2.5 text-sm font-semibold text-foreground disabled:opacity-60"
          >
            <MessageCircle aria-hidden className="size-4" />
            Reportar um problema
          </button>
          <PopoverPrimitive.Arrow className="fill-card" />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
