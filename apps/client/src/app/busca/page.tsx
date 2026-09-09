import { listCachedPublicProducts } from '@/modules/catalog/cached-catalog';
import BuscaClient from '@/components/BuscaClient';

export const dynamic = 'force-dynamic';

export default async function BuscaPage() {
  const products = await listCachedPublicProducts();

  if (!products.ok) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-sm text-muted-foreground">
          {products.error.message}
        </p>
      </div>
    );
  }

  return <BuscaClient products={products.data} />;
}
