import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

type Props = {
  products: Array<{ name: string; quantity: number }>;
};

/** Produtos mais vendidos no período — por unidades saídas. */
export function TopProducts({ products }: Props) {
  const topQty = products[0]?.quantity ?? 1;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-serif text-base font-bold">Mais vendidos</h2>
          <p className="mt-0.5 text-2xs text-muted-foreground">
            Por unidades saídas no período
          </p>
        </div>
        <Link
          href="/admin/catalogo"
          aria-label="Abrir catálogo"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <ExternalLink className="size-4" />
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="mt-4 text-2xs text-muted-foreground">
          Nenhuma venda registrada.
        </p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {products.map((product, index) => (
            <li key={product.name} className="flex items-center gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-2xs font-bold tabular-nums">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">{product.name}</p>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(product.quantity / topQty) * 100}%` }}
                  />
                </div>
              </div>
              <span className="shrink-0 text-2xs font-semibold tabular-nums text-muted-foreground">
                {product.quantity} un
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
