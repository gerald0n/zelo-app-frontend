import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

type Props = {
  title: string;
  subtitle?: string;
  backTo?: string;
};

/**
 * Título simples de página do painel. Substitui o antigo `AdminHeader` (barra
 * fixa com toggle de loja e selo ADMIN) — essas ações agora vivem na sidebar.
 */
export default function AdminPageTitle({ title, subtitle, backTo }: Props) {
  return (
    <div className="flex items-center gap-2.5">
      {backTo ? (
        <Link
          href={backTo}
          aria-label="Voltar"
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="size-5" />
        </Link>
      ) : null}
      <div className="min-w-0">
        <h1 className="font-serif text-xl font-bold tracking-tight">{title}</h1>
        {subtitle ? (
          <p className="mt-0.5 text-2xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}
