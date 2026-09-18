import Link from 'next/link';
import { Plus } from 'lucide-react';
import { listStores } from '@/modules/gestor/stores';

export default async function LojasPage() {
  const result = await listStores();

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Lojas</h1>
        <Link
          href="/lojas/nova"
          className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="size-4" />
          Nova loja
        </Link>
      </div>

      {!result.ok ? (
        <p className="text-sm text-destructive">{result.error.message}</p>
      ) : result.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma loja cadastrada ainda.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {result.data.map((store) => (
            <li key={store.id}>
              <Link
                href={`/lojas/${store.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted"
              >
                <div>
                  <p className="text-sm font-semibold">{store.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {store.city} · {store.state}
                    {store.domain ? ` · ${store.domain}` : ''}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {store.phoneE164}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
