'use client';

import { useEffect, useState } from 'react';
import { Popover } from 'radix-ui';
import { useQuery } from '@tanstack/react-query';
import { type UseFormReturn, useWatch } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { apiJson } from '@/lib/api';
import { formatPhoneDisplay } from '@/lib/phone';
import { adminKeys } from '@/lib/query-keys';
import type { ManualOrderForm } from '@/app/pedidos/novo/nova-comanda-form';

type AdminCustomerListItem = {
  id: string;
  name: string | null;
  phoneE164: string | null;
  email: string | null;
  createdAt: string;
};

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Nome do cliente na comanda manual — continua um input de texto livre (dá
 * pra digitar um nome novo, sem cadastro), mas sugere clientes já
 * cadastrados num popover enquanto o admin digita. Selecionar um preenche
 * nome + telefone; a vinculação por telefone em si já é feita no banco por
 * `create_manual_order`, aqui é só conveniência pra não redigitar tudo.
 */
export function CustomerCombobox({
  form,
  className,
}: {
  form: UseFormReturn<ManualOrderForm>;
  className?: string;
}) {
  const [focused, setFocused] = useState(false);
  const guestName = useWatch({ control: form.control, name: 'guestName' });
  const debouncedQuery = useDebouncedValue(guestName?.trim() ?? '', 250);

  const searchQuery = useQuery({
    queryKey: adminKeys.customerSearch(debouncedQuery),
    queryFn: () =>
      apiJson<{ customers: AdminCustomerListItem[] }>(
        `/api/v1/admin/customers?q=${encodeURIComponent(debouncedQuery)}`,
      ),
    enabled: debouncedQuery.length >= 2,
  });

  const results = searchQuery.data?.customers ?? [];
  const open = focused && debouncedQuery.length >= 2 && results.length > 0;

  const selectCustomer = (customer: AdminCustomerListItem) => {
    form.setValue('guestName', customer.name ?? '', { shouldValidate: true });
    if (customer.phoneE164) {
      form.setValue('guestPhone', formatPhoneDisplay(customer.phoneE164), {
        shouldValidate: true,
      });
      form.setValue('noGuestPhone', false);
    }
    setFocused(false);
  };

  return (
    <Popover.Root open={open}>
      <Popover.Anchor asChild>
        <Input
          {...form.register('guestName')}
          className={className}
          autoComplete="off"
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // Delay pra deixar o clique num resultado registrar antes do fechamento.
            setTimeout(() => setFocused(false), 150);
          }}
        />
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="z-50 max-h-56 w-[var(--radix-popover-trigger-width)] overflow-auto rounded-lg border border-border bg-card p-1 shadow-lg"
        >
          {results.map((customer) => (
            <button
              key={customer.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectCustomer(customer)}
              className="flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted"
            >
              <span className="font-semibold">
                {customer.name || 'Sem nome'}
              </span>
              <span className="text-2xs text-muted-foreground">
                {customer.phoneE164 ? formatPhoneDisplay(customer.phoneE164) : ''}
              </span>
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
