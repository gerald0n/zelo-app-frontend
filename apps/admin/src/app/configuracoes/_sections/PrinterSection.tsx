'use client';

import { useState } from 'react';
import { usePrinter } from '@/contexts/PrinterContext';
import { buildTestPrint } from '@/modules/printing/receipts';
import type { PrinterStatus } from '@/modules/printing/types';

const PRINTER_STATUS_LABEL: Record<PrinterStatus, string> = {
  ready: 'Conectada',
  unpaired: 'Não conectada',
  error: 'Erro na última impressão',
  unsupported: 'Não suportado neste navegador',
};

export function PrinterSection() {
  const printer = usePrinter();
  const [testError, setTestError] = useState<string | null>(null);

  const runTest = async () => {
    setTestError(null);
    const result = await printer.printRaw(buildTestPrint());
    if (!result.ok) setTestError(result.reason);
  };

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-3.5">
      <p className="text-sm font-semibold">Impressora térmica</p>
      <p className="text-xs text-muted-foreground">
        Status: {PRINTER_STATUS_LABEL[printer.status]}
      </p>
      {testError ? (
        <p className="text-2xs text-destructive">{testError}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {printer.status !== 'unsupported' ? (
          <button
            type="button"
            onClick={() => void printer.pair()}
            className="rounded-md border border-border px-3 py-2 text-xs font-semibold"
          >
            Parear impressora
          </button>
        ) : null}
        {printer.status === 'ready' ? (
          <button
            type="button"
            onClick={() => void runTest()}
            className="rounded-md border border-border px-3 py-2 text-xs font-semibold"
          >
            Imprimir teste
          </button>
        ) : null}
      </div>
    </section>
  );
}
