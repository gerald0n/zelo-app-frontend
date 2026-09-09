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

  const { pendingCount, failedCount } = printer;
  const queued = pendingCount + failedCount;

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-3.5">
      <p className="text-sm font-semibold">Impressora térmica</p>
      <p className="text-xs text-muted-foreground">
        Status: {PRINTER_STATUS_LABEL[printer.status]}
      </p>
      {testError ? (
        <p className="text-2xs text-destructive">{testError}</p>
      ) : null}

      {queued > 0 ? (
        <div className="space-y-2 rounded-md border border-border bg-muted/40 p-2.5">
          <p className="text-xs text-muted-foreground">
            {pendingCount > 0
              ? `${pendingCount} comanda${pendingCount > 1 ? 's' : ''} na fila de impressão`
              : 'Fila de impressão'}
            {failedCount > 0
              ? ` · ${failedCount} com falha`
              : printer.status === 'ready'
                ? ' · imprimindo…'
                : ' · aguardando a impressora'}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => printer.retryQueue()}
              className="rounded-md border border-border px-3 py-1.5 text-2xs font-semibold"
            >
              Tentar imprimir agora
            </button>
            <button
              type="button"
              onClick={() => printer.clearQueue()}
              className="rounded-md border border-border px-3 py-1.5 text-2xs font-semibold text-destructive"
            >
              Descartar fila
            </button>
          </div>
        </div>
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
