import { Archive, CircleCheck, TriangleAlert, PackageX } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { AdminCategory, AdminProduct } from '@/modules/admin/types';

type Props = {
  products: AdminProduct[];
  categories: AdminCategory[];
};

/** Faixa de indicadores do catálogo — no estilo do painel operacional. */
export function ProductStats({ products, categories }: Props) {
  const total = products.length;
  const available = products.filter((p) => p.isAvailable).length;
  const lowStock = products.filter(
    (p) =>
      p.stockQuantity != null && p.stockQuantity > 0 && p.stockQuantity <= 5,
  ).length;
  const outOfStock = products.filter((p) => p.stockQuantity === 0).length;
  const activeCategories = categories.filter((c) => c.isActive).length;
  const availablePct = total > 0 ? Math.round((available / total) * 100) : 0;

  const cards = [
    {
      label: 'Total de itens',
      value: String(total),
      hint: `${activeCategories} categorias ativas`,
      icon: Archive,
      tone: 'text-muted-foreground',
    },
    {
      label: 'Disponíveis',
      value: String(available),
      hint: `${availablePct}% do catálogo`,
      icon: CircleCheck,
      tone: 'text-success',
    },
    {
      label: 'Estoque baixo',
      value: String(lowStock),
      hint: 'Repor em breve',
      icon: TriangleAlert,
      tone: 'text-tone-warning-foreground',
    },
    {
      label: 'Esgotados',
      value: String(outOfStock),
      hint: 'Sem estoque agora',
      icon: PackageX,
      tone: 'text-destructive',
    },
  ];

  return (
    <>
      {/* Mobile: faixa compacta de 4 números — os cards cheios ocupavam ~280px
          de rolagem antes de aparecer o primeiro produto. */}
      <div className="flex divide-x divide-border rounded-xl border border-border bg-card lg:hidden">
        {cards.map((card) => (
          <div key={card.label} className="flex-1 px-2 py-2 text-center">
            <p className="font-serif text-lg font-bold leading-none">
              {card.value}
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">
              {card.label}
            </p>
          </div>
        ))}
      </div>

      <div className="hidden gap-2.5 lg:grid lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-border bg-card p-3.5"
          >
            <div className="flex items-start justify-between">
              <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                {card.label}
              </p>
              <card.icon className={cn('size-4', card.tone)} />
            </div>
            <p className="mt-2 font-serif text-2xl font-bold">{card.value}</p>
            <p className="mt-0.5 text-2xs text-muted-foreground">{card.hint}</p>
          </div>
        ))}
      </div>
    </>
  );
}
