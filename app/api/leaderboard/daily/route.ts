import { NextResponse } from 'next/server';
import { requireAuthContext } from '../../../../lib/auth/validateInitData';
import { getServiceClient } from '../../../../lib/db/client';
import { fetchDailyLeaderboard } from '../../../../lib/db/queries';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    requireAuthContext(request);
    
    const url = new URL(request.url);
    const puzzleId = url.searchParams.get('puzzleId');
    
    if (!puzzleId) {
      return NextResponse.json(
        { error: 'Missing puzzleId parameter' },
        { status: 400 }
      );
    }
    
    const client = getServiceClient();
    const leaderboard = await fetchDailyLeaderboard(client, puzzleId);
    
    return NextResponse.json(leaderboard);
    
  } catch (error) {
    console.error('Leaderboard GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}
