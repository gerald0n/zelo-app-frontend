import { NextResponse } from 'next/server';
import { getVapidPublicKey, hasWebPushConfig } from '@/config/env';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    enabled: hasWebPushConfig(),
    publicKey: getVapidPublicKey() ?? null,
  });
}
