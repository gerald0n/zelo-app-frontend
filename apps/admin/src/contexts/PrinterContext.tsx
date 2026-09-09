/// <reference types="w3c-web-usb" />

'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  findPairedPrinter,
  isWebUsbSupported,
  printBytes,
  requestPrinterPairing,
} from '@/modules/printing/webusb-printer';
import type { PrinterStatus } from '@/modules/printing/types';
import { logger } from '@/lib/logger';
import { apiJson } from '@/lib/api';
import {
  base64ToBytes,
  loadQueue,
  makePrintJob,
  MAX_ATTEMPTS,
  MAX_QUEUE_SIZE,
  saveQueue,
  type PrintJob,
  type PrintJobKind,
} from '@/lib/admin/print-queue';

type EnqueueInput = {
  kind: PrintJobKind;
  orderId: string;
  label: string;
  bytes: Uint8Array;
};

type PrinterContextType = {
  status: PrinterStatus;
  pair: () => Promise<void>;
  /** Impressão imediata pra ações manuais (teste, reimpressão) — não enfileira. */
  printRaw: (
    bytes: Uint8Array,
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
  /** Enfileira uma impressão automática; imprime agora se a térmica estiver pronta. */
  enqueuePrint: (input: EnqueueInput) => void;
  /** `true` se um pedido/tipo já está na fila (evita buscar detalhe à toa). */
  isQueued: (orderId: string, kind: PrintJobKind) => boolean;
  /** Remove um job pendente — usado quando o operador imprime na mão. */
  dequeue: (orderId: string, kind: PrintJobKind) => void;
  /** Jobs aguardando impressão (inclui os que falharam). */
  queue: PrintJob[];
  pendingCount: number;
  failedCount: number;
  /** Zera o contador de falhas e tenta a fila de novo. */
  retryQueue: () => void;
  /** Descarta a fila inteira (jobs pendentes e falhos). */
  clearQueue: () => void;
};

const PrinterContext = createContext<PrinterContextType | null>(null);

/** Intervalo entre cortes na varredura da fila — dá fôlego pro buffer da térmica. */
const BETWEEN_JOBS_MS = 700;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function PrinterProvider({ children }: { children: React.ReactNode }) {
  const [supported] = useState(isWebUsbSupported);
  const [device, setDevice] = useState<USBDevice | null>(null);
  const [hasError, setHasError] = useState(false);
  // Lazy init hidrata do storage já no primeiro render (mesmo padrão de
  // `supported`); no SSR `loadQueue` devolve [] porque não há `window`.
  const [queue, setQueue] = useState<PrintJob[]>(loadQueue);

  const deviceRef = useRef<USBDevice | null>(null);
  const queueRef = useRef<PrintJob[]>([]);
  const flushingRef = useRef(false);
  // Mutex: serializa todo acesso à USB (fila + impressões manuais nunca
  // disputam a mesma interface).
  const lockRef = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    deviceRef.current = device;
  }, [device]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const status: PrinterStatus = !supported
    ? 'unsupported'
    : hasError
      ? 'error'
      : device
        ? 'ready'
        : 'unpaired';

  const withLock = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    const run = lockRef.current.then(fn, fn);
    lockRef.current = run.then(
      () => undefined,
      () => undefined,
    );
    return run as Promise<T>;
  }, []);

  const persist = useCallback((next: PrintJob[]) => {
    queueRef.current = next;
    saveQueue(next);
    setQueue(next);
  }, []);

  useEffect(() => {
    if (!supported) return;

    void findPairedPrinter().then(setDevice);

    // Qualquer plug/unplug reconsulta os dispositivos autorizados — mais
    // simples e robusto do que tentar casar o evento com o estado atual.
    const onConnect = () => void findPairedPrinter().then(setDevice);
    const onDisconnect = () => void findPairedPrinter().then(setDevice);

    navigator.usb.addEventListener('connect', onConnect);
    navigator.usb.addEventListener('disconnect', onDisconnect);
    return () => {
      navigator.usb.removeEventListener('connect', onConnect);
      navigator.usb.removeEventListener('disconnect', onDisconnect);
    };
  }, [supported]);

  const pair = useCallback(async () => {
    if (!supported) return;
    try {
      const paired = await requestPrinterPairing();
      setDevice(paired);
      setHasError(false);
    } catch {
      // Usuário cancelou o seletor de dispositivo — não é um erro de verdade.
    }
  }, [supported]);

  const printRaw = useCallback(
    async (bytes: Uint8Array) => {
      const dev = deviceRef.current;
      if (!dev) {
        return { ok: false as const, reason: 'Impressora não pareada.' };
      }
      try {
        await withLock(() => printBytes(dev, bytes));
        setHasError(false);
        return { ok: true as const };
      } catch (err) {
        setHasError(true);
        const detail = err instanceof Error ? err.message : String(err);
        logger.error('[printer] falha na impressão', { detail });
        return {
          ok: false as const,
          reason: `Falha ao imprimir: ${detail}`,
        };
      }
    },
    [withLock],
  );

  // Consome a fila em ordem: um job por vez, remove só após o corte confirmar.
  // Numa falha (quase sempre a térmica caiu no meio) para o loop — volta a
  // rodar no próximo `connect`, no próximo `enqueue` ou no botão "tentar de
  // novo". Guardado por `flushingRef` contra reentrância.
  const flush = useCallback(async () => {
    if (flushingRef.current) return;
    if (!deviceRef.current) return;
    flushingRef.current = true;
    try {
      while (deviceRef.current) {
        const job = queueRef.current.find((item) => !item.failed);
        if (!job) break;

        try {
          await withLock(() =>
            printBytes(deviceRef.current!, base64ToBytes(job.bytesB64)),
          );
        } catch (err) {
          const attempts = job.attempts + 1;
          const failed = attempts >= MAX_ATTEMPTS;
          persist(
            queueRef.current.map((item) =>
              item.id === job.id ? { ...item, attempts, failed } : item,
            ),
          );
          setHasError(true);
          logger.error('[printer] falha ao imprimir job da fila', {
            jobId: job.id,
            orderId: job.orderId,
            attempts,
            failed,
            detail: err instanceof Error ? err.message : String(err),
          });
          // Espaça as retentativas automáticas — sem isto, um erro persistente
          // com a térmica ainda conectada viraria um laço apertado até o teto.
          if (!failed) await delay(2000);
          break;
        }

        persist(queueRef.current.filter((item) => item.id !== job.id));
        setHasError(false);

        if (job.kind === 'kitchen') {
          // Marca no servidor pra não reenfileirar ao reabrir o painel.
          // Idempotente e não crítico — falha aqui não trava a fila.
          void apiJson(`/api/v1/admin/orders/${job.orderId}/mark-printed`, {
            method: 'POST',
          }).catch(() => {});
        }

        await delay(BETWEEN_JOBS_MS);
      }
    } finally {
      flushingRef.current = false;
    }
  }, [persist, withLock]);

  // Dispara a varredura quando há impressora + jobs pendentes. Cobre o
  // enqueue, a reconexão da térmica (novo `device`) e a hidratação inicial.
  useEffect(() => {
    if (device && queue.some((job) => !job.failed)) {
      void flush();
    }
  }, [device, queue, flush]);

  const enqueuePrint = useCallback(
    (input: EnqueueInput) => {
      // Navegador sem WebUSB nunca vai imprimir — não adianta acumular jobs.
      if (!supported) return;
      const current = queueRef.current;
      if (
        current.some(
          (job) => job.orderId === input.orderId && job.kind === input.kind,
        )
      ) {
        return;
      }
      const job = makePrintJob(input);
      const next = [...current, job].slice(-MAX_QUEUE_SIZE);
      persist(next);
    },
    [persist, supported],
  );

  const isQueued = useCallback(
    (orderId: string, kind: PrintJobKind) =>
      queueRef.current.some(
        (job) => job.orderId === orderId && job.kind === kind,
      ),
    [],
  );

  const dequeue = useCallback(
    (orderId: string, kind: PrintJobKind) => {
      const next = queueRef.current.filter(
        (job) => !(job.orderId === orderId && job.kind === kind),
      );
      if (next.length !== queueRef.current.length) persist(next);
    },
    [persist],
  );

  const retryQueue = useCallback(() => {
    persist(
      queueRef.current.map((job) => ({ ...job, attempts: 0, failed: false })),
    );
    setHasError(false);
    void flush();
  }, [persist, flush]);

  const clearQueue = useCallback(() => {
    persist([]);
  }, [persist]);

  const pendingCount = queue.filter((job) => !job.failed).length;
  const failedCount = queue.length - pendingCount;

  const value = useMemo(
    () => ({
      status,
      pair,
      printRaw,
      enqueuePrint,
      isQueued,
      dequeue,
      queue,
      pendingCount,
      failedCount,
      retryQueue,
      clearQueue,
    }),
    [
      status,
      pair,
      printRaw,
      enqueuePrint,
      isQueued,
      dequeue,
      queue,
      pendingCount,
      failedCount,
      retryQueue,
      clearQueue,
    ],
  );

  return (
    <PrinterContext.Provider value={value}>{children}</PrinterContext.Provider>
  );
}

export function usePrinter() {
  const ctx = useContext(PrinterContext);
  if (!ctx) {
    throw new Error('usePrinter must be used within PrinterProvider');
  }
  return ctx;
}
