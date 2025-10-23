import { NextResponse } from 'next/server';
import { env } from '../../../../../lib/env';

export const runtime = 'nodejs';

export async function POST(
  _request: Request,
  context: { params: { secret: string } }
): Promise<Response> {
  const { secret } = context.params;
  const { WEBHOOK_SECRET_PATH } = env();

  if (secret !== WEBHOOK_SECRET_PATH) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ error: 'Not implemented' }, { status: 501 });
}
