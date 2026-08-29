import Link from 'next/link';

export const metadata = {
  title: 'Offline · Zelo',
  description: 'Você está sem conexão.',
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
      <p className="font-[family-name:var(--font-fraunces)] text-3xl font-semibold tracking-tight text-foreground">
        Zelo
      </p>
      <h1 className="mt-4 text-xl font-bold">Sem conexão</h1>
      <p className="mt-2 max-w-sm text-sm leading-5 text-muted-foreground">
        O cardápio e os pedidos precisam de internet. Assim que a conexão
        voltar, você pode continuar de onde parou.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-white"
      >
        Tentar novamente
      </Link>
    </main>
  );
}
