import { NextResponse } from 'next/server';
import { requireAuthContext } from '../../../../lib/auth/validateInitData';
import { loadDictionary } from '../../../../lib/dict/loader';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  try {
    requireAuthContext(request);
    
    const url = new URL(request.url);
    const lengthParam = url.searchParams.get('length');
    
    if (!lengthParam) {
      return NextResponse.json(
        { error: 'Missing length parameter' },
        { status: 400 }
      );
    }
    
    const length = parseInt(lengthParam);
    if (![4, 5, 6, 7].includes(length)) {
      return NextResponse.json(
        { error: 'Invalid length. Must be 4, 5, 6, or 7' },
        { status: 400 }
      );
    }
    
    const dictionary = await loadDictionary();
    
    // Filter words by length
    const wordsForLength = Array.from(dictionary.allowed).filter(word => word.length === length);
    
    return NextResponse.json({
      words: wordsForLength
    });
    
  } catch (error) {
    console.error('Dictionary words GET error:', error);
    return NextResponse.json(
      { error: 'Failed to load dictionary words' },
      { status: 500 }
    );
  }
}
