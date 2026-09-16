'use client';

import { useMemo, useState } from 'react';
import { Popover } from 'radix-ui';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { apiJson } from '@/lib/api';
import { adminKeys } from '@/lib/query-keys';
import type { CatalogResponse } from '@/app/catalogo/catalog-forms';

type LinkOption = {
  href: string;
  label: string;
  group: 'Páginas' | 'Categorias' | 'Produtos';
};

/** Prefixo do query param que filtra o cardápio por categoria (ver `useCategoryQueryFilter`). */
const CATEGORY_QUERY_PREFIX = '/?categoria=';

/** Páginas fixas do client que um link pode apontar. */
const STATIC_PAGES: LinkOption[] = [
  { href: '', label: 'Nenhum (sem link)', group: 'Páginas' },
  { href: '/', label: 'Cardápio (início)', group: 'Páginas' },
  { href: '/busca', label: 'Busca', group: 'Páginas' },
  { href: '/loja', label: 'Loja / horários', group: 'Páginas' },
  { href: '/pronta-entrega', label: 'Pronta-entrega', group: 'Páginas' },
  { href: '/favoritos', label: 'Favoritos', group: 'Páginas' },
  { href: '/conta', label: 'Minha conta', group: 'Páginas' },
  { href: '/pedidos', label: 'Meus pedidos', group: 'Páginas' },
];

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * Select com busca pra link ao tocar (banner, push notification, etc.): em
 * vez de input livre, lista as rotas que o client realmente navega (páginas
 * fixas + produtos do catálogo), pra evitar link quebrado por erro de
 * digitação.
 */
export function RouteLinkCombobox({
  value,
  onChange,
  placeholder = 'Link ao tocar (opcional) — busque uma página, categoria ou produto',
  className,
}: {
  value: string;
  onChange: (href: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const catalogQuery = useQuery({
    queryKey: adminKeys.catalog(),
    queryFn: () => apiJson<CatalogResponse>('/api/v1/admin/catalog'),
    staleTime: 60_000,
  });

  const options = useMemo<LinkOption[]>(() => {
    // Filtra o cardápio pra essa categoria e rola até o início da lista
    // (ver useCategoryQueryFilter no client).
    const categories: LinkOption[] = (catalogQuery.data?.categories ?? []).map(
      (category) => ({
        href: `${CATEGORY_QUERY_PREFIX}${category.id}`,
        label: category.name,
        group: 'Categorias',
      }),
    );
    const products: LinkOption[] = (catalogQuery.data?.products ?? []).map(
      (product) => ({
        href: `/produto/${product.id}`,
        label: `${product.name} (${product.categoryName})`,
        group: 'Produtos',
      }),
    );
    return [...STATIC_PAGES, ...categories, ...products];
  }, [catalogQuery.data]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    const base = q
      ? options.filter(
          (option) =>
            normalize(option.label).includes(q) ||
            normalize(option.href).includes(q),
        )
      : options;
    return base.slice(0, 30);
  }, [options, query]);

  const select = (option: LinkOption) => {
    onChange(option.href);
    setQuery('');
    setOpen(false);
  };

  let lastGroup: string | null = null;

  return (
    <Popover.Root open={open}>
      <Popover.Anchor asChild>
        <Input
          // Enquanto aberto, o campo é só a busca — o valor real (href) só
          // muda ao escolher uma opção da lista, nunca pelo texto digitado.
          value={open ? query : (options.find((o) => o.href === value)?.label ?? value)}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            setQuery('');
            setOpen(true);
          }}
          onBlur={() => {
            // Delay pra deixar o clique numa opção registrar antes do fechamento.
            setTimeout(() => setOpen(false), 150);
          }}
          placeholder={placeholder}
          className={className}
          autoComplete="off"
        />
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="z-50 max-h-64 w-[var(--radix-popover-trigger-width)] overflow-auto rounded-lg border border-border bg-card p-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <p className="px-2 py-1.5 text-2xs text-muted-foreground">
              Nenhum resultado.
            </p>
          ) : (
            filtered.map((option) => {
              const showGroupLabel = option.group !== lastGroup;
              lastGroup = option.group;
              return (
                <div key={option.href}>
                  {showGroupLabel ? (
                    <p className="px-2 pb-0.5 pt-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {option.group}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => select(option)}
                    className="flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted"
                  >
                    <span className="font-medium">{option.label}</span>
                    <span className="text-2xs text-muted-foreground">
                      {option.href}
                    </span>
                  </button>
                </div>
              );
            })
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
