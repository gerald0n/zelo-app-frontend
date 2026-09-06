// Store externo (fora do React) dos favoritos do cliente, persistido em
// localStorage e sincronizado entre abas/instâncias via evento. Consumido
// pelo ShopExperienceProvider através de useSyncExternalStore.

const FAVORITES_STORAGE_KEY = '@zelo/favorites:v1';
const FAVORITES_EVENT = 'zelo-favorites';
const EMPTY_FAVORITES: string[] = [];

let cachedFavorites: string[] = EMPTY_FAVORITES;

function readFavoritesFromStorage(): string[] {
  try {
    const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as string[]) : EMPTY_FAVORITES;
  } catch {
    return EMPTY_FAVORITES;
  }
}

export function getFavoritesSnapshot(): string[] {
  return cachedFavorites;
}

export function getServerFavoritesSnapshot(): string[] {
  return EMPTY_FAVORITES;
}

export function writeFavorites(ids: string[]) {
  const next = ids.length === 0 ? EMPTY_FAVORITES : ids;
  cachedFavorites = next;
  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(FAVORITES_EVENT));
}

export function subscribeFavorites(onStoreChange: () => void) {
  cachedFavorites = readFavoritesFromStorage();

  const handle = () => {
    const next = readFavoritesFromStorage();
    const same =
      next.length === cachedFavorites.length &&
      next.every((id, index) => id === cachedFavorites[index]);
    if (!same) {
      cachedFavorites = next.length === 0 ? EMPTY_FAVORITES : next;
      onStoreChange();
    }
  };

  window.addEventListener('storage', handle);
  window.addEventListener(FAVORITES_EVENT, handle);
  return () => {
    window.removeEventListener('storage', handle);
    window.removeEventListener(FAVORITES_EVENT, handle);
  };
}
