import React, { useEffect, useMemo, useState } from 'react';
import { BookmarkPlus, Send, Sparkles, X } from 'lucide-react';
import { Subject } from '../types/study';

interface AiAssistantModalProps {
  isOpen: boolean;
  subjects: Subject[];
  defaultSubjectId?: string | null;
  defaultTopicId?: string | null;
  onSaveAsNote: (payload: {
    subjectId: string;
    topicId: string | null;
    kind: 'note' | 'reminder';
    title: string;
    content: string;
    pinned?: boolean;
  }) => void;
  onClose: () => void;
}

interface QaItem {
  id: string;
  question: string;
  answer: string;
  subjectId: string;
  topicId: string | null;
  saved?: boolean;
}

export function AiAssistantModal({
  isOpen,
  subjects,
  defaultSubjectId,
  defaultTopicId,
  onSaveAsNote,
  onClose,
}: AiAssistantModalProps) {
  const [subjectId, setSubjectId] = useState<string>(defaultSubjectId || subjects[0]?.id || '');
  const [topicId, setTopicId] = useState<string>(defaultTopicId || '');
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<QaItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      if (defaultSubjectId) {
        setSubjectId(defaultSubjectId);
      } else if (!subjectId && subjects[0]?.id) {
        setSubjectId(subjects[0].id);
      }
      if (defaultTopicId !== undefined) {
        setTopicId(defaultTopicId || '');
      }
    }
  }, [isOpen, defaultSubjectId, defaultTopicId, subjects, subjectId]);

  const selectedSubject = useMemo(
    () => subjects.find((s) => s.id === subjectId) || null,
    [subjects, subjectId]
  );

  const selectedTopic = useMemo(
    () => selectedSubject?.topics.find((t) => t.id === topicId) || null,
    [selectedSubject, topicId]
  );

  if (!isOpen) return null;

  const askQuestion = async (promptText: string, mode = 'explain') => {
    const clean = promptText.trim();
    if (!clean || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: clean,
          subjectName: selectedSubject?.name,
          topicName: selectedTopic?.name,
          mode,
        }),
      });

      const data = (await res.json()) as { answer?: string; error?: string };
      if (!res.ok || !data.answer) {
        throw new Error(data.error || 'Could not get a response from StudyOS AI.');
      }

      setHistory((prev) => [
        {
          id: `qa_${Date.now()}`,
          question: clean,
          answer: data.answer as string,
          subjectId: selectedSubject?.id || subjects[0]?.id || '',
          topicId: selectedTopic?.id || null,
          saved: false,
        },
        ...prev,
      ]);
      setQuestion('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    askQuestion(question);
  };

  const handleSaveNote = (item: QaItem) => {
    if (!item.subjectId || item.saved) return;
    onSaveAsNote({
      subjectId: item.subjectId,
      topicId: item.topicId,
      kind: 'note',
      title: item.question.slice(0, 72),
      content: item.answer,
      pinned: true,
    });
    setHistory((prev) =>
      prev.map((h) => (h.id === item.id ? { ...h, saved: true } : h))
    );
  };

  const quickPrompts = [
    {
      label: 'Vocabulary meaning & synonyms',
      prompt: 'Explain the meaning, synonyms, antonyms, and an exam example for: ',
      fillOnly: true,
    },
    {
      label: 'Explain active topic',
      prompt: `Explain the core concepts and exam tips for ${selectedTopic?.name || selectedSubject?.name || 'this topic'}.`,
      fillOnly: false,
    },
    {
      label: 'Shortcut / formula',
      prompt: `Give me the most useful exam shortcuts or formulas for ${selectedTopic?.name || selectedSubject?.name || 'this subject'}.`,
      fillOnly: false,
    },
    {
      label: '2 practice questions',
      prompt: `Give me 2 Banking exam practice questions with brief solutions on ${selectedTopic?.name || selectedSubject?.name || 'this topic'}.`,
      fillOnly: false,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-modal-title"
    >
      <div className="w-full max-w-2xl glass-panel rounded-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200/70 dark:border-white/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-[var(--accent)]" />
            <h2
              id="ai-modal-title"
              className="font-display text-base font-semibold text-slate-900 dark:text-white"
            >
              Ask StudyOS AI
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close AI assistant"
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Subject & Topic Context */}
        <div className="px-6 py-3.5 border-b border-slate-200/60 dark:border-white/10 bg-white/30 dark:bg-white/[0.02] space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <select
              aria-label="AI context subject"
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setTopicId('');
              }}
              className="h-9 px-3 text-xs font-medium bg-white/75 dark:bg-slate-950/60 border border-slate-200/80 dark:border-white/15 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <select
              aria-label="AI context topic"
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              className="h-9 px-3 text-xs font-medium bg-white/75 dark:bg-slate-950/60 border border-slate-200/80 dark:border-white/15 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="">General (All Topics)</option>
              {(selectedSubject?.topics || []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Prompt Buttons */}
          <div className="flex flex-wrap gap-2">
            {quickPrompts.map((qp) => (
              <button
                key={qp.label}
                type="button"
                disabled={loading}
                onClick={() => {
                  if (qp.fillOnly) {
                    setQuestion(qp.prompt);
                  } else {
                    askQuestion(qp.prompt);
                  }
                }}
                className="px-2.5 py-1 text-xs font-medium glass-subtle text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-white/10 rounded-lg transition-colors"
              >
                {qp.label}
              </button>
            ))}
          </div>
        </div>

        {/* Question Form */}
        <form
          onSubmit={handleSubmit}
          className="px-6 py-4 border-b border-slate-200/60 dark:border-white/10 flex items-center gap-2.5"
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a word meaning (e.g., Ubiquitous) or any topic detail..."
            className="flex-1 h-10 px-3.5 text-sm bg-white/80 dark:bg-slate-950/65 border border-slate-300/80 dark:border-white/15 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="btn-accent inline-flex items-center gap-1.5 h-10 px-4 text-sm font-semibold rounded-xl transition-all disabled:opacity-45 whitespace-nowrap shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            {loading ? 'Thinking...' : 'Ask'}
          </button>
        </form>

        {/* Results Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300"
            >
              {error}
            </div>
          )}

          {loading && (
            <div className="p-4 rounded-xl glass-subtle animate-pulse text-xs text-slate-500 dark:text-slate-400">
              Generating concise study explanation...
            </div>
          )}

          {history.length === 0 && !loading ? (
            <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Ask any English vocabulary word, grammar rule, Quantitative shortcut, or Banking Awareness concept. You can save any answer directly to your Notes.
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl glass-subtle space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {item.question}
                    </p>
                    <button
                      type="button"
                      disabled={item.saved}
                      onClick={() => handleSaveNote(item)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg text-[var(--accent)] hover:bg-white/60 dark:hover:bg-white/10 disabled:opacity-60 whitespace-nowrap shrink-0"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5" />
                      {item.saved ? 'Saved to Notes' : 'Save to Notes'}
                    </button>
                  </div>
                  <div className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {item.answer}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
