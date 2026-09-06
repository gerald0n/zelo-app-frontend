import 'server-only';

// Fachada do módulo de catálogo do admin. O código real vive em ./catalog/*,
// dividido por entidade (categorias, produtos, adicionais, loja). Este barrel
// preserva a interface pública: quem importava '@/modules/admin/catalog'
// continua funcionando sem mudança.

export type {
  AdminAddon,
  AdminBlackout,
  AdminCategory,
  AdminProduct,
} from '@/modules/admin/types';

export * from '@/modules/admin/catalog/categories';
export * from '@/modules/admin/catalog/products';
export * from '@/modules/admin/catalog/product-images';
export * from '@/modules/admin/catalog/addons';
export * from '@/modules/admin/catalog/store';
export * from '@/modules/admin/catalog/store-hours';
