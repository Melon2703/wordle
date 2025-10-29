import { NextResponse } from 'next/server';
import { requireAuthContext } from '@/lib/auth/validateInitData';
import { getServiceClient } from '@/lib/db/client';
import { getOrCreateProfile, deleteSavedWord } from '@/lib/db/queries';

export const runtime = 'nodejs';

export async function DELETE(
  request: Request,
  { params }: { params: { savedId: string } }
) {
  try {
    const { savedId } = params;
    if (!savedId || typeof savedId !== 'string') {
      return NextResponse.json({ error: 'Invalid saved word id' }, { status: 400 });
    }

    const auth = requireAuthContext(request);
    const client = getServiceClient();

    const profile = await getOrCreateProfile(
      client,
      parseInt(auth.userId),
      auth.parsed.user?.username,
      auth.parsed.user?.first_name,
      auth.parsed.user?.last_name
    );

    const removed = await deleteSavedWord(client, {
      profileId: profile.profile_id,
      savedId
    });

    if (!removed) {
      return NextResponse.json({ error: 'Saved word not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('saved-words DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete saved word' },
      { status: 500 }
    );
  }
}
