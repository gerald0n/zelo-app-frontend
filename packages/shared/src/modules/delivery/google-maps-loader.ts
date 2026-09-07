/// <reference types="google.maps" />
/**
 * Carregador da Google Maps JavaScript API para o mapa de confirmação do
 * checkout (satélite + arrastar pin). Client-safe: usa a chave pública
 * `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (restrição por referrer + Maps JS/Places
 * no Google Cloud) e injeta o script uma única vez por sessão de página.
 */

const SCRIPT_ID = 'zelo-google-maps-js';
const CALLBACK_NAME = '__zeloGoogleMapsReady';
const BROWSER_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || undefined;

let loadPromise: Promise<typeof google> | null = null;

export function hasMapsBrowserKey(): boolean {
  return Boolean(BROWSER_KEY);
}

export function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps só carrega no navegador.'));
  }
  if (window.google?.maps) {
    return Promise.resolve(window.google);
  }
  if (loadPromise) return loadPromise;
  if (!BROWSER_KEY) {
    return Promise.reject(
      new Error('Google Maps não configurado neste ambiente.'),
    );
  }

  loadPromise = new Promise((resolve, reject) => {
    (window as unknown as Record<string, () => void>)[CALLBACK_NAME] = () => {
      if (window.google?.maps) resolve(window.google);
      else reject(new Error('Falha ao carregar o Google Maps.'));
    };

    if (document.getElementById(SCRIPT_ID)) return;

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${BROWSER_KEY}` +
      `&v=weekly&language=pt-BR&region=BR&loading=async&callback=${CALLBACK_NAME}`;
    script.onerror = () => {
      loadPromise = null;
      reject(new Error('Falha ao carregar o Google Maps.'));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
