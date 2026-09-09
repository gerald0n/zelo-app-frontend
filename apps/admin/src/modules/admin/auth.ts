import 'server-only';

import { cache } from 'react';
import { err, ok, type Result } from '@/lib/errors';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export type AdminSession = {
  id: string;
  email: string;
  displayName: string;
};

/**
 * `cache()` deduplica a validação dentro do mesmo request — layout, página e
 * módulos server que chamam `requireAdmin()` compartilham um único resultado.
 */
export const requireAdmin = cache(async function requireAdmin(): Promise<
  Result<AdminSession>
> {
  try {
    const supabase = await createServerSupabaseClient();
    // `getClaims()` verifica o JWT localmente (signing keys assimétricas), sem
    // ida à Auth a cada request. Com segredo simétrico, cai no caminho de rede.
    const { data, error } = await supabase.auth.getClaims();

    const claims = data?.claims;
    if (error || !claims?.sub) {
      return err('UNAUTHENTICATED', 'Faça login no painel administrativo.');
    }

    const admin = createAdminSupabaseClient();
    const { data: profile, error: profileError } = await admin
      .from('admin_profiles')
      .select('id, display_name, is_active')
      .eq('id', claims.sub)
      .maybeSingle();

    if (profileError) {
      return err('INTERNAL_ERROR', 'Falha ao validar administrador.', {
        cause: profileError,
      });
    }

    if (!profile || !profile.is_active) {
      return err('FORBIDDEN', 'Acesso restrito a administradores.');
    }

    return ok({
      id: profile.id,
      email: typeof claims.email === 'string' ? claims.email : '',
      displayName: profile.display_name,
    });
  } catch (cause) {
    return err('INTERNAL_ERROR', 'Falha ao validar sessão administrativa.', {
      cause,
    });
  }
});
