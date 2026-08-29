import { listPublicProducts } from '@/modules/catalog/catalog-repository';
import BuscaClient from '@/components/BuscaClient';

export const dynamic = 'force-dynamic';

export default async function BuscaPage() {
  const products = await listPublicProducts();

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
