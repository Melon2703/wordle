'use client';

import { useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heading, Text, Card, Button, IconButton } from '@/components/ui';
import { getSavedWords, deleteSavedWord } from '@/lib/api';
import type { SavedWord } from '@/lib/types';
import { useToast } from '@/components/ToastCenter';
import { Trash2, Loader2 } from 'lucide-react';

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
    },
    onError: () => {
      notify('Не удалось удалить слово');
    },
    onSettled: () => {
      setDeletingId(null);
    }
  });

  const handleDelete = (id: string) => {
    if (deleteMutation.isPending) {
      return;
    }
    setDeletingId(id);
    deleteMutation.mutate(id);
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
                onClick={() => handleDelete(word.id)}
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
