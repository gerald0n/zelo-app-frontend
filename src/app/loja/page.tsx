import Link from 'next/link';
import { ArrowLeft, Coffee, MapPin, MessageCircle } from 'lucide-react';
import { WEEKDAY_LABELS } from '@/lib/constants';
import { getPublicStore } from '@/modules/catalog/catalog-repository';
import { canPlaceImmediateOrder } from '@/modules/scheduling/schedule';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/cn';
import { mobilePageColumnClass, pageHeaderBarClass, pagePrimaryButtonClass } from '@/lib/layout';

export const dynamic = 'force-dynamic';

export default async function LojaPage() {
  const storeResult = await getPublicStore();

  if (!storeResult.ok || !storeResult.data) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-sm text-muted-foreground">
          {storeResult.ok ? 'Loja não encontrada.' : storeResult.error.message}
        </p>
        <Link href="/" className="text-sm text-primary">
          Voltar ao cardápio
        </Link>
      </div>
    );
  }

  const store = storeResult.data;
  const storeOpen = canPlaceImmediateOrder(store);
  const whatsappHref = `https://wa.me/${store.whatsappE164.replace(/\D/g, '')}`;

  return (
    <div
      className={cn(
        'mx-auto flex min-h-dvh w-full flex-col bg-background lg:max-w-2xl',
        mobilePageColumnClass,
      )}
    >
      <div className={cn(pageHeaderBarClass, 'border-b-0 lg:px-0')}>
        <Link href="/" aria-label="Voltar ao cardápio">
          <ArrowLeft className="size-6" />
        </Link>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 pb-6 lg:px-0">
        <div className="flex flex-col items-center gap-1.5 py-3">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
            <Coffee className="size-8 text-primary" />
          </div>
          <h2 className="font-serif text-xl font-semibold tracking-[-0.3px]">
            {store.name}
          </h2>
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'size-2 rounded-full',
                storeOpen ? 'bg-pistachio-foreground' : 'bg-destructive',
              )}
            />
            <span className="text-[13px] text-muted-foreground">
              {storeOpen ? 'Aberto agora' : 'Fechado'}
            </span>
          </div>
        </div>

        <section className="rounded-xl border border-border bg-card p-3.5">
          <h3 className="mb-2.5 text-[15px] font-semibold">
            Horário de funcionamento
          </h3>
          {store.businessHours.map((hour, index) => {
            const label = WEEKDAY_LABELS[hour.weekday] ?? `Dia ${hour.weekday}`;
            const hoursText = hour.isClosed
              ? 'Fechado'
              : `${hour.opensAt?.slice(0, 5)} – ${hour.closesAt?.slice(0, 5)}`;
            return (
              <div key={hour.weekday}>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-sm font-medium">{label}</span>
                  <span
                    className={`text-sm ${hour.isClosed ? 'text-destructive' : 'text-muted-foreground'}`}
                  >
                    {hoursText}
                  </span>
                </div>
                {index < store.businessHours.length - 1 ? (
                  <Separator />
                ) : null}
              </div>
            );
          })}
        </section>

        <section className="rounded-xl border border-border bg-card p-3.5">
          <div className="flex gap-3">
            <MapPin className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <h3 className="text-[15px] font-semibold">Endereço</h3>
              <p className="mt-2.5 text-sm leading-5 text-muted-foreground">
                {store.addressLine}
                <br />
                {store.city} – {store.state}
                {store.postalCode ? (
                  <>
                    <br />
                    CEP {store.postalCode}
                  </>
                ) : null}
              </p>
            </div>
          </div>
        </section>

        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          className={cn(
            pagePrimaryButtonClass,
            'gap-2 bg-whatsapp text-whatsapp-foreground',
          )}
        >
          <MessageCircle className="size-[22px]" />
          Fale conosco pelo WhatsApp
        </a>
      </div>
    </div>
  );
}
