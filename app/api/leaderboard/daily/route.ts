import { NextResponse } from 'next/server';
import { requireAuthContext } from '../../../../lib/auth/validateInitData';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  requireAuthContext(request);
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 });
}
