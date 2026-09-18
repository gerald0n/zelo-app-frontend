'use client';

import { GestorAuthProvider } from '@/contexts/GestorAuthContext';
import GestorShell from '@/components/GestorShell';

export default function GestorProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <GestorAuthProvider>
      <GestorShell>{children}</GestorShell>
    </GestorAuthProvider>
  );
}
