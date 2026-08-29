import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_EMAIL, ADMIN_MIN_PASSWORD_LENGTH } from '@/config/admin';
import { jsonError } from '@/lib/http';
import { clientIpFromRequest } from '@/lib/request-ip';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/modules/admin/auth';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { rejectHoneypot, enforceIpRateLimit } from '@/modules/security/rate-limit';
import { verifyTurnstileToken } from '@/modules/security/turnstile';

export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(ADMIN_MIN_PASSWORD_LENGTH),
  captchaToken: z.string().optional(),
  website: z.string().optional(),
});

export async function GET() {
  const session = await requireAdmin();
  if (!session.ok) return jsonError(session.error);
  return NextResponse.json({ admin: session.data });
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'E-mail ou senha inválidos.',
        },
      },
      { status: 400 },
    );
  }

  const honeypot = rejectHoneypot(parsed.data.website);
  if (!honeypot.ok) return jsonError(honeypot.error);

  const ip = clientIpFromRequest(request);
  const limited = await enforceIpRateLimit({
    kind: 'admin_login',
    ip,
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) return jsonError(limited.error);

  const captcha = await verifyTurnstileToken(parsed.data.captchaToken, ip);
  if (!captcha.ok) return jsonError(captcha.error);

  const email = parsed.data.email.trim().toLowerCase();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return NextResponse.json(
      {
        error: {
          code: 'UNAUTHENTICATED',
          message: 'E-mail ou senha inválidos.',
        },
      },
      { status: 401 },
    );
  }

  if ((data.user.email ?? email) !== ADMIN_EMAIL) {
    await supabase.auth.signOut();
    return NextResponse.json(
      {
        error: {
          code: 'FORBIDDEN',
          message: 'Acesso restrito ao administrador da loja.',
        },
      },
      { status: 403 },
    );
  }

  const admin = createAdminSupabaseClient();
  const { data: profile } = await admin
    .from('admin_profiles')
    .select('id, display_name, is_active')
    .eq('id', data.user.id)
    .maybeSingle();

  if (!profile?.is_active) {
    await supabase.auth.signOut();
    return NextResponse.json(
      {
        error: {
          code: 'FORBIDDEN',
          message: 'Acesso restrito a administradores.',
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
