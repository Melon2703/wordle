import { NextResponse } from 'next/server';
import { requireAuthContext } from '../../../../lib/auth/validateInitData';
import { getServiceClient } from '../../../../lib/db/client';
import { getOrCreateProfile } from '../../../../lib/db/queries';
import type { ArcadeHintRequest, ArcadeHintResponse } from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const auth = requireAuthContext(request);
    const client = getServiceClient();
    
    // Parse request body
    const body = await request.json();
    const { sessionId } = body as ArcadeHintRequest;
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId' },
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
    
    // Get session with puzzle
    const { data: session, error: sessionError } = await client
      .from('sessions')
      .select(`
        *,
        puzzles: puzzle_id (
          puzzle_id,
          solution_text,
          letters
        )
      `)
      .eq('session_id', sessionId)
      .eq('profile_id', profile.profile_id)
      .single();
    
    if (sessionError || !session || !session.puzzles) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }
    
    // Check if session is already completed
    if (session.result && session.result !== null) {
      return NextResponse.json(
        { error: 'Cannot use hints on completed session' },
        { status: 409 }
      );
    }
    
    // Get current hints from session
    const hintsUsed = (session.hints_used || []) as Array<{letter: string; position: number}>;
    
    // If already used 5 hints, just return existing hints
    if (hintsUsed.length >= 5) {
      return NextResponse.json({
        hints: hintsUsed,
        entitlementsRemaining: 0
      } as ArcadeHintResponse);
    }
    
    // Check if user has entitlements
    const { data: entitlements, error: entitlementsError } = await client
      .from('entitlements')
      .select('*')
      .eq('profile_id', profile.profile_id)
      .eq('product_id', 'arcade_hint');
    
    if (entitlementsError) {
      return NextResponse.json(
        { error: 'Failed to check entitlements' },
        { status: 500 }
      );
    }
    
    const entitlementsRemaining = entitlements?.length || 0;
    
    if (entitlementsRemaining === 0) {
      return NextResponse.json({
        hints: hintsUsed,
        entitlementsRemaining: 0
      } as ArcadeHintResponse);
    }
    
    // Generate random letter from solution that's not already revealed
    const puzzle = session.puzzles as { solution_text: string };
    const solution = puzzle.solution_text;
    const revealedPositions = new Set(hintsUsed.map(h => h.position));
    const availablePositions: number[] = [];
    
    for (let i = 0; i < solution.length; i++) {
      if (!revealedPositions.has(i)) {
        availablePositions.push(i);
      }
    }
    
    if (availablePositions.length === 0) {
      return NextResponse.json({
        hints: hintsUsed,
        entitlementsRemaining: entitlementsRemaining
      } as ArcadeHintResponse);
    }
    
    // Pick random position
    const randomPosition = availablePositions[Math.floor(Math.random() * availablePositions.length)];
    const newHint = {
      letter: solution[randomPosition],
      position: randomPosition
    };
    
    // Add new hint to array
    const updatedHints = [...hintsUsed, newHint];
    
    // Consume 1 entitlement
    const { error: deleteError } = await client
      .from('entitlements')
      .delete()
      .eq('profile_id', profile.profile_id)
      .eq('product_id', 'arcade_hint')
      .limit(1);
    
    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to consume entitlement' },
        { status: 500 }
      );
    }
    
    // Update session with new hints
    const { error: updateError } = await client
      .from('sessions')
      .update({ hints_used: updatedHints })
      .eq('session_id', sessionId);
    
    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update session' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      hints: updatedHints,
      entitlementsRemaining: entitlementsRemaining - 1
    } as ArcadeHintResponse);
    
  } catch (error) {
    console.error('Arcade hint POST error:', error);
    return NextResponse.json(
      { error: 'Failed to use hint' },
      { status: 500 }
    );
  }
}

