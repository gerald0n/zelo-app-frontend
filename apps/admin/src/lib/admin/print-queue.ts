'use client';

import { logger } from '@/lib/logger';

/**
 * Fila de impressão térmica persistida no navegador. O painel enfileira toda
 * impressão automática (comanda de pedido novo, romaneio de "pronto"); o
 * `PrinterContext` consome a fila em ordem, um job por vez, e só remove cada
 * um depois que a impressora confirma o corte. Se a térmica estiver
 * desconectada, os jobs ficam aqui — e no `localStorage` — até ela voltar.
 */

export type PrintJobKind = 'kitchen' | 'delivery';

export type PrintJob = {
  id: string;
  kind: PrintJobKind;
  /** Pedido de origem — usado pra deduplicar e pra marcar como impresso. */
  orderId: string;
  /** Rótulo curto pra UI, ex.: "#1042". */
  label: string;
  /** Bytes ESC/POS já montados, em base64 (JSON não guarda Uint8Array). */
  bytesB64: string;
  enqueuedAt: string;
  attempts: number;
  /** Excedeu o teto de tentativas — sai do fluxo automático, espera ação manual. */
  failed: boolean;
};

const STORAGE_KEY = 'zelo:admin:print-queue:v1';

/** Teto de jobs guardados — corta os mais antigos se estourar (defensivo). */
export const MAX_QUEUE_SIZE = 60;

/** Tentativas automáticas antes de marcar o job como `failed`. */
export const MAX_ATTEMPTS = 5;

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function isPrintJob(value: unknown): value is PrintJob {
  if (!value || typeof value !== 'object') return false;
  const job = value as Record<string, unknown>;
  return (
    typeof job.id === 'string' &&
    (job.kind === 'kitchen' || job.kind === 'delivery') &&
    typeof job.orderId === 'string' &&
    typeof job.label === 'string' &&
    typeof job.bytesB64 === 'string' &&
    typeof job.enqueuedAt === 'string' &&
    typeof job.attempts === 'number' &&
    typeof job.failed === 'boolean'
  );
}

export function loadQueue(): PrintJob[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPrintJob);
  } catch (err) {
    logger.warn('[print-queue] falha ao ler a fila do storage', {
      detail: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

export function saveQueue(jobs: PrintJob[]): void {
  if (typeof window === 'undefined') return;
  try {
    if (jobs.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  } catch (err) {
    logger.warn('[print-queue] falha ao gravar a fila no storage', {
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

export function makePrintJob(input: {
  kind: PrintJobKind;
  orderId: string;
  label: string;
  bytes: Uint8Array;
}): PrintJob {
  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    kind: input.kind,
    orderId: input.orderId,
    label: input.label,
    bytesB64: bytesToBase64(input.bytes),
    enqueuedAt: new Date().toISOString(),
    attempts: 0,
    failed: false,
  };
}
