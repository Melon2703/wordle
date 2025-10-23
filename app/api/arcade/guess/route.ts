import { NextResponse } from 'next/server';
import { requireAuthContext } from '../../../../lib/auth/validateInitData';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  requireAuthContext(request);
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 });
}
