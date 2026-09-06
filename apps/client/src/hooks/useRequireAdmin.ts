'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/contexts/AdminContext';

/** Garante sessão admin; redireciona fora do render para não atualizar o Router durante o paint. */
export function useRequireAdmin() {
  const router = useRouter();
  const admin = useAdmin();

  useEffect(() => {
    if (!admin.ready) return;
    if (!admin.isAuthenticated) {
      router.replace('/admin/login');
    }
  }, [admin.ready, admin.isAuthenticated, router]);

  return admin;
}
