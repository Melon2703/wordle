import { NextResponse } from 'next/server';
import { getServiceClient } from '../../../../lib/db/client';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  try {
    // Verify this is a legitimate Vercel cron request
    const userAgent = process.env.VERCEL_CRON_SECRET;
    if (!userAgent) {
      console.log('Nightly rollover job rejected - no cron secret configured');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    console.log('Nightly rollover job started:', {
      timestamp: new Date().toISOString()
    });
    
    const client = getServiceClient();
    
    // Get tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    // Check if tomorrow's puzzle already exists
    const { data: existingPuzzle } = await client
      .from('puzzles')
      .select('puzzle_id')
      .eq('mode', 'daily')
      .eq('date', tomorrowStr)
      .eq('status', 'published')
      .single();
    
    if (!existingPuzzle) {
      // Create tomorrow's daily puzzle - query database directly for random 5-letter solution
      const { data: solutionWords, error: wordError } = await client
        .from('dictionary_words')
        .select('word_id, text_norm')
        .eq('is_solution', true)
        .eq('len', 5)
        .limit(1000);
      
      if (wordError || !solutionWords || solutionWords.length === 0) {
        console.error('No 5-letter solution words found for daily puzzle');
        return NextResponse.json(
          { error: 'No words available for daily puzzle' },
          { status: 500 }
        );
      }
      
      const randomAnswer = solutionWords[Math.floor(Math.random() * solutionWords.length)];
      
      await client
        .from('puzzles')
        .insert({
          mode: 'daily',
          date: tomorrowStr,
          letters: 5,
          solution_word_id: randomAnswer.word_id,
          status: 'published',
          seed: `daily-${tomorrowStr}`
        });
      
      console.log('Created tomorrow\'s puzzle:', {
        date: tomorrowStr,
        answer: randomAnswer.text_norm
      });
    }
    
    // Refresh leaderboard materialized view
    await client.rpc('refresh_leaderboard_materialized_view');
    
    console.log('Nightly rollover completed successfully');
    
    return NextResponse.json({ 
      success: true,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Nightly rollover error:', error);
    return NextResponse.json(
      { error: 'Nightly rollover failed' },
      { status: 500 }
    );
  }
}
