import { useMemo, useState } from 'react';
import type {
  CatalogPizzaAddon,
  CatalogPizzaSize,
  CatalogProduct,
} from '@/modules/catalog/types';
import { useCart } from '@/contexts/CartContext';
import { useShopExperience } from '@/contexts/ShopExperienceContext';
import { flavorPriceCents } from '@/lib/pizza';
import type { PizzaSummaryLine } from '@/components/PizzaSummary';

export type PizzaSlotId = 'flavor1' | 'flavor2';
type SlotState = { flavorId: string | undefined; addonIds: string[] };

const EMPTY_SLOT: SlotState = { flavorId: undefined, addonIds: [] };

/** Todo o estado e as regras de preço do construtor de pizza — a UI só lê o resultado. */
export function usePizzaBuilder({
  flavors,
  sizes,
  addons,
  onDone,
}: {
  flavors: CatalogProduct[];
  sizes: CatalogPizzaSize[];
  addons: CatalogPizzaAddon[];
  onDone: () => void;
}) {
  const { addPizzaItem } = useCart();
  const { notify } = useShopExperience();

  const [sizeId, setSizeId] = useState<string | undefined>(
    sizes.length >= 1 ? sizes[0].id : undefined,
  );
  const [mode, setModeState] = useState<1 | 2>(1);
  const [slots, setSlots] = useState<Record<PizzaSlotId, SlotState>>({
    flavor1: EMPTY_SLOT,
    flavor2: EMPTY_SLOT,
  });
  const [activeSlot, setActiveSlotState] = useState<PizzaSlotId | null>(null);
  const [modalKey, setModalKey] = useState(0);
  const [note, setNote] = useState('');
  const [quantity, setQuantity] = useState(1);

  const size = useMemo(
    () => sizes.find((s) => s.id === sizeId),
    [sizes, sizeId],
  );
  const flavor1 = useMemo(
    () => flavors.find((f) => f.id === slots.flavor1.flavorId),
    [flavors, slots.flavor1.flavorId],
  );
  const flavor2 = useMemo(
    () => flavors.find((f) => f.id === slots.flavor2.flavorId),
    [flavors, slots.flavor2.flavorId],
  );

  const setMode = (next: 1 | 2) => {
    setModeState(next);
    if (next === 1) setSlots((prev) => ({ ...prev, flavor2: EMPTY_SLOT }));
  };

  const openSlot = (slot: PizzaSlotId) => {
    setActiveSlotState(slot);
    setModalKey((k) => k + 1);
  };
  const closeSlot = () => setActiveSlotState(null);

  const selectFlavorForSlot = (slot: PizzaSlotId, flavorId: string) => {
    setSlots((prev) => ({ ...prev, [slot]: { ...prev[slot], flavorId } }));
  };

  const toggleAddonForSlot = (slot: PizzaSlotId, addonId: string) => {
    setSlots((prev) => {
      const current = prev[slot];
      const has = current.addonIds.includes(addonId);
      return {
        ...prev,
        [slot]: {
          ...current,
          addonIds: has
            ? current.addonIds.filter((id) => id !== addonId)
            : [...current.addonIds, addonId],
        },
      };
    });
  };

  const clearAddonsForSlot = (slot: PizzaSlotId) => {
    setSlots((prev) => ({ ...prev, [slot]: { ...prev[slot], addonIds: [] } }));
  };

  const addonPriceForSlot = (addon: CatalogPizzaAddon) =>
    mode === 2 ? addon.priceHalfCents : addon.priceFullCents;

  const addonsTotalForSlot = (slot: PizzaSlotId) =>
    slots[slot].addonIds.reduce((sum, addonId) => {
      const addon = addons.find((a) => a.id === addonId);
      return addon ? sum + addonPriceForSlot(addon) : sum;
    }, 0);

  const price1 = size && flavor1 ? flavorPriceCents(flavor1, size.id) : 0;
  const price2 = size && flavor2 ? flavorPriceCents(flavor2, size.id) : 0;
  const canAdd = Boolean(size && flavor1 && (mode === 1 || flavor2));
  const basePrice = mode === 2 ? Math.round((price1 + price2) / 2) : price1;
  const addonsTotal =
    addonsTotalForSlot('flavor1') +
    (mode === 2 ? addonsTotalForSlot('flavor2') : 0);
  const totalCents = (basePrice + addonsTotal) * quantity;

  const summaryLines = buildSummaryLines({
    mode,
    flavor1,
    flavor2,
    price1,
    price2,
    slots,
    addons,
    addonPriceForSlot,
  });

  const handleAdd = () => {
    if (!size || !flavor1) return;
    if (mode === 2 && !flavor2) return;

    addPizzaItem({
      product: flavor1,
      secondaryProduct: mode === 2 ? flavor2 : undefined,
      size,
      quantity,
      selectedPizzaAddons: buildSelectedAddons({ mode, slots, addons }),
      note: note || undefined,
    });

    const name = flavor2 ? `${flavor1.name} / ${flavor2.name}` : flavor1.name;
    notify(`${quantity}× Pizza ${name} adicionada ao carrinho.`);
    onDone();
  };

  return {
    sizeId,
    setSizeId,
    size,
    mode,
    setMode,
    flavor1,
    flavor2,
    activeSlot,
    modalKey,
    openSlot,
    closeSlot,
    slots,
    selectFlavorForSlot,
    toggleAddonForSlot,
    clearAddonsForSlot,
    addonPriceForSlot,
    note,
    setNote,
    quantity,
    setQuantity,
    canAdd,
    totalCents,
    summaryLines,
    handleAdd,
  };
}

