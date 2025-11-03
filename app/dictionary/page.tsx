'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heading, Text, Card, Button, IconButton } from '@/components/ui';
import { getSavedWords, deleteSavedWord } from '@/lib/api';
import type { SavedWord } from '@/lib/types';
import { useToast } from '@/components/ToastCenter';
import { Trash2, Loader2 } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

const SOURCE_LABELS: Record<SavedWord['source'], string> = {
  daily: 'Ежедневная игра',
  arcade: 'Аркада',
  manual: 'Добавлено вручную'
};

function formatDate(value: string | null): string {
  if (!value) {
    return '';
  }

  try {
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(new Date(value));
  } catch {
    return '';
  }
}

export default function DictionaryPage() {
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const loadedLoggedRef = useRef(false);
  const pendingWordRef = useRef<SavedWord | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['savedWords'],
    queryFn: getSavedWords
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSavedWord(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<SavedWord[]>(['savedWords'], (current) =>
        current ? current.filter((word) => word.id !== id) : current
      );
      notify('Слово удалено из словаря');
      if (pendingWordRef.current) {
        trackEvent('dictionary_delete_result', {
          mode: 'dictionary',
          outcome: 'success',
          word_length: pendingWordRef.current.length,
          source: pendingWordRef.current.source
        });
      }
    },
    onError: () => {
      notify('Не удалось удалить слово');
      if (pendingWordRef.current) {
        trackEvent('dictionary_delete_result', {
          mode: 'dictionary',
          outcome: 'error',
          word_length: pendingWordRef.current.length,
          source: pendingWordRef.current.source
        });
      }
    },
    onSettled: () => {
      setDeletingId(null);
      pendingWordRef.current = null;
    }
  });

  useEffect(() => {
    if (loadedLoggedRef.current) {
      return;
    }
    if (isLoading || isError || data === undefined) {
      return;
    }
    loadedLoggedRef.current = true;
    trackEvent('dictionary_loaded', {
      mode: 'dictionary',
      words_count: data?.length ?? 0
    });
  }, [data, isError, isLoading]);

  const handleDelete = (word: SavedWord) => {
    if (deleteMutation.isPending) {
      return;
    }
    setDeletingId(word.id);
    pendingWordRef.current = word;
    trackEvent('dictionary_delete_clicked', {
      mode: 'dictionary',
      word_length: word.length,
      source: word.source
    });
    deleteMutation.mutate(word.id);
  };

  const words = data ?? [];

  let content: ReactNode;

  if (isLoading) {
    content = (
      <Card padding="md">
        <Text className="text-sm text-slate-500">Загружаем ваш словарь…</Text>
      </Card>
    );
  } else if (isError) {
    content = (
      <Card padding="md" className="space-y-3">
        <Text className="text-sm text-slate-500">Не удалось загрузить словарь.</Text>
        <Button variant="secondary" onClick={() => refetch()}>
          Повторить попытку
        </Button>
      </Card>
    );
  } else if (words.length === 0) {
    content = (
      <Card padding="md">
        <Text className="text-sm text-slate-500">
          Сохраняйте слова после игр, и они появятся здесь
        </Text>
      </Card>
    );
  } else {
    content = (
      <div className="space-y-3">
        {words.map((word) => {
          const metaPieces = [
            SOURCE_LABELS[word.source],
            formatDate(word.createdAt)
          ].filter(Boolean);

          return (
            <Card
              key={word.id}
              padding="md"
              className="flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <Heading level={4} className="uppercase tracking-wide">
                  {word.text}
                </Heading>
                <Text variant="caption" className="mt-2 text-slate-500">
                  {metaPieces.join(' · ')}
                </Text>
              </div>
              <IconButton
                variant="ghost"
                aria-label={`Удалить слово ${word.text}`}
                onClick={() => handleDelete(word)}
                disabled={deletingId === word.id && deleteMutation.isPending}
                title="Удалить слово"
              >
                {deletingId === word.id && deleteMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Trash2 className="h-5 w-5" />
                )}
              </IconButton>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <main className="page-container">
      <section className="section-container pb-6">
        <div className="space-y-2">
          <Heading level={2}>Личный словарь</Heading>
          <Text className="text-sm text-slate-500">
            Ваши сохраненные слова из ежедневных и аркадных игр
          </Text>
        </div>
        {content}
      </section>
    </main>
  );
}
