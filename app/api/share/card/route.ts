import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Resvg } from '@resvg/resvg-js';
import type { GuessLine } from '@/lib/contracts';
// why: Generate shareable PNG cards for Telegram using resvg (serverless-compatible)

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const attempts = parseInt(searchParams.get('attempts') || '1', 10);
    const length = parseInt(searchParams.get('length') || '5', 10);
    
    // Parse lines from JSON if present
    let lines: GuessLine[] = [];
    const linesParam = searchParams.get('lines');
    if (linesParam) {
      try {
        lines = JSON.parse(decodeURIComponent(linesParam)) as GuessLine[];
      } catch (e) {
        console.error('Failed to parse lines:', e);
      }
    }

    // Color mapping
    const getColor = (state: string) => {
      switch (state) {
        case 'correct': return '#10b981'; // green-500
        case 'present': return '#facc15'; // yellow-400
        case 'absent': return '#d1d5db'; // gray-300
        default: return '#e5e7eb'; // gray-200
      }
    };

    // Generate centered grid (no text, only grid)
    const squareSize = 48;
    const squareGap = 8;
    const cellSize = squareSize + squareGap;
    
    // Calculate grid dimensions
    const gridWidth = length * cellSize - squareGap;
    const gridHeight = lines.length > 0 ? lines.length * cellSize - squareGap : attempts * cellSize - squareGap;
    
    // Center grid in 800x418 canvas
    const gridStartX = (800 - gridWidth) / 2;
    const gridStartY = (418 - gridHeight) / 2;

    // Generate grid squares as SVG elements
    let gridSquares = '';
    
    if (lines.length > 0) {
      lines.forEach((line, rowIndex) => {
        line.feedback.forEach((tile, colIndex) => {
          const x = gridStartX + (colIndex * cellSize);
          const y = gridStartY + (rowIndex * cellSize);
          const color = getColor(tile.state);
          gridSquares += `<rect x="${x}" y="${y}" width="${squareSize}" height="${squareSize}" fill="${color}" rx="6"/>`;
        });
      });
    } else {
      // Placeholder grid if no lines data
      for (let row = 0; row < attempts; row++) {
        for (let col = 0; col < length; col++) {
          const x = gridStartX + (col * cellSize);
          const y = gridStartY + (row * cellSize);
          gridSquares += `<rect x="${x}" y="${y}" width="${squareSize}" height="${squareSize}" fill="#10b981" rx="6"/>`;
        }
      }
    }

    // Generate SVG string
    const svg = `
      <svg width="800" height="418" xmlns="http://www.w3.org/2000/svg">
        <rect width="800" height="418" fill="#ffffff"/>
        <g>${gridSquares}</g>
      </svg>
    `.trim();

    // Convert SVG to PNG using resvg
    const resvg = new Resvg(svg, {
      background: '#ffffff',
    });
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    return new NextResponse(pngBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Card generation failed:', error);
    return NextResponse.json({ error: 'Failed to generate card' }, { status: 500 });
  }
}
