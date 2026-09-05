/// <reference types="w3c-web-usb" />

'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  findPairedPrinter,
  isWebUsbSupported,
  printBytes,
  requestPrinterPairing,
} from '@/modules/printing/webusb-printer';
import type { PrinterStatus } from '@/modules/printing/types';

type PrinterContextType = {
  status: PrinterStatus;
  pair: () => Promise<void>;
  printRaw: (
    bytes: Uint8Array,
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
};

const PrinterContext = createContext<PrinterContextType | null>(null);

export function PrinterProvider({ children }: { children: React.ReactNode }) {
  const [supported] = useState(isWebUsbSupported);
  const [device, setDevice] = useState<USBDevice | null>(null);
  const [hasError, setHasError] = useState(false);

  const status: PrinterStatus = !supported
    ? 'unsupported'
    : hasError
      ? 'error'
      : device
        ? 'ready'
        : 'unpaired';

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
      if (!device) {
        return { ok: false as const, reason: 'Impressora não pareada.' };
      }
      try {
        await printBytes(device, bytes);
        setHasError(false);
        return { ok: true as const };
      } catch {
        setHasError(true);
        return { ok: false as const, reason: 'Falha ao imprimir.' };
      }
    },
    [device],
  );

  const value = useMemo(
    () => ({ status, pair, printRaw }),
    [status, pair, printRaw],
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
