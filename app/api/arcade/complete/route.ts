import { NextResponse } from 'next/server';
import { requireAuthContext } from '../../../../lib/auth/validateInitData';
import { getServiceClient } from '../../../../lib/db/client';
import { getOrCreateProfile } from '../../../../lib/db/queries';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const auth = requireAuthContext(request);
    const client = getServiceClient();
    
    // Parse request body
    const body = await request.json();
    const { puzzleId, result, attemptsUsed, timeMs } = body;
    
    if (!puzzleId || !result || !attemptsUsed || timeMs === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: puzzleId, result, attemptsUsed, timeMs' },
        { status: 400 }
      );
    }
    
    if (!['won', 'lost'].includes(result)) {
      return NextResponse.json(
        { error: 'Invalid result. Must be "won" or "lost"' },
        { status: 400 }
      );
    }
    
    // Convert client result to database enum values
    const dbResult = result === 'won' ? 'win' : 'lose';
    
    // Get or create user profile
    const profile = await getOrCreateProfile(client, parseInt(auth.userId), auth.parsed.user?.username);
    
    // Find the arcade session
    const { data: session, error: sessionError } = await client
      .from('sessions')
      .select('*')
      .eq('profile_id', profile.profile_id)
      .eq('puzzle_id', puzzleId)
      .eq('mode', 'arcade')
      .single();
    
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Arcade session not found' },
        { status: 404 }
      );
    }
    
    // Check if session is already completed
    if (session.result) {
      return NextResponse.json(
        { error: 'Session already completed' },
        { status: 409 }
      );
    }
    
    // Update session with completion data
    const { error: updateError } = await client
      .from('sessions')
      .update({
        result: dbResult,
        attempts_used: attemptsUsed,
        time_ms: timeMs,
        ended_at: new Date().toISOString()
      })
      .eq('session_id', session.session_id);
    
    if (updateError) {
      console.error('Failed to update arcade session:', updateError);
      return NextResponse.json(
        { error: 'Failed to update session' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ ok: true });
    
  } catch (error) {
    console.error('Arcade complete POST error:', error);
    return NextResponse.json(
      { error: 'Failed to complete arcade session' },
      { status: 500 }
    );
  }
}
