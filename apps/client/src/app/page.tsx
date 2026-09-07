import HomeCatalog from '@/components/HomeCatalog';
import { getPublicCatalog } from '@/modules/catalog/catalog-repository';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const catalog = await getPublicCatalog();

  if (!catalog.ok) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="font-serif text-2xl font-semibold">Cardápio</h1>
        <p className="text-sm text-muted-foreground">{catalog.error.message}</p>
        <p className="text-xs text-muted-foreground">
          Verifique se o Supabase local está rodando (`pnpm db:start`) e se
          `.env.local` está preenchido.
        </p>
      </div>
    );
  }

  const categoryNames = Object.fromEntries(
    catalog.data.categories.map((category) => [category.id, category.name]),
  );

  return (
    <HomeCatalog
      categories={catalog.data.categories}
      products={catalog.data.products}
      categoryNames={categoryNames}
    />
  );
}
