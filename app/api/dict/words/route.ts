import { NextResponse } from 'next/server';
import { requireAuthContext } from '../../../../lib/auth/validateInitData';
import { loadDictionary, loadThemeWordSet } from '../../../../lib/dict/loader';
import type { ArcadeTheme } from '../../../../lib/types';
import { ARCADE_THEMES } from '../../../../lib/types';

function isArcadeTheme(value: unknown): value is ArcadeTheme {
  return typeof value === 'string' && (ARCADE_THEMES as readonly string[]).includes(value);
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    
    const themeParam = url.searchParams.get('theme') ?? 'common';
    if (!isArcadeTheme(themeParam)) {
      return NextResponse.json(
        { error: 'Invalid theme. Must be one of: common, music' },
        { status: 400 }
      );
    }

    let wordsForLength: string[];
    if (themeParam === 'common') {
      const dictionary = await loadDictionary();
      wordsForLength = Array.from(dictionary.allowed).filter(word => word.length === length);
    } else {
      const themeWords = await loadThemeWordSet(themeParam);
      wordsForLength = Array.from(themeWords).filter(word => word.length === length);
    }
    
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
