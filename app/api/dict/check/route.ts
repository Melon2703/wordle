import { NextResponse } from 'next/server';
import { requireAuthContext } from '../../../../lib/auth/validateInitData';
import { loadDictionary } from '../../../../lib/dict/loader';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  try {
    requireAuthContext(request);
    
    const url = new URL(request.url);
    const word = url.searchParams.get('word');
    
    if (!word) {
      return NextResponse.json(
        { error: 'Missing word parameter' },
        { status: 400 }
      );
    }
    
    const dictionary = await loadDictionary();
    const normalizedWord = word.trim().toLowerCase();
    
    return NextResponse.json({
      valid: dictionary.allowed.has(normalizedWord)
    });
    
  } catch (error) {
    console.error('Dictionary check error:', error);
    return NextResponse.json(
      { error: 'Failed to check word' },
      { status: 500 }
    );
  }
}
