/**
 * Localidades urbanas de Pereiro-CE atendidas na 1ª versão.
 *
 * Coordenadas e distâncias são aproximadas, só para o fallback quando o Google
 * (geocodificação + Routes) e o Nominatim falham. Alinhadas ao centro real de
 * Pereiro (loja em ~-6.0485, -38.4612); o Google não tem dado por bairro nesta
 * cidade, então a precisão fina depende do cliente confirmar o pin no mapa.
 */
export type PereiroNeighborhood = {
  id: string;
  name: string;
  /** Estimativa de rota viária até a loja (só fallback local). */
  roadDistanceMeters: number;
  latitude: number;
  longitude: number;
};

export const PEREIRO_URBAN_NEIGHBORHOODS: PereiroNeighborhood[] = [
  {
    id: 'centro',
    name: 'Centro',
    roadDistanceMeters: 100,
    latitude: -6.048727,
    longitude: -38.460976,
  },
  {
    id: 'alto-alegre',
    name: 'Alto Alegre',
    roadDistanceMeters: 870,
    latitude: -6.044027,
    longitude: -38.457176,
  },
  {
    id: 'cohab',
    name: 'Cohab',
    roadDistanceMeters: 1040,
    latitude: -6.052527,
    longitude: -38.467176,
  },
  {
    id: 'padre-cicero',
    name: 'Padre Cícero',
    roadDistanceMeters: 780,
    latitude: -6.045527,
    longitude: -38.465676,
  },
  {
    id: 'pedrinhas',
    name: 'Pedrinhas',
    roadDistanceMeters: 1300,
    latitude: -6.057027,
    longitude: -38.458176,
  },
  {
    id: 'sao-francisco',
    name: 'São Francisco',
    roadDistanceMeters: 870,
    latitude: -6.051027,
    longitude: -38.455676,
  },
  {
    id: 'vila-nova',
    name: 'Vila Nova',
    roadDistanceMeters: 280,
    latitude: -6.047327,
    longitude: -38.462676,
  },
];

export function findPereiroNeighborhood(
  name: string,
): PereiroNeighborhood | undefined {
  const normalized = name.trim().toLowerCase();
  return PEREIRO_URBAN_NEIGHBORHOODS.find(
    (item) => item.name.toLowerCase() === normalized || item.id === normalized,
  );
}

export function isPereiroUrbanNeighborhood(name: string): boolean {
  return Boolean(findPereiroNeighborhood(name));
}
