#!/usr/bin/env node
/**
 * Sobe o Next acessível na LAN e imprime os passos do proxy Windows (WSL2).
 *
 * Uso:
 *   pnpm dev:lan
 *   pnpm lan:info
 *
 * No Windows (PowerShell Admin), uma vez por sessão/reinício:
 *   powershell -ExecutionPolicy Bypass -File scripts/windows-lan-proxy.ps1
 */
import { spawn, spawnSync } from 'node:child_process';
import { networkInterfaces } from 'node:os';

const PORT = Number(process.env.PORT || 3000);
const SUPABASE_PORT = Number(process.env.SUPABASE_PORT || 54321);
const infoOnly = process.argv.includes('--info-only');

function wslIp() {
  const nets = networkInterfaces();
  for (const entries of Object.values(nets)) {
    for (const entry of entries ?? []) {
      if (
        entry.family === 'IPv4' &&
        !entry.internal &&
        entry.address.startsWith('172.')
      ) {
        return entry.address;
      }
    }
  }
  for (const entries of Object.values(nets)) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) return entry.address;
    }
  }
  return null;
}

function windowsLanIp() {
  try {
    const result = spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*' } | Where-Object { $_.IPAddress -notlike '172.*' } | Select-Object -First 1 -ExpandProperty IPAddress)`,
      ],
      { encoding: 'utf8' },
    );
    const ip = (result.stdout || '').trim().split(/\r?\n/).filter(Boolean)[0];
    if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip;
  } catch {
    // ignore
  }
  return process.env.DEV_LAN_HOST || null;
}

const wsl = wslIp();
const lan = windowsLanIp() || process.env.DEV_LAN_HOST || 'SEU_IP_WINDOWS';

console.log(`
╔══════════════════════════════════════════════════════════╗
║  Zelo · acesso na LAN (WSL2)                             ║
╚══════════════════════════════════════════════════════════╝

  WSL (interno):     ${wsl ?? 'não detectado'}
  Windows (Wi‑Fi):   ${lan}
  App:               http://${lan}:${PORT}
  Supabase API:      http://${lan}:${SUPABASE_PORT}

  1) No PowerShell do Windows (Admin), rode UMA vez:
     powershell -ExecutionPolicy Bypass -File .\\scripts\\windows-lan-proxy.ps1

  2) Neste terminal (já feito por pnpm dev:lan):
     - Next escuta em 0.0.0.0:${PORT}
     - NEXT_PUBLIC_SUPABASE_URL aponta para o IP do Windows
       (para o celular alcançar o Auth/Realtime)

  3) No celular (mesmo Wi‑Fi):
     http://${lan}:${PORT}

  Admin: /admin/login  →  admin@zelo.com / zelo123

  Dica: se o IP mudar, rode de novo o script do Windows e reinicie o dev:lan.
`);

if (infoOnly) process.exit(0);

if (!lan || lan === 'SEU_IP_WINDOWS') {
  console.error(
    'Não foi possível detectar o IP Wi‑Fi do Windows. Defina DEV_LAN_HOST=192.168.x.x e tente de novo.',
  );
  process.exit(1);
}

const env = {
  ...process.env,
  DEV_LAN_HOST: lan,
  // Browser no celular fala com Supabase pelo IP Wi‑Fi (portproxy Windows→WSL).
  NEXT_PUBLIC_SUPABASE_URL: `http://${lan}:${SUPABASE_PORT}`,
  // Next no WSL fala com Supabase em loopback (evita hairpin NAT).
  SUPABASE_URL: `http://127.0.0.1:${SUPABASE_PORT}`,
};

const child = spawn(
  'pnpm',
  ['exec', 'next', 'dev', '--hostname', '0.0.0.0', '--port', String(PORT)],
  {
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  },
);

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
