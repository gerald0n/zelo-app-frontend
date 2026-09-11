/**
 * Origens permitidas para os recursos de dev do Next (HMR) quando o app é
 * acessado por outro aparelho na LAN — sem isso, o Next 16 bloqueia esses
 * recursos por padrão e a página fica carregando pra sempre (hidratação
 * nunca completa). Usado em `next.config.ts` de `apps/admin` e `apps/client`.
 */
import { networkInterfaces } from 'node:os';

function localLanHosts(): string[] {
  const hosts: string[] = [];
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) continue;
      hosts.push(entry.address);
    }
  }
  return hosts;
}

export function lanDevOrigins(): string[] {
  const fromEnv = (process.env.DEV_LAN_HOST || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return [...new Set(['127.0.0.1', ...localLanHosts(), ...fromEnv])];
}
