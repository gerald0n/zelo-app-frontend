import { NextResponse } from 'next/server';
import { jsonError } from '@/lib/http';
import { requireAdmin } from '@/modules/admin/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Token em memória para Realtime admin — cookies HttpOnly não são visíveis no JS. */
export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) return jsonError(auth.error);

  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token || !session.refresh_token) {
    return NextResponse.json(
      {
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Faça login no painel administrativo.',
        },
      },
      { status: 401 },
    );
  }

  return NextResponse.json({
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
  });
}
