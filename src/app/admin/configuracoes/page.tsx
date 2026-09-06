'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useConfiguracoes } from '@/app/admin/configuracoes/useConfiguracoes';
import { AdminPasswordForm } from '@/app/admin/configuracoes/_sections/AdminPasswordForm';
import { AuditLogSection } from '@/app/admin/configuracoes/_sections/AuditLogSection';
import { BlackoutsSection } from '@/app/admin/configuracoes/_sections/BlackoutsSection';
import { LogoutButton } from '@/app/admin/configuracoes/_sections/LogoutButton';
import { BusinessHoursForm } from '@/app/admin/configuracoes/_sections/BusinessHoursForm';
import { PrinterSection } from '@/app/admin/configuracoes/_sections/PrinterSection';
import { SlotTimesSection } from '@/app/admin/configuracoes/_sections/SlotTimesSection';
import { StoreForm } from '@/app/admin/configuracoes/_sections/StoreForm';
import { adminContainerClass } from '@/lib/layout';
import { cn } from '@/lib/cn';

type Tab = 'geral' | 'horarios' | 'dispositivos' | 'seguranca';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'geral', label: 'Geral & Estabelecimento' },
  { id: 'horarios', label: 'Horários & Agendamento' },
  { id: 'dispositivos', label: 'Dispositivos & Impressão' },
  { id: 'seguranca', label: 'Segurança & Acessos' },
];

export default function AdminConfiguracoesPage() {
  const config = useConfiguracoes();
  const [tab, setTab] = useState<Tab>('geral');

  if (!config.ready || !config.isAuthenticated) {
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
          Gestão operacional & sistema
        </p>
        <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight">
          Configurações da loja & operação
        </h1>
        <p className="mt-1 max-w-prose text-xs text-muted-foreground">
          Dados fiscais, regras de entrega, impressora térmica, horários de
          fornadas e segurança da plataforma.
        </p>
      </header>

      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-2xs font-semibold transition-colors',
              tab === item.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card hover:bg-accent',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {config.mutationError ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {config.mutationError}
        </p>
      ) : null}

      {tab === 'geral' ? (
        <StoreForm
          form={config.storeForm}
          isPending={config.storeMutation.isPending}
          onSubmit={(values) => config.storeMutation.mutate(values)}
        />
      ) : null}

      {tab === 'horarios' ? (
        <div className="space-y-4">
          <BusinessHoursForm
            form={config.hoursForm}
            isPending={config.hoursMutation.isPending}
            onSubmit={(values) => config.hoursMutation.mutate(values)}
          />
          <SlotTimesSection
            slotTimes={config.slotTimes}
            setSlotTimes={config.setSlotTimes}
            dirty={config.slotsDirty}
            isPending={config.slotsMutation.isPending}
            onSave={(times) => config.slotsMutation.mutate(times)}
          />
          <BlackoutsSection
            form={config.blackoutForm}
            blackouts={config.blackouts}
            onCreate={(values) => config.blackoutMutation.mutate(values)}
            onDelete={(id) => config.deleteBlackoutMutation.mutate(id)}
          />
        </div>
      ) : null}

      {tab === 'dispositivos' ? <PrinterSection /> : null}

      {tab === 'seguranca' ? (
        <div className="space-y-4">
          <p className="text-2xs text-muted-foreground">
            Sessão: {config.admin?.displayName} ({config.admin?.email})
          </p>
          <AdminPasswordForm />
          <AuditLogSection logs={config.auditLogs} />
          <LogoutButton logout={config.logout} />
        </div>
      ) : null}
    </div>
  );
}
