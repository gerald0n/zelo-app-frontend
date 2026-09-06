export type ToastKind =
  | 'cart-add'
  | 'cart-remove'
  | 'favorite-add'
  | 'favorite-remove'
  | 'generic';

export type ToastItem = {
  id: string;
  type: 'success' | 'error';
  kind: ToastKind;
  count: number;
  names: string[];
  message: string;
};

export function parseNotify(message: string): {
  kind: ToastKind;
  count: number;
  names: string[];
} {
  let match = message.match(/^(?:(\d+)× )?(.+) adicionado ao carrinho\.$/);
  if (match) {
    return {
      kind: 'cart-add',
      count: match[1] ? Number(match[1]) : 1,
      names: [],
    };
  }
  match = message.match(/^(.+) adicionado aos favoritos\.$/);
  if (match) return { kind: 'favorite-add', count: 1, names: [match[1]] };
  match = message.match(/^(.+) removido dos favoritos\.$/);
  if (match) return { kind: 'favorite-remove', count: 1, names: [match[1]] };
  match = message.match(/^(?:(\d+)× )?(.+) removido do carrinho\.$/);
  if (match) {
    return {
      kind: 'cart-remove',
      count: match[1] ? Number(match[1]) : 1,
      names: [],
    };
  }
  if (message === 'Itens adicionados ao carrinho.') {
    return { kind: 'cart-add', count: 1, names: [] };
  }
  return { kind: 'generic', count: 1, names: [] };
}

export function formatGroupedMessage(
  kind: ToastKind,
  count: number,
  names: string[],
  fallback: string,
): string {
  if (kind === 'cart-add') {
    return count === 1
      ? '1 item adicionado ao carrinho.'
      : `${count} itens adicionados ao carrinho.`;
  }
  if (kind === 'cart-remove') {
    return count === 1
      ? '1 item removido do carrinho.'
      : `${count} itens removidos do carrinho.`;
  }
  if (kind === 'favorite-add') {
    if (count === 1 && names[0]) return `${names[0]} adicionado aos favoritos.`;
    return count === 1
      ? '1 item adicionado aos favoritos.'
      : `${count} itens adicionados aos favoritos.`;
  }
  if (kind === 'favorite-remove') {
    if (count === 1 && names[0]) return `${names[0]} removido dos favoritos.`;
    return count === 1
      ? '1 item removido dos favoritos.'
      : `${count} itens removidos dos favoritos.`;
  }
  return fallback;
}

export function canGroup(current: ToastItem, next: ToastItem): boolean {
  return (
    current.type === next.type &&
    current.kind === next.kind &&
    current.kind !== 'generic'
  );
}
