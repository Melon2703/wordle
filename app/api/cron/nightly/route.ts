import { NextResponse } from 'next/server';
import { getServiceClient } from '../../../../lib/db/client';
import { loadDictionary } from '../../../../lib/dict/loader';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  try {
    // Check for Vercel cron user-agent
    const userAgent = process.env.VERCEL_CRON_SECRET || 'vercel-cron/1.0';
    
    console.log('Nightly rollover job started:', {
      timestamp: new Date().toISOString(),
      userAgent
    });
    
    const client = getServiceClient();
    const dictionary = await loadDictionary();
    
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
      // Create tomorrow's daily puzzle
      const answers = Array.from(dictionary.answers).filter(word => word.length === 5);
      const randomAnswer = answers[Math.floor(Math.random() * answers.length)];
      
      // Get the word from database
      const { data: solutionWord } = await client
        .from('dictionary_words')
        .select('word_id')
        .eq('text_norm', randomAnswer)
        .eq('is_solution', true)
        .single();
      
      if (solutionWord) {
        await client
          .from('puzzles')
          .insert({
            mode: 'daily',
            date: tomorrowStr,
            letters: 5,
            solution_word_id: solutionWord.word_id,
            status: 'published',
            seed: `daily-${tomorrowStr}`
          });
        
        console.log('Created tomorrow\'s puzzle:', {
          date: tomorrowStr,
          answer: randomAnswer
        });
      }
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
