import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAuthContext } from '@/lib/auth/validateInitData';
import { env } from '@/lib/env';
import type { PrepareShareRequest, SharePayload } from '@/lib/types';
// why: Prepare shareable messages via Telegram bot savePreparedInlineMessage (docs/backend/Backend_Documentation.md §A.2)

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authContext = requireAuthContext(request);
    const { BOT_TOKEN } = env();

    const body: PrepareShareRequest = await request.json();
    
    // Get the actual public origin from headers (ngrok/Vercel set this correctly)
    const host = request.headers.get('host') || request.headers.get('x-forwarded-host');
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const publicOrigin = host ? `${protocol}://${host}` : request.nextUrl.origin;

    // Calculate length from first line or default
    const length = body.lines.length > 0 ? body.lines[0].feedback.length : (body.mode === 'daily' ? 5 : 6);
    
    // Generate card image with cache-busting version parameter
    const cardParams = new URLSearchParams({
      v: '3', // Version 3 - grid only
      mode: body.mode,
      attempts: body.attemptsUsed.toString(),
      status: body.status,
      length: length.toString(),
      lines: encodeURIComponent(JSON.stringify(body.lines)),
    });

    if (body.timeMs) {
      cardParams.set('timeMs', body.timeMs.toString());
    }

    if (body.mode === 'daily') {
      if (body.streak) {
        cardParams.set('streak', body.streak.toString());
      }
    } else {
      if (body.arcadeSolved) {
        cardParams.set('arcadeSolved', body.arcadeSolved.toString());
      }
    }

    // Use localhost for internal card generation to avoid SSL/network issues
    // why: server-to-server calls should use localhost (not external ngrok/Vercel URL)
    const internalBaseUrl = process.env.NODE_ENV === 'production' 
      ? request.nextUrl.origin 
      : 'http://localhost:3000';
    const cardUrl = `${internalBaseUrl}/api/share/card?${cardParams}`;
    const cardResponse = await fetch(cardUrl);
    
    // For the public photo URL, use the actual origin (ngrok/Vercel)
    const publicPhotoUrl = `${publicOrigin}/api/share/card?${cardParams}`;

    if (!cardResponse.ok) {
      throw new Error('Failed to generate card');
    }

    // Use the public URL for the image (not uploading to Telegram)
    const photoUrl = publicPhotoUrl;

    // Create share payload (without lines to keep deep link small)
    const payload: SharePayload = {
      v: 1,
      mode: body.mode,
      ref: authContext.userId,
      attempts: body.attemptsUsed,
      status: body.status,
      length,
    };

    if (body.timeMs) {
      payload.timeMs = body.timeMs;
    }

    if (body.mode === 'daily') {
      if (body.streak) {
        payload.streak = body.streak;
      }
    } else {
      if (body.arcadeSolved) {
        payload.arcadeSolved = body.arcadeSolved;
      }
    }

    // Encode payload as base64url
    const jsonPayload = JSON.stringify(payload);
    const base64Payload = Buffer.from(jsonPayload, 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    const startParam = `share_v1_${base64Payload}`;

    // Create message markup with inline button
    // Use Telegram deep link to open Mini App (not browser)
    // Format: https://t.me/{bot_username}?startapp={param}
    const botUsername = 'wordleRUS_bot'; // Your bot username
    const shareUrl = `https://t.me/${botUsername}?startapp=${startParam}`;
    const markup = {
      inline_keyboard: [
        [
          {
            text: '🎮 Начать играть',
            url: shareUrl,
          },
        ],
      ],
    };

    // Helper for Russian ordinal numbers
    const formatOrdinal = (num: number): string => {
      const str = num.toString();
      const lastDigit = parseInt(str[str.length - 1]);
      if (lastDigit === 1 && num !== 11) return `${num}-я`;
      if (lastDigit >= 2 && lastDigit <= 4 && (num < 12 || num > 14)) return `${num}-я`;
      return `${num}-я`;
    };

    // Generate engaging caption with HTML bold formatting
    let caption = '';
    if (body.mode === 'daily') {
      if (body.streak === 1) {
        // First time
        caption = `🎉 Решил свою первую загадку! Потребовалось <b>${body.attemptsUsed} попыток</b>. Попробуй и ты!`;
      } else if (body.streak && body.streak > 1) {
        // Has streak
        caption = `🔥 Это моя <b>${formatOrdinal(body.streak)}</b> загадка подряд! Решил за <b>${body.attemptsUsed} попыток</b>. Сможешь лучше?`;
      } else {
        // No streak data (fallback)
        caption = `Отгадал слово за <b>${body.attemptsUsed} попыток</b>! А ты справишься? 🎯`;
      }
    } else {
      // Arcade
      if (body.arcadeSolved === 1) {
        // First time
        caption = `🎮 Решил свою первую аркадную загадку! Потребовалось <b>${body.attemptsUsed} попыток</b>. Попробуй сам!`;
      } else if (body.arcadeSolved && body.arcadeSolved > 1) {
        // Has count
        caption = `🏆 Уже <b>${body.arcadeSolved}</b> аркадных загадок решено! Эта заняла <b>${body.attemptsUsed} попыток</b>. Проверь свою эрудицию!`;
      } else {
        // No count data (fallback)
        caption = `Ещё одна загадка решена за <b>${body.attemptsUsed} попыток</b>! Проверь свою эрудицию 🧩`;
      }
    }

    const preparePayload = {
      user_id: parseInt(authContext.userId),
      result: {
        type: 'photo',
        id: `photo_${Date.now()}`,
        photo_url: photoUrl,
        thumbnail_url: photoUrl,
        caption,
        parse_mode: 'HTML',
        reply_markup: markup,
      },
      allow_user_chats: true,
      allow_bot_chats: false,
      allow_group_chats: true,
      allow_channel_chats: false,
    };

    const prepareResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/savePreparedInlineMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preparePayload),
    });

    if (!prepareResponse.ok) {
      const error = await prepareResponse.text();
      console.error('Failed to prepare inline message:', error);
      throw new Error('Failed to prepare inline message');
    }

    const prepareData = await prepareResponse.json();

    // Return prepared message ID
    return NextResponse.json({
      ok: true,
      preparedMessageId: prepareData.result?.id || `prepared_${Date.now()}`,
    });
  } catch (error) {
    console.error('Share prepare error:', error);
    return NextResponse.json({ error: 'Failed to prepare share' }, { status: 500 });
  }
}