function buildSummaryLines({
  mode,
  flavor1,
  flavor2,
  price1,
  price2,
  slots,
  addons,
  addonPriceForSlot,
}: {
  mode: 1 | 2;
  flavor1: CatalogProduct | undefined;
  flavor2: CatalogProduct | undefined;
  price1: number;
  price2: number;
  slots: Record<PizzaSlotId, SlotState>;
  addons: CatalogPizzaAddon[];
  addonPriceForSlot: (addon: CatalogPizzaAddon) => number;
}): PizzaSummaryLine[] {
  const addonLines = (slot: PizzaSlotId, suffix: string) =>
    slots[slot].addonIds.map((addonId) => {
      const addon = addons.find((a) => a.id === addonId);
      return {
        key: `${slot}-addon-${addonId}`,
        label: `+ ${addon?.name ?? ''}${suffix}`,
        priceCents: addon ? addonPriceForSlot(addon) : undefined,
      };
    });

  const lines: PizzaSummaryLine[] = [
    {
      key: 'flavor1',
      label:
        mode === 2
          ? `Sabor 1: ${flavor1?.name ?? 'escolha o sabor'}`
          : (flavor1?.name ?? 'Escolha o sabor'),
      priceCents: flavor1 ? price1 : undefined,
      muted: !flavor1,
    },
    ...addonLines('flavor1', mode === 2 ? ' (sabor 1)' : ''),
  ];

  if (mode === 2) {
    lines.push(
      {
        key: 'flavor2',
        label: `Sabor 2: ${flavor2?.name ?? 'escolha o sabor'}`,
        priceCents: flavor2 ? price2 : undefined,
        muted: !flavor2,
      },
      ...addonLines('flavor2', ' (sabor 2)'),
    );
  }

  return lines;
}

function buildSelectedAddons({
  mode,
  slots,
  addons,
}: {
  mode: 1 | 2;
  slots: Record<PizzaSlotId, SlotState>;
  addons: CatalogPizzaAddon[];
}) {
  const fromSlot = (
    slot: PizzaSlotId,
    appliesTo: 'whole' | 'flavor1' | 'flavor2',
  ) =>
    slots[slot].addonIds
      .map((addonId) => addons.find((a) => a.id === addonId))
      .filter((addon): addon is CatalogPizzaAddon => addon !== undefined)
      .map((addon) => ({ addon, appliesTo }));

  return mode === 2
    ? [...fromSlot('flavor1', 'flavor1'), ...fromSlot('flavor2', 'flavor2')]
    : fromSlot('flavor1', 'whole');
}
