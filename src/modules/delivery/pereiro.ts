/**
 * Localidades urbanas de Pereiro-CE atendidas na 1ª versão.
 * Distâncias locais são estimativas de rota para desenvolvimento sem Maps API.
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
    roadDistanceMeters: 900,
    latitude: -5.9772,
    longitude: -38.6218,
  },
  {
    id: 'alto-alegre',
    name: 'Alto Alegre',
    roadDistanceMeters: 1600,
    latitude: -5.9725,
    longitude: -38.618,
  },
  {
    id: 'cohab',
    name: 'Cohab',
    roadDistanceMeters: 2100,
    latitude: -5.981,
    longitude: -38.628,
  },
  {
    id: 'padre-cicero',
    name: 'Padre Cícero',
    roadDistanceMeters: 1800,
    latitude: -5.974,
    longitude: -38.6265,
  },
  {
    id: 'pedrinhas',
    name: 'Pedrinhas',
    roadDistanceMeters: 2400,
    latitude: -5.9855,
    longitude: -38.619,
  },
  {
    id: 'sao-francisco',
    name: 'São Francisco',
    roadDistanceMeters: 1300,
    latitude: -5.9795,
    longitude: -38.6165,
  },
  {
    id: 'vila-nova',
    name: 'Vila Nova',
    roadDistanceMeters: 1100,
    latitude: -5.9758,
    longitude: -38.6235,
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
