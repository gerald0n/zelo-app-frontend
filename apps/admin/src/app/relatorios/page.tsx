'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { adminContainerClass } from '@/lib/layout';
import type { ReportPeriod } from '@/modules/admin/reports';
import { OperationsView } from '@/app/relatorios/_components/OperationsView';
import { FinancialView } from '@/app/relatorios/_components/FinancialView';
import { cn } from '@/lib/cn';

const PERIODS: Array<{ id: ReportPeriod; label: string }> = [
  { id: 'today', label: 'Hoje' },
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
];

const VIEWS = [
  { id: 'operacao', label: 'Operação' },
  { id: 'financeiro', label: 'Financeiro' },
] as const;

type View = (typeof VIEWS)[number]['id'];

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1.5 text-2xs font-semibold transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card hover:bg-accent',
      )}
    >
      {children}
    </button>
  );
}

export default function AdminRelatoriosPage() {
  const { ready, isAuthenticated } = useRequireAdmin();
  const [period, setPeriod] = useState<ReportPeriod>('today');
  const [view, setView] = useState<View>('operacao');

  if (!ready || !isAuthenticated) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'min-h-dvh space-y-4 p-3.5 pb-24 md:px-6 md:pt-6',
        adminContainerClass,
      )}
    >
      <header>
        <p className="text-2xs font-bold uppercase tracking-widest text-primary">
          Operação
        </p>
        <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight">
          Relatórios
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Cancelamentos, produção e financeiro. Faturamento bruto e ticket médio
          ficam na Visão geral.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex gap-1.5">
          {VIEWS.map((item) => (
            <Pill
              key={item.id}
              active={view === item.id}
              onClick={() => setView(item.id)}
            >
              {item.label}
            </Pill>
          ))}
        </div>
        <span className="h-4 w-px bg-border" />
        <div className="flex gap-1.5">
          {PERIODS.map((item) => (
            <Pill
              key={item.id}
              active={period === item.id}
              onClick={() => setPeriod(item.id)}
            >
              {item.label}
            </Pill>
          ))}
        </div>
      </div>

      {view === 'operacao' ? (
        <OperationsView period={period} />
      ) : (
        <FinancialView period={period} />
      )}
    </div>
  );
}
