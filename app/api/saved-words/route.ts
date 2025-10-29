import { NextResponse } from 'next/server';
import { requireAuthContext } from '@/lib/auth/validateInitData';
import { getServiceClient } from '@/lib/db/client';
import { getOrCreateProfile, listSavedWords, upsertSavedWord } from '@/lib/db/queries';
import { normalizeGuess } from '@/lib/game/policies';

export const runtime = 'nodejs';

type SavedWordRow = Awaited<ReturnType<typeof listSavedWords>>[number];

function serializeSavedWord(row: SavedWordRow) {
  return {
    id: row.saved_id,
    text: row.word_text,
    norm: row.word_norm,
    length: row.length,
    source: row.source,
    puzzleId: row.puzzle_id,
    createdAt: row.created_at
  };
}

const allowedSources = new Set(['daily', 'arcade', 'manual']);

export async function GET(request: Request) {
  try {
    const auth = requireAuthContext(request);
    const client = getServiceClient();

    const profile = await getOrCreateProfile(
      client,
      parseInt(auth.userId),
      auth.parsed.user?.username,
      auth.parsed.user?.first_name,
      auth.parsed.user?.last_name
    );

    const words = await listSavedWords(client, profile.profile_id);

    return NextResponse.json({
      words: words.map(serializeSavedWord)
    });
  } catch (error) {
    console.error('saved-words GET error:', error);
    return NextResponse.json(
      { error: 'Failed to load saved words' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const { wordText, source, puzzleId, treatYoAsYe } = body as {
      wordText?: unknown;
      source?: unknown;
      puzzleId?: unknown;
      treatYoAsYe?: unknown;
    };

    if (typeof wordText !== 'string' || wordText.trim().length === 0) {
      return NextResponse.json({ error: 'wordText is required' }, { status: 400 });
    }

    if (typeof source !== 'string' || !allowedSources.has(source)) {
      return NextResponse.json({ error: 'source is invalid' }, { status: 400 });
    }

    const puzzleIdValue =
      typeof puzzleId === 'string' && puzzleId.trim().length > 0 ? puzzleId.trim() : null;

    const treatYoFlag = typeof treatYoAsYe === 'boolean' ? treatYoAsYe : false;
    const normalized = normalizeGuess(wordText, treatYoFlag);

    const auth = requireAuthContext(request);
    const client = getServiceClient();

    const profile = await getOrCreateProfile(
      client,
      parseInt(auth.userId),
      auth.parsed.user?.username,
      auth.parsed.user?.first_name,
      auth.parsed.user?.last_name
    );

    const result = await upsertSavedWord(client, {
      profileId: profile.profile_id,
      wordText: wordText.trim(),
      wordNorm: normalized,
      source: source as 'daily' | 'arcade' | 'manual',
      puzzleId: puzzleIdValue
    });

    if (!result.row) {
      return NextResponse.json(
        { error: 'Failed to save word' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      word: serializeSavedWord(result.row),
      alreadySaved: result.alreadyExisted
    });
  } catch (error) {
    console.error('saved-words POST error:', error);
    return NextResponse.json(
      { error: 'Failed to save word' },
      { status: 500 }
    );
  }
}
