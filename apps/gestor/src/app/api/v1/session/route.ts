import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError } from '@/lib/http';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { requirePlatformAdmin } from '@/modules/gestor/auth';

export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function GET() {
  const session = await requirePlatformAdmin();
  if (!session.ok) return jsonError(session.error);
  return NextResponse.json({ admin: session.data });
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'E-mail ou senha inválidos.' } },
      { status: 400 },
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'E-mail ou senha inválidos.' } },
      { status: 401 },
    );
  }

  const admin = createAdminSupabaseClient();
  const { data: profile } = await admin
    .from('admin_profiles')
    .select('id, display_name, is_active, store_id')
    .eq('id', data.user.id)
    .maybeSingle();

  if (!profile?.is_active || profile.store_id !== null) {
    await supabase.auth.signOut();
    return NextResponse.json(
      {
        error: {
          code: 'FORBIDDEN',
          message: 'Acesso restrito a administradores da plataforma.',
        },
      },
      { status: 403 },
    );
  }

  return NextResponse.json({
    admin: {
      id: profile.id,
      email: data.user.email ?? email,
      displayName: profile.display_name,
    },
  });
}

export async function DELETE() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
