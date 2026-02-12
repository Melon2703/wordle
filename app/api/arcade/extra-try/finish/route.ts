import { NextResponse } from 'next/server';
import { requireAuthContext } from '../../../../../lib/auth/validateInitData';
import { getServiceClient } from '../../../../../lib/db/client';
import { getOrCreateProfile } from '../../../../../lib/db/queries';
import type { ExtraTryFinishResponse } from '../../../../../lib/types';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const auth = requireAuthContext(request);
    const client = getServiceClient();
    
    // Parse request body
    const body = await request.json();
    const { sessionId } = body;
    
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
    
    // Get session
    const { data: session, error: sessionError } = await client
      .from('sessions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('profile_id', profile.profile_id)
      .single();
    
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }
    
    // Mark session as complete
    const { error: updateError } = await client
      .from('sessions')
      .update({ 
        result: 'lose',
        ended_at: new Date().toISOString()
      })
      .eq('session_id', sessionId);
    
    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to finish session' },
        { status: 500 }
      );
    }
    
    const response: ExtraTryFinishResponse = {
      ok: true
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Extra try finish POST error:', error);
    return NextResponse.json(
      { error: 'Failed to finish session' },
      { status: 500 }
    );
  }
}
