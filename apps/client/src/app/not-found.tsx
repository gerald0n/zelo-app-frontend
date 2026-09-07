import Link from 'next/link';

export const metadata = {
  title: 'Página não encontrada · Zelo',
};

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
      <p className="font-serif text-3xl font-semibold tracking-tight text-foreground">
        Zelo
      </p>
      <p className="mt-6 font-mono text-2xs uppercase tracking-[0.2em] text-muted-foreground">
        Erro 404
      </p>
      <h1 className="mt-2 font-serif text-2xl font-semibold">
        Esta página não existe
      </h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        O link pode estar quebrado ou o item saiu do cardápio.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-transform duration-150 active:scale-[0.98]"
      >
        Voltar ao cardápio
      </Link>
    </main>
  );
}
