import { NextResponse } from 'next/server';
import { getServiceClient } from '../../../../lib/db/client';
import { loadPuzzleAnswers, loadUsedWords, updateUsedWords } from '../../../../lib/dict/loader';

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
      // Load puzzle answers and used words from Storage
      const [puzzleAnswers, usedWords] = await Promise.all([
        loadPuzzleAnswers(),
        loadUsedWords()
      ]);
      
      // Filter out already used words
      const availableWords = puzzleAnswers.filter(word => !usedWords.has(word));
      
      if (availableWords.length === 0) {
        // Reset cycle: clear used words and use all puzzle answers
        console.log('All puzzle words used, resetting cycle');
        await updateUsedWords([]);
        const randomAnswer = puzzleAnswers[Math.floor(Math.random() * puzzleAnswers.length)];
        
        // Create puzzle with solution_text directly
        await client
          .from('puzzles')
          .insert({
            mode: 'daily',
            date: tomorrowStr,
            letters: 5,
            solution_text: randomAnswer,
            status: 'published',
            seed: `daily-${tomorrowStr}`
          });
        
        // Mark this word as used
        await updateUsedWords([randomAnswer]);
        
        console.log('Created tomorrow\'s puzzle (cycle reset):', {
          date: tomorrowStr,
          answer: randomAnswer
        });
      } else {
        // Pick random word from available words
        const randomAnswer = availableWords[Math.floor(Math.random() * availableWords.length)];
        
        // Create puzzle with solution_text directly
        await client
          .from('puzzles')
          .insert({
            mode: 'daily',
            date: tomorrowStr,
            letters: 5,
            solution_text: randomAnswer,
            status: 'published',
            seed: `daily-${tomorrowStr}`
          });
        
        // Mark this word as used
        const newUsedWords = Array.from(usedWords).concat(randomAnswer);
        await updateUsedWords(newUsedWords);
        
        console.log('Created tomorrow\'s puzzle:', {
          date: tomorrowStr,
          answer: randomAnswer,
          remainingWords: availableWords.length - 1
        });
      }
    }
    
    // Reset arcade credits for all users
    await client
      .from('profiles')
      .update({ arcade_credits: 3 });
    
    console.log('Reset arcade credits for all users');
    
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
