'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Heart,
  Minus,
  Plus,
  Check,
  ChevronRight,
} from 'lucide-react';
import {
  categoryTone,
  formatCatalogPrice,
  type CatalogAddon,
  type CatalogProduct,
} from '@/modules/catalog/types';
import { ProductThumb } from '@/components/product-thumb';
import { Textarea } from '@/components/ui/textarea';
import { useCart } from '@/contexts/CartContext';
import { useShopExperience } from '@/contexts/ShopExperienceContext';
import { mobilePageColumnClass } from '@/lib/layout';
import { cn } from '@/lib/utils';

export default function ProdutoClient({
  product,
}: {
  product: CatalogProduct;
}) {
  const router = useRouter();
  const { addItem, items } = useCart();
  const { favorites, toggleFavorite, notify } = useShopExperience();

  const [quantity, setQuantity] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState<CatalogAddon[]>([]);
  const [note, setNote] = useState('');

  const productItems = items.filter((item) => item.productId === product.id);
  const quantityInCart = productItems.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  const valueInCart = productItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  const toggleAddon = (addon: CatalogAddon) => {
    if (!addon.isAvailable) return;
    setSelectedAddons((prev) =>
      prev.find((a) => a.id === addon.id)
        ? prev.filter((a) => a.id !== addon.id)
        : [...prev, addon],
    );
  };

  const addonTotal = selectedAddons.reduce((s, a) => s + a.price, 0);
  const unitPrice = product.price + addonTotal;
  const total = unitPrice * quantity;
  const isFavorite = favorites.has(product.id);

  const handleAdd = () => {
    if (!product.available) return;
    addItem(product, quantity, selectedAddons, note || undefined);
    notify(`${quantity}× ${product.name} adicionado ao carrinho.`);
    router.push('/');
  };

  return (
    <div
      className={cn(
        'mx-auto flex min-h-dvh flex-col bg-background lg:max-w-5xl lg:flex-row lg:gap-6 lg:px-5 lg:py-5',
        mobilePageColumnClass,
      )}
    >
      <div className="relative h-[220px] shrink-0 lg:sticky lg:top-6 lg:h-[380px] lg:w-[380px] lg:self-start lg:overflow-hidden lg:rounded-2xl">
        <ProductThumb
          tone={categoryTone(product.slug)}
          src={product.image}
          alt={product.imageAlt ?? product.name}
          className="h-full w-full rounded-none"
          iconClassName="size-16"
        />
        <Link
          href="/"
          aria-label="Voltar ao cardápio"
          className="absolute left-3 top-3 flex size-9 items-center justify-center rounded-full bg-background shadow-md"
        >
          <ArrowLeft className="size-[22px]" />
        </Link>
        <button
          type="button"
          aria-label={
            isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'
          }
          onClick={() => toggleFavorite(product.id, product.name)}
          className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-background shadow-md"
        >
          <Heart
            className={cn(
              'size-[21px]',
              isFavorite ? 'fill-primary text-primary' : 'text-foreground',
            )}
          />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:min-w-0">
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4 pb-24 lg:overflow-visible lg:p-0 lg:pb-0">
          <h1 className="text-xl font-bold tracking-[-0.4px]">
            {product.name}
          </h1>
          {product.weight ? (
            <p className="text-sm text-muted-foreground">
              {product.weight}
            </p>
          ) : null}
          <p className="mt-1 text-base leading-[22px] text-muted-foreground">
            {product.description}
          </p>
          <p className="mt-1.5 text-xl font-bold">
            {formatCatalogPrice(product.price)}
          </p>

          {quantityInCart > 0 ? (
            <Link
              href="/carrinho"
              className="mt-3 flex items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/[0.05] p-3"
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-primary">
                <Check className="size-[15px] text-white" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold">
                  {quantityInCart}{' '}
                  {quantityInCart === 1 ? 'unidade' : 'unidades'} no carrinho
                </p>
                <p className="mt-0.5 text-2xs text-muted-foreground">
                  Total deste produto: {formatCatalogPrice(valueInCart)}
                </p>
              </div>
              <ChevronRight className="size-[17px] text-primary" />
            </Link>
          ) : null}

          {product.addons.length > 0 ? (
            <div className="mt-4 space-y-2.5">
              <h2 className="mb-1 text-base font-semibold">Adicionais</h2>
              {product.addons.map((addon) => {
                const checked = !!selectedAddons.find((a) => a.id === addon.id);
                const disabled = !addon.isAvailable;
                return (
                  <button
                    key={addon.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleAddon(addon)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border p-3 text-left',
                      checked
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card',
                      disabled && 'opacity-45',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-[22px] items-center justify-center rounded-md border-[1.5px]',
                        checked
                          ? 'border-primary bg-primary'
                          : 'border-border bg-transparent',
                      )}
                    >
                      {checked ? (
                        <Check className="size-3.5 text-white" />
                      ) : null}
                    </span>
                    <span className="flex-1 text-sm">{addon.name}</span>
                    <span className="text-sm font-medium text-muted-foreground">
                      {addon.price === 0
                        ? 'Grátis'
                        : `+ ${formatCatalogPrice(addon.price)}`}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="mt-4 space-y-2.5">
            <h2 className="text-base font-semibold">
              Observação{' '}
              <span className="text-xs font-normal text-muted-foreground">
                (opcional)
              </span>
            </h2>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 180))}
              placeholder="Ex.: retirar embalagem de presente"
              rows={3}
              className="min-h-[88px] w-full resize-none rounded-lg border border-border bg-card p-3 text-sm outline-none focus:border-primary"
            />
            <p className="text-right text-2xs text-muted-foreground">
              {note.length}/180
            </p>
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2.5 border-t border-border bg-background px-3 pb-4 pt-2.5 lg:static lg:mt-4 lg:rounded-xl lg:border lg:bg-card lg:p-3 lg:shadow-sm">
          <div className="flex items-center overflow-hidden rounded-md border border-border">
            <button
              type="button"
              aria-label="Diminuir"
              className="p-2"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            >
              <Minus className="size-5" />
            </button>
            <span className="px-3.5 text-base font-semibold">{quantity}</span>
            <button
              type="button"
              aria-label="Aumentar"
              className="p-2"
              onClick={() => setQuantity((q) => q + 1)}
            >
              <Plus className="size-5" />
            </button>
          </div>
          <button
            type="button"
            disabled={!product.available}
            onClick={handleAdd}
            className={cn(
              'flex-1 rounded-md py-2.5 text-center text-sm font-semibold',
              product.available
                ? 'bg-primary text-white'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {product.available
              ? `Adicionar · ${formatCatalogPrice(total)}`
              : 'Indisponível'}
          </button>
        </div>
      </div>
    </div>
  );
}
