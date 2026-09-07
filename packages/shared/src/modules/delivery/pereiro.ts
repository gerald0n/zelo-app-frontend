/**
 * Localidades urbanas de Pereiro-CE. Antes eram a trava da área de entrega;
 * agora a área é por raio (ver `quote.ts`) e esta lista só serve para casar o
 * bairro que o autocomplete do Google devolve (`places.ts`) com um nome
 * canônico, quando ele vem.
 */
export type PereiroNeighborhood = {
  id: string;
  name: string;
};

export const PEREIRO_URBAN_NEIGHBORHOODS: PereiroNeighborhood[] = [
  { id: 'centro', name: 'Centro' },
  { id: 'alto-alegre', name: 'Alto Alegre' },
  { id: 'cohab', name: 'Cohab' },
  { id: 'padre-cicero', name: 'Padre Cícero' },
  { id: 'pedrinhas', name: 'Pedrinhas' },
  { id: 'sao-francisco', name: 'São Francisco' },
  { id: 'vila-nova', name: 'Vila Nova' },
];

export function findPereiroNeighborhood(
  name: string,
): PereiroNeighborhood | undefined {
  const normalized = name.trim().toLowerCase();
  return PEREIRO_URBAN_NEIGHBORHOODS.find(
    (item) => item.name.toLowerCase() === normalized || item.id === normalized,
  );
}
