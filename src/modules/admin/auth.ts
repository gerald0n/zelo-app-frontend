import { err, ok, type Result } from '@/lib/errors';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export type AdminSession = {
  id: string;
  email: string;
  displayName: string;
};

export async function requireAdmin(): Promise<Result<AdminSession>> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return err('UNAUTHENTICATED', 'Faça login no painel administrativo.');
    }

    const admin = createAdminSupabaseClient();
    const { data: profile, error: profileError } = await admin
      .from('admin_profiles')
      .select('id, display_name, is_active')
      .eq('id', user.id)
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
      email: user.email ?? '',
      displayName: profile.display_name,
    });
  } catch (cause) {
    return err('INTERNAL_ERROR', 'Falha ao validar sessão administrativa.', {
      cause,
    });
  }
}
