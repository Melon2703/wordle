'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BookmarkCheck, BookmarkPlus, Loader2 } from 'lucide-react';
import { IconButton } from '@/components/ui';
import { useToast } from '@/components/ToastCenter';
import { saveWord } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';

interface SaveWordButtonProps {
  word: string;
  source: 'daily' | 'arcade' | 'manual';
  puzzleId?: string | null;
  treatYoAsYe?: boolean;
  ariaLabel?: string;
  initialSaved?: boolean;
}

export function SaveWordButton({
  word,
  source,
  puzzleId,
  treatYoAsYe = false,
  ariaLabel = 'Добавить слово в словарь',
  initialSaved = false
}: SaveWordButtonProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(initialSaved);
  const { notify } = useToast();
  const queryClient = useQueryClient();

  const handleSave = async () => {
    if (isSaving || isSaved) {
      return;
    }

    const eventPayload = {
      mode: source,
      source,
      word_length: word.length,
      already_saved: initialSaved
    };

    trackEvent('word_save_attempted', eventPayload);
    trackEvent(`${source}_save_word_clicked`, eventPayload);

    setIsSaving(true);
    try {
      const result = await saveWord({
        wordText: word,
        source,
        puzzleId: puzzleId ?? null,
        treatYoAsYe
      });
      setIsSaved(true);

      if (result.alreadySaved) {
        notify('Это слово уже в словаре');
      } else {
        notify('Слово добавлено в словарь');
      }

      queryClient.invalidateQueries({ queryKey: ['savedWords'] });

      trackEvent('word_save_result', {
        ...eventPayload,
        outcome: result.alreadySaved ? 'duplicate' : 'saved'
      });
    } catch (error) {
      console.error('Failed to save word', error);
      notify('Не удалось сохранить слово');
      setIsSaved(false);
      trackEvent('word_save_result', {
        ...eventPayload,
        outcome: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <IconButton
      aria-label={ariaLabel}
      onClick={handleSave}
      disabled={isSaving || isSaved}
      title={ariaLabel}
    >
      {isSaving ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : isSaved ? (
        <BookmarkCheck className="h-5 w-5" />
      ) : (
        <BookmarkPlus className="h-5 w-5" />
      )}
    </IconButton>
  );
}
