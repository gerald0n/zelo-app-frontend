import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function establishCustomerSession(
  userId: string,
): Promise<Result<{ accessToken: string; refreshToken: string }>> {
  const admin = createAdminSupabaseClient();
  const { data: userData, error: userError } =
    await admin.auth.admin.getUserById(userId);

  const email = userData.user?.email;
  if (userError || !email) {
    logger.error('Usuário sem e-mail para sessão', {
      message: userError?.message,
    });
    return err('INTERNAL_ERROR', 'Não foi possível abrir a sessão.', {
      cause: userError,
    });
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    logger.error('Falha ao gerar link de sessão', {
      message: linkError?.message,
    });
    return err('INTERNAL_ERROR', 'Não foi possível abrir a sessão.', {
      cause: linkError,
    });
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.verifyOtp({
    type: 'email',
    token_hash: tokenHash,
  });

  if (error || !data.session) {
    logger.error('Falha ao confirmar sessão do cliente', {
      message: error?.message,
    });
    return err('INTERNAL_ERROR', 'Não foi possível abrir a sessão.', {
      cause: error,
    });
  }

  return ok({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  });
}
