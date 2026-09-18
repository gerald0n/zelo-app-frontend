'use client';

import { createContext, useContext } from 'react';

/**
 * White label (ADR-0001, Fase D) — nome da loja atual, disponível pra
 * qualquer Client Component do admin sem precisar de uma query autenticada
 * (a tela de login, por exemplo, roda sem sessão). O valor vem do
 * `RootLayout` (Server Component, já busca a loja via `getCachedPublicStore()`
 * pro tema/metadata) — aqui é só propagação, sem fetch novo.
 */
const StoreBrandContext = createContext<string>('Zelo Confeitaria');

export function StoreBrandProvider({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  return (
    <StoreBrandContext.Provider value={name}>
      {children}
    </StoreBrandContext.Provider>
  );
}

/** Nome da loja atual (fallback `'Zelo Confeitaria'` fora do provider). */
export function useStoreBrandName(): string {
  return useContext(StoreBrandContext);
}
