import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  matchesPromoBannerCategory,
  PROMO_BANNER_CATEGORY_PARAM,
  PROMO_BANNER_CATEGORY_QUERY,
} from '@/lib/promo-banner';
import type { CatalogCategory } from '@/modules/catalog/types';

/**
 * Sincroniza o filtro de categoria do cardápio com `?categoria=<id>` (vindo
 * de um banner ou push configurado no admin via `RouteLinkCombobox`) e
 * limpa a URL em seguida pra não travar o filtro. Ao achar a categoria,
 * também rola até o início da lista filtrada.
 */
export function useCategoryQueryFilter(
  categories: CatalogCategory[],
  setActive: (categoryId: string) => void,
) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const wanted = searchParams.get(PROMO_BANNER_CATEGORY_PARAM);
    if (!wanted) return;

    const match =
      categories.find((category) => category.id === wanted) ??
      // Compat com a arte fixa antiga do banner modal (`/?categoria=esfirras`,
      // por nome em vez de id) — só usada nesse valor legado específico.
      (wanted === PROMO_BANNER_CATEGORY_QUERY
        ? categories.find((category) =>
            matchesPromoBannerCategory(category.name),
          )
        : undefined);

    if (match) {
      setActive(match.id);
      // Já existe sempre na página (só o texto muda com a categoria ativa),
      // então não precisa esperar o filtro re-renderizar pra rolar até lá.
      document
        .getElementById('menu-heading')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    router.replace('/', { scroll: false });
  }, [searchParams, categories, router, setActive]);
}
