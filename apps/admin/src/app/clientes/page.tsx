'use client';

import { useState } from 'react';
import Link from 'next/link';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { adminContainerClass } from '@/lib/layout';
import { cn } from '@/lib/cn';
import { Input } from '@/components/ui/input';
import { apiJson } from '@/lib/api';
import { formatPhoneDisplay } from '@/lib/phone';
import { adminKeys } from '@/lib/query-keys';

type AdminCustomerListItem = {
  id: string;
  name: string | null;
  phoneE164: string | null;
  email: string | null;
  createdAt: string;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function AdminClientesPage() {
  const { ready, isAuthenticated } = useRequireAdmin();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const isSearching = q.trim().length >= 2;

  const searchQuery = useQuery({
    queryKey: adminKeys.customerSearch(q.trim()),
    enabled: ready && isAuthenticated && isSearching,
    queryFn: () =>
      apiJson<{ customers: AdminCustomerListItem[] }>(
        `/api/v1/admin/customers?q=${encodeURIComponent(q.trim())}`,
      ),
  });

  const listQuery = useQuery({
    queryKey: adminKeys.customers(page),
    enabled: ready && isAuthenticated && !isSearching,
    placeholderData: keepPreviousData,
    queryFn: () =>
      apiJson<{
        customers: AdminCustomerListItem[];
        total: number;
        page: number;
        pageSize: number;
      }>(`/api/v1/admin/customers?page=${page}`),
  });

  const customers = isSearching
    ? (searchQuery.data?.customers ?? [])
    : (listQuery.data?.customers ?? []);
  const isLoading = isSearching ? searchQuery.isLoading : listQuery.isLoading;
  const isError = isSearching ? searchQuery.isError : listQuery.isError;
  const total = listQuery.data?.total ?? 0;
  const pageSize = listQuery.data?.pageSize ?? 30;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (!ready || !isAuthenticated) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'min-h-dvh space-y-4 p-3.5 pb-24 md:px-6 md:pt-6',
        adminContainerClass,
      )}
    >
      <header>
        <p className="text-2xs font-bold uppercase tracking-widest text-primary">
          Cadastro
        </p>
        <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight">
          Clientes
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Clientes com conta no app — criada automaticamente no primeiro
          pedido/login. Busque por nome ou telefone.
        </p>
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Nome ou telefone"
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <p className="py-16 text-center text-sm text-destructive">
          Não foi possível carregar os clientes.
        </p>
      ) : customers.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          {isSearching
            ? 'Nenhum cliente encontrado com essa busca.'
            : 'Nenhum cliente cadastrado ainda.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-2xs font-bold uppercase tracking-wide text-muted-foreground">
                <th className="px-3.5 py-2.5">Nome</th>
                <th className="px-3.5 py-2.5">Telefone</th>
                <th className="px-3.5 py-2.5">Cadastrado em</th>
                <th className="px-3.5 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr
                  key={customer.id}
                  className="border-b border-border last:border-b-0"
                >
                  <td className="px-3.5 py-2.5">
                    <p className="max-w-[14rem] truncate font-semibold">
                      {customer.name || 'Sem nome'}
                    </p>
                  </td>
                  <td className="px-3.5 py-2.5 text-muted-foreground">
                    {customer.phoneE164
                      ? formatPhoneDisplay(customer.phoneE164)
                      : '—'}
                  </td>
                  <td className="px-3.5 py-2.5 text-muted-foreground">
                    {formatDate(customer.createdAt)}
                  </td>
                  <td className="px-3.5 py-2.5 text-right">
                    {customer.phoneE164 ? (
                      <Link
                        href={`/historico?q=${encodeURIComponent(customer.phoneE164)}`}
                        className="text-xs font-semibold text-primary underline"
                      >
                        Ver pedidos
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isSearching && total > 0 ? (
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>
            {total} {total === 1 ? 'cliente cadastrado' : 'clientes cadastrados'}
          </p>
          {totalPages > 1 ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 font-semibold transition-colors hover:bg-accent disabled:opacity-40"
              >
                <ChevronLeft className="size-3.5" />
                Anterior
              </button>
              <span>
                Página {page} de {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 font-semibold transition-colors hover:bg-accent disabled:opacity-40"
              >
                Próxima
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
