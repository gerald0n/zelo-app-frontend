'use client';

import { LayoutGrid, List, Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';

export type ProductStatusFilter = 'all' | 'available' | 'paused' | 'low';
export type ProductSort = 'name' | 'price-desc' | 'price-asc' | 'stock-asc';
export type ProductView = 'grid' | 'list';

type Props = {
  query: string;
  onQuery: (value: string) => void;
  status: ProductStatusFilter;
  onStatus: (value: ProductStatusFilter) => void;
  sort: ProductSort;
  onSort: (value: ProductSort) => void;
  view: ProductView;
  onView: (value: ProductView) => void;
  onNew: () => void;
};

const selectClass =
  'h-9 rounded-md border border-border bg-card px-2.5 text-xs font-semibold text-foreground outline-none focus-visible:border-ring';

export function ProductToolbar({
  query,
  onQuery,
  status,
  onStatus,
  sort,
  onSort,
  view,
  onView,
  onNew,
}: Props) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-2.5 lg:flex-row lg:items-center">
      <div className="flex h-9 flex-1 items-center gap-2 rounded-md border border-border px-3">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Buscar produto, categoria ou descrição"
          className="h-auto border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => onStatus(e.target.value as ProductStatusFilter)}
          className={selectClass}
          aria-label="Filtrar por status"
        >
          <option value="all">Status: Todos</option>
          <option value="available">Disponíveis</option>
          <option value="paused">Pausados</option>
          <option value="low">Estoque baixo</option>
        </select>

        <select
          value={sort}
          onChange={(e) => onSort(e.target.value as ProductSort)}
          className={selectClass}
          aria-label="Ordenar"
        >
          <option value="name">Ordenar: Nome</option>
          <option value="price-desc">Maior preço</option>
          <option value="price-asc">Menor preço</option>
          <option value="stock-asc">Menor estoque</option>
        </select>

        <div className="flex overflow-hidden rounded-md border border-border">
          {(['grid', 'list'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onView(mode)}
              aria-pressed={view === mode}
              aria-label={mode === 'grid' ? 'Grade' : 'Lista'}
              className={cn(
                'flex size-9 items-center justify-center transition-colors',
                view === mode
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground hover:bg-accent',
              )}
            >
              {mode === 'grid' ? (
                <LayoutGrid className="size-4" />
              ) : (
                <List className="size-4" />
              )}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onNew}
          className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="size-4" />
          Novo produto
        </button>
      </div>
    </div>
  );
}
