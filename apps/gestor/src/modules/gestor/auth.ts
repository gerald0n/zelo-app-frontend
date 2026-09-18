import 'server-only';

import { cache } from 'react';
import { err, ok, type Result } from '@/lib/errors';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export type PlatformAdminSession = {
  id: string;
  email: string;
  displayName: string;
};

/**
 * "Admin de plataforma" reaproveita `admin_profiles` — não é uma tabela
 * nova. Um perfil com `store_id = null` já é tratado como cross-tenant por
 * `private.is_admin_of_store()` (RLS, ADR-0001 Fase C), reservado desde
 * então para este app. `requirePlatformAdmin()` só valida essa mesma regra
 * no servidor: perfil ativo E sem `store_id`.
 */
export const requirePlatformAdmin = cache(
  async function requirePlatformAdmin(): Promise<Result<PlatformAdminSession>> {
    try {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase.auth.getClaims();

      const claims = data?.claims;
      if (error || !claims?.sub) {
        return err('UNAUTHENTICATED', 'Faça login no gestor.');
      }

      const admin = createAdminSupabaseClient();
      const { data: profile, error: profileError } = await admin
        .from('admin_profiles')
        .select('id, display_name, is_active, store_id')
        .eq('id', claims.sub)
        .maybeSingle();

      if (profileError) {
        return err('INTERNAL_ERROR', 'Falha ao validar administrador.', {
          cause: profileError,
        });
      }

      if (!profile || !profile.is_active || profile.store_id !== null) {
        return err('FORBIDDEN', 'Acesso restrito a administradores da plataforma.');
      }

      return ok({
        id: profile.id,
        email: typeof claims.email === 'string' ? claims.email : '',
        displayName: profile.display_name,
      });
    } catch (cause) {
      return err('INTERNAL_ERROR', 'Falha ao validar sessão.', { cause });
    }
  },
);
