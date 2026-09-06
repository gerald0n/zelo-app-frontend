import { AdminProvider } from '@/contexts/AdminContext';
import { AdminRealtimeProvider } from '@/contexts/AdminRealtimeContext';
import { AdminNewOrderProvider } from '@/contexts/AdminNewOrderContext';
import { PrinterProvider } from '@/contexts/PrinterContext';
import AdminShell from '@/components/admin/AdminShell';

/**
 * Tudo do painel fica isolado nesta rota.
 *
 * `AdminProvider` e a navbar do admin saíram do `Providers` global — assim
 * não entram no bundle de quem só abre o cardápio. Libs pesadas usadas só
 * aqui (editor de imagem, kanban de pedidos, integração com impressora)
 * também ficam contidas em `/admin/*` pelo code-splitting por rota.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminProvider>
      <PrinterProvider>
        <AdminRealtimeProvider>
          <AdminNewOrderProvider>
            <AdminShell>{children}</AdminShell>
          </AdminNewOrderProvider>
        </AdminRealtimeProvider>
      </PrinterProvider>
    </AdminProvider>
  );
}
