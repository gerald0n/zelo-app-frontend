import { getPublicProductBySlugOrId } from '@/modules/catalog/catalog-repository';
import ProdutoClient from '@/components/ProdutoClient';

export const dynamic = 'force-dynamic';

export default async function ProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getPublicProductBySlugOrId(id);

  if (!product.ok) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6 text-center">
        <p className="text-sm text-muted-foreground">{product.error.message}</p>
      </div>
    );
  }

  if (!product.data) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <p>Produto não encontrado.</p>
      </div>
    );
  }

  return <ProdutoClient product={product.data} />;
}
