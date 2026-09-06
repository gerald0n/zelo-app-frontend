import { NextResponse } from 'next/server';
import { jsonError } from '@/lib/http';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { mintCustomerRealtimeSession } from '@/modules/realtime/session';

export const dynamic = 'force-dynamic';

export async function POST() {
  const result = await mintCustomerRealtimeSession();
  if (!result.ok) return jsonError(result.error);

  return NextResponse.json({ session: result.data });
}

export async function DELETE() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
