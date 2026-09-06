/**
 * Destino de retorno do fluxo de autenticação.
 *
 * Quando o usuário entra no fluxo `identificacao → otp → nome` por fora do
 * checkout (tela de Perfil, Meus pedidos, gate de conta), o fim do fluxo deve
 * levá-lo de volta para onde estava — e não despejá-lo no `/checkout/recebimento`.
 *
 * O ponto de entrada grava o caminho; o fim do fluxo consome (lê e apaga).
 * Usa `sessionStorage`, como o resto do fluxo (`@zelo/pendingPhone` etc.).
 */
const KEY = '@zelo/authReturnTo';

export function setAuthReturnTo(path: string): void {
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    /* ignore */
  }
}

export function consumeAuthReturnTo(): string | null {
  try {
    const value = sessionStorage.getItem(KEY);
    if (value) sessionStorage.removeItem(KEY);
    return value || null;
  } catch {
    return null;
  }
}
