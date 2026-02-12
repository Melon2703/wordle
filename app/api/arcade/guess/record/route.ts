import { NextResponse } from 'next/server';
import { requireAuthContext } from '../../../../../lib/auth/validateInitData';
import { getServiceClient } from '../../../../../lib/db/client';
import { getOrCreateProfile, recordArcadeGuess } from '../../../../../lib/db/queries';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const auth = requireAuthContext(request);
    const client = getServiceClient();
    
    // Parse request body
    const body = await request.json();
    const { sessionId, guessIndex, textInput, textNorm, feedbackMask } = body;
    
    if (!sessionId || !guessIndex || !textInput || !textNorm || !feedbackMask) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Get or create user profile
    const profile = await getOrCreateProfile(
      client,
      parseInt(auth.userId),
      auth.parsed.user?.username,
      auth.parsed.user?.first_name,
      auth.parsed.user?.last_name
    );
    
    // Verify session belongs to user
    const { data: session } = await client
      .from('sessions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('profile_id', profile.profile_id)
      .single();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }
    
    // Record the guess
    try {
      await recordArcadeGuess(client, {
        sessionId,
        guessIndex,
        textInput,
        textNorm,
        feedbackMask
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'DUPLICATE_GUESS') {
        return NextResponse.json(
          { error: 'Вы уже пробовали это слово' },
          { status: 400 }
        );
      }
      throw error;
    }
    
    return NextResponse.json({ ok: true });
    
  } catch (error) {
    console.error('Arcade guess record POST error:', error);
    return NextResponse.json(
      { error: 'Failed to record guess' },
      { status: 500 }
    );
  }
}

