'use client';

import Link from 'next/link';
import { ArrowLeft, MapPin } from 'lucide-react';
import { ProductThumb } from '@/components/product-thumb';
import { CatalogItemActions } from '@/components/CartQtyStepper';
import {
  categoryTone,
  formatCatalogPrice,
  type CatalogProduct,
} from '@/modules/catalog/types';
import { useCart } from '@/contexts/CartContext';
import { useCheckout } from '@/contexts/CheckoutContext';
import { useShopExperience } from '@/contexts/ShopExperienceContext';
import { pageHeaderBarClass, shellContentClass } from '@/lib/layout';
import { cn } from '@/lib/utils';

type Props = {
  locationId: string;
  locationName: string;
  addressLine: string;
  city: string;
  state: string;
  products: CatalogProduct[];
};

/**
 * Lote curado de "pronta entrega" (2-3 sabores, quantidade limitada) —
 * carrinho sempre exclusivo: adicionar um item aqui zera qualquer carrinho
 * de encomenda em andamento e marca o pedido como pronta entrega de São
 * Miguel, nunca misturando os dois fluxos.
 */
export default function ProntaEntregaClient({
  locationId,
  locationName,
  addressLine,
  city,
  state,
  products,
}: Props) {
  const { items, addItem, clearCart } = useCart();
  const { checkout, setFulfillmentLocation, setSatelliteLocationId } =
    useCheckout();
  const { notify } = useShopExperience();

  const addToCart = (product: CatalogProduct) => {
    if (!product.available) {
      notify(`${product.name} está indisponível no momento.`, 'error');
      return;
    }
    if (items.length > 0 && !checkout.prontaEntrega) {
      clearCart();
      notify('Seu carrinho de encomenda foi limpo para a pronta entrega.');
    }
    setFulfillmentLocation('sao_miguel', { prontaEntrega: true });
    setSatelliteLocationId(locationId);
    addItem(product, 1, []);
    notify(`${product.name} adicionado ao carrinho.`);
  };

  return (
    <div
      className={cn(
        'flex min-h-dvh w-full flex-col bg-background',
        shellContentClass,
      )}
    >
      <header className={cn(pageHeaderBarClass, 'gap-3 lg:px-0')}>
        <Link href="/" aria-label="Voltar ao cardápio">
          <ArrowLeft className="size-6" />
        </Link>
        <h1 className="text-lg font-semibold">Pronta entrega</h1>
        <span className="w-6" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pt-3 lg:px-0">
        <div className="mb-3 flex items-start gap-2 px-3 text-sm text-muted-foreground lg:px-0">
          <MapPin className="mt-0.5 size-4 shrink-0" />
          <p>
            Sabores prontos, quantidade limitada, retirada ou entrega em{' '}
            {locationName} · {addressLine}, {city}/{state}.
          </p>
        </div>

        {products.length === 0 ? (
          <div className="flex flex-col items-center gap-2.5 px-10 pt-12 text-center">
            <p className="text-sm text-muted-foreground">
              Sem pronta entrega disponível no momento. Volte mais tarde.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 px-3 lg:grid lg:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] lg:gap-3 lg:px-0">
            {products.map((product) => (
              <article
                key={product.id}
                className={cn(
                  'flex items-center gap-3 rounded-xl border border-border bg-card p-2.5',
                  !product.available && 'opacity-60',
                )}
              >
                <ProductThumb
                  tone={categoryTone(product.slug)}
                  src={product.image}
                  alt={product.imageAlt ?? product.name}
                  className="size-20 shrink-0 rounded-lg"
                  iconClassName="size-9"
                />
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-tight text-card-foreground">
                      {product.name}
                      {!product.available ? (
                        <span className="ml-2 text-xs font-medium text-muted-foreground">
                          Esgotado
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
                      {product.description}
                    </p>
                    <span className="mt-1.5 block font-serif text-base font-semibold tabular-nums text-primary">
                      {formatCatalogPrice(product.price)}
                    </span>
                  </div>
                  <CatalogItemActions
                    compact
                    productId={product.id}
                    productName={product.name}
                    quantity={items
                      .filter((item) => item.productId === product.id)
                      .reduce((sum, item) => sum + item.quantity, 0)}
                    available={product.available}
                    onAdd={() => addToCart(product)}
                  />
                </div>
              </article>
            ))}
          </div>
        )}
        <div className="h-10" />
      </div>
    </div>
  );
}
