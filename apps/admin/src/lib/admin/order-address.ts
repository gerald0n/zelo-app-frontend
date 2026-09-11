/** Formatação dos endereços de pedido para as telas do admin. */

type AddressParts = {
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  complement: string | null;
};

/** Linha completa: "Rua, 123 – Bairro, Cidade/UF · Complemento". */
export function formatAddress(parts: AddressParts): string {
  const base = parts.neighborhood
    ? `${parts.street}, ${parts.number} – ${parts.neighborhood}, ${parts.city}/${parts.state}`
    : `${parts.street}, ${parts.number} – ${parts.city}/${parts.state}`;
  return parts.complement ? `${base} · ${parts.complement}` : base;
}

type RawAddress =
  | {
      street: string;
      number: string | null;
      neighborhood: string | null;
    }
  | null
  | undefined;

/** Linha curta para os cards do quadro: "Bairro · Rua, 123". */
export function shortDeliveryAddress(parts: NonNullable<RawAddress>): string {
  return [
    parts.neighborhood,
    [parts.street, parts.number].filter(Boolean).join(', '),
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Resumo do endereço para os cards da lista — `null` fora de delivery. */
export function deliveryAddressSummary(
  deliveryMethod: string,
  addr: RawAddress,
) {
  if (deliveryMethod !== 'delivery' || !addr?.street) return null;
  return {
    street: addr.street,
    number: addr.number ?? '',
    neighborhood: addr.neighborhood ?? '',
    short: shortDeliveryAddress(addr),
  };
}
