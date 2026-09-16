import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  matchesPromoBannerCategory,
  PROMO_BANNER_CATEGORY_PARAM,
} from '@/lib/promo-banner';
import type { CatalogCategory } from '@/modules/catalog/types';

/**
 * Sincroniza o filtro de categoria do cardápio com `?categoria=` (vindo do
 * banner promocional) e limpa a URL em seguida pra não travar o filtro.
 */
export function usePromoBannerCategoryFilter(
  categories: CatalogCategory[],
  setActive: (categoryId: string) => void,
) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const wanted = searchParams.get(PROMO_BANNER_CATEGORY_PARAM);
    if (!wanted) return;

    const match = categories.find((category) =>
      matchesPromoBannerCategory(category.name),
    );
    if (match) {
      setActive(match.id);
    }
    router.replace('/', { scroll: false });
  }, [searchParams, categories, router, setActive]);
}
