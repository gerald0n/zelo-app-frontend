import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_MIN_PASSWORD_LENGTH } from '@/config/admin';
import { httpStatusFor } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { requireAdmin } from '@/modules/admin/auth';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(
      ADMIN_MIN_PASSWORD_LENGTH,
      `A nova senha deve ter pelo menos ${ADMIN_MIN_PASSWORD_LENGTH} caracteres.`,
    ),
});

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session.ok) {
    return NextResponse.json(
      { error: session.error },
      { status: httpStatusFor(session.error.code) },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message:
            parsed.error.issues[0]?.message ?? 'Senha inválida.',
        },
      },
      { status: 400 },
    );
  }

  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'A nova senha deve ser diferente da atual.',
        },
      },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabaseClient();
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: session.data.email,
    password: parsed.data.currentPassword,
  });
  if (verifyError) {
    return NextResponse.json(
      {
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Senha atual incorreta.',
        },
      },
      { status: 401 },
    );
  }

  const admin = createAdminSupabaseClient();
  const updated = await admin.auth.admin.updateUserById(session.data.id, {
    password: parsed.data.newPassword,
  });
  if (updated.error) {
    logger.error('Falha ao alterar senha do admin', {
      message: updated.error.message,
    });
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Não foi possível alterar a senha.',
        },
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
