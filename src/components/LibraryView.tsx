import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Check,
  Download,
  Eye,
  FileText,
  Pin,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { PdfDocumentMeta, StudyNote, Subject } from '../types/study';
import { formatFileSize } from '../utils/pdfVault';
import { formatShortDate } from '../utils/time';

interface LibraryViewProps {
  subjects: Subject[];
  notes: StudyNote[];
  pdfs: PdfDocumentMeta[];
  initialSubjectId?: string;
  initialTopicId?: string | null;
  onAddNote: (payload: {
    subjectId: string;
    topicId: string | null;
    kind: 'note' | 'reminder';
    title: string;
    content: string;
    dueDate?: string | null;
    pinned?: boolean;
  }) => void;
  onToggleNotePin: (id: string) => void;
  onToggleNoteComplete: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onUploadPdf: (file: File, subjectId: string, topicId: string | null) => Promise<PdfDocumentMeta>;
  onRemovePdf: (id: string) => Promise<void>;
  onGetPdfBlob: (id: string) => Promise<Blob | null>;
  onOpenAiAssistant?: (subjectId?: string | null, topicId?: string | null) => void;
}

export function LibraryView({
  subjects,
  notes,
  pdfs,
  initialSubjectId,
  initialTopicId,
  onAddNote,
  onToggleNotePin,
  onToggleNoteComplete,
  onDeleteNote,
  onUploadPdf,
  onRemovePdf,
  onGetPdfBlob,
  onOpenAiAssistant,
}: LibraryViewProps) {
  const [filterSubjectId, setFilterSubjectId] = useState<string>(initialSubjectId || 'all');
  const [filterTopicId, setFilterTopicId] = useState<string>(initialTopicId || 'all');
  const [noteFilter, setNoteFilter] = useState<'all' | 'pinned' | 'reminders'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Composer state
  const [showComposer, setShowComposer] = useState(false);
  const [noteKind, setNoteKind] = useState<'note' | 'reminder'>('note');
  const [formSubjectId, setFormSubjectId] = useState<string>(
    initialSubjectId && initialSubjectId !== 'all'
      ? initialSubjectId
      : subjects[0]?.id || ''
  );
  const [formTopicId, setFormTopicId] = useState<string>(initialTopicId || '');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteDueDate, setNoteDueDate] = useState('');
  const [notePinned, setNotePinned] = useState(true);

  // PDF upload & preview state
  const [pdfSubjectId, setPdfSubjectId] = useState<string>(
    initialSubjectId && initialSubjectId !== 'all'
      ? initialSubjectId
      : subjects[0]?.id || ''
  );
  const [pdfTopicId, setPdfTopicId] = useState<string>(initialTopicId || '');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [confirmDeletePdfId, setConfirmDeletePdfId] = useState<string | null>(null);
  const [previewPdf, setPreviewPdf] = useState<{ name: string; url: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialSubjectId) {
      setFilterSubjectId(initialSubjectId);
      if (initialSubjectId !== 'all') {
        setFormSubjectId(initialSubjectId);
        setPdfSubjectId(initialSubjectId);
      }
    }
    if (initialTopicId !== undefined) {
      setFilterTopicId(initialTopicId || 'all');
      setFormTopicId(initialTopicId || '');
      setPdfTopicId(initialTopicId || '');
    }
  }, [initialSubjectId, initialTopicId]);

  useEffect(() => {
    return () => {
      if (previewPdf) {
        URL.revokeObjectURL(previewPdf.url);
      }
    };
  }, [previewPdf]);

  const subjectMap = useMemo(() => {
    const map = new Map<string, Subject>();
    subjects.forEach((s) => map.set(s.id, s));
    return map;
  }, [subjects]);

  const filterTopics = useMemo(() => {
    if (filterSubjectId === 'all') return [];
    return subjectMap.get(filterSubjectId)?.topics || [];
  }, [filterSubjectId, subjectMap]);

  const formTopics = useMemo(
    () => subjectMap.get(formSubjectId)?.topics || [],
    [formSubjectId, subjectMap]
  );

  const pdfTopics = useMemo(
    () => subjectMap.get(pdfSubjectId)?.topics || [],
    [pdfSubjectId, subjectMap]
  );

  const getSubjectTopicLabel = (subjectId: string, topicId: string | null) => {
    const sub = subjectMap.get(subjectId);
    const subName = sub?.name || 'General';
    if (!topicId || !sub) return subName;
    const topic = sub.topics.find((t) => t.id === topicId);
    return topic ? `${subName} · ${topic.name}` : subName;
  };

  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return notes
      .filter((n) => {
        if (filterSubjectId !== 'all' && n.subjectId !== filterSubjectId) return false;
        if (filterTopicId !== 'all' && n.topicId !== filterTopicId) return false;
        if (noteFilter === 'pinned' && !n.pinned) return false;
        if (noteFilter === 'reminders' && n.kind !== 'reminder') return false;
        if (
          q &&
          !n.title.toLowerCase().includes(q) &&
          !n.content.toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.createdAt - a.createdAt;
      });
  }, [notes, filterSubjectId, filterTopicId, noteFilter, searchQuery]);

  const filteredPdfs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return pdfs.filter((p) => {
      if (filterSubjectId !== 'all' && p.subjectId !== filterSubjectId) return false;
      if (filterTopicId !== 'all' && p.topicId !== filterTopicId) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [pdfs, filterSubjectId, filterTopicId, searchQuery]);

  const totalPdfBytes = useMemo(
    () => pdfs.reduce((acc, p) => acc + p.sizeBytes, 0),
    [pdfs]
  );

  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() || !formSubjectId) return;
    onAddNote({
      subjectId: formSubjectId,
      topicId: formTopicId || null,
      kind: noteKind,
      title: noteTitle,
      content: noteContent,
      dueDate: noteKind === 'reminder' && noteDueDate ? noteDueDate : null,
      pinned: notePinned,
    });
    setNoteTitle('');
    setNoteContent('');
    setNoteDueDate('');
    setShowComposer(false);
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const isPdf =
          file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        if (!isPdf) {
          setUploadError(`"${file.name}" is not a PDF file.`);
          continue;
        }
        await onUploadPdf(file, pdfSubjectId || subjects[0]?.id || 'general', pdfTopicId || null);
      }
    } catch {
      setUploadError('Could not store PDF locally. Check available browser storage.');
    } finally {
      setUploading(false);
    }
  };

  const handleOpenPreview = async (pdf: PdfDocumentMeta) => {
    const blob = await onGetPdfBlob(pdf.id);
    if (!blob) return;
    if (previewPdf) URL.revokeObjectURL(previewPdf.url);
    const url = URL.createObjectURL(blob);
    setPreviewPdf({ name: pdf.name, url });
  };

  const handleDownloadPdf = async (pdf: PdfDocumentMeta) => {
    const blob = await onGetPdfBlob(pdf.id);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = pdf.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Header & Subject / Topic Filters */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Notes, Reminders &amp; PDF Vault
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Organize important formulas, revision reminders, and study PDFs per subject and topic.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes or PDFs..."
              className="h-9 pl-9 pr-3 text-sm bg-white/75 dark:bg-slate-950/60 border border-slate-200/80 dark:border-white/15 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          <select
            aria-label="Filter by subject"
            value={filterSubjectId}
            onChange={(e) => {
              const nextSub = e.target.value;
              setFilterSubjectId(nextSub);
              setFilterTopicId('all');
              if (nextSub !== 'all') {
                setFormSubjectId(nextSub);
                setFormTopicId('');
                setPdfSubjectId(nextSub);
                setPdfTopicId('');
              }
            }}
            className="h-9 px-3 text-sm glass-subtle rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            <option value="all">All Subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {filterSubjectId !== 'all' && filterTopics.length > 0 && (
            <select
              aria-label="Filter by topic"
              value={filterTopicId}
              onChange={(e) => {
                const nextTopic = e.target.value;
                setFilterTopicId(nextTopic);
                setFormTopicId(nextTopic === 'all' ? '' : nextTopic);
                setPdfTopicId(nextTopic === 'all' ? '' : nextTopic);
              }}
              className="h-9 px-3 text-sm glass-subtle rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="all">All Topics</option>
              {filterTopics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT: Important Notes & Reminders */}
        <section
          aria-label="Subject and topic notes and reminders"
          className="lg:col-span-7 glass-panel rounded-2xl overflow-hidden"
        >
          <div className="p-5 border-b border-slate-200/70 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center p-1 glass-subtle rounded-xl">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'pinned', label: 'Important' },
                  { id: 'reminders', label: 'Reminders' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setNoteFilter(tab.id)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    noteFilter === tab.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {onOpenAiAssistant && (
                <button
                  type="button"
                  onClick={() =>
                    onOpenAiAssistant(
                      filterSubjectId === 'all' ? subjects[0]?.id || null : filterSubjectId,
                      filterTopicId === 'all' ? null : filterTopicId
                    )
                  }
                  className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium glass-subtle text-slate-800 dark:text-slate-100 hover:bg-white/80 dark:hover:bg-white/10 rounded-xl transition-colors whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
                  Ask AI
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowComposer((v) => !v)}
                className="btn-accent inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                {showComposer ? 'Close' : 'Add Note / Reminder'}
              </button>
            </div>
          </div>

          {showComposer && (
            <form
              onSubmit={handleSaveNote}
              className="p-5 border-b border-slate-200/70 dark:border-white/10 space-y-4 bg-white/30 dark:bg-white/[0.02]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center p-1 glass-subtle rounded-xl">
                  <button
                    type="button"
                    onClick={() => setNoteKind('note')}
                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                      noteKind === 'note'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Important Note
                  </button>
                  <button
                    type="button"
                    onClick={() => setNoteKind('reminder')}
                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                      noteKind === 'reminder'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Reminder
                  </button>
                </div>

                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notePinned}
                    onChange={(e) => setNotePinned(e.target.checked)}
                    className="rounded accent-[var(--accent)]"
                  />
                  Pin as Important
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  aria-label="Note subject"
                  value={formSubjectId}
                  onChange={(e) => {
                    setFormSubjectId(e.target.value);
                    setFormTopicId('');
                  }}
                  className="h-9 px-3 text-sm bg-white/75 dark:bg-slate-950/60 border border-slate-200/80 dark:border-white/15 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Note topic"
                  value={formTopicId}
                  onChange={(e) => setFormTopicId(e.target.value)}
                  className="h-9 px-3 text-sm bg-white/75 dark:bg-slate-950/60 border border-slate-200/80 dark:border-white/15 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <option value="">General (Subject-wide)</option>
                  {formTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <input
                type="text"
                required
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder={
                  noteKind === 'reminder'
                    ? 'Reminder title (e.g., Revise DI percentage shortcuts)'
                    : 'Note title (e.g., Quadratic root sign trick)'
                }
                className="w-full h-10 px-3 text-sm bg-white/75 dark:bg-slate-950/60 border border-slate-200/80 dark:border-white/15 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />

              <textarea
                rows={3}
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Write key formulas, rules, shortcuts, or exam reminders..."
                className="w-full p-3 text-sm bg-white/75 dark:bg-slate-950/60 border border-slate-200/80 dark:border-white/15 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />

              <div className="flex flex-wrap items-center justify-between gap-3">
                {noteKind === 'reminder' ? (
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="reminder-due-date"
                      className="text-xs text-slate-500 dark:text-slate-400"
                    >
                      Due date:
                    </label>
                    <input
                      id="reminder-due-date"
                      type="date"
                      value={noteDueDate}
                      onChange={(e) => setNoteDueDate(e.target.value)}
                      className="h-9 px-2.5 text-xs font-mono bg-white/75 dark:bg-slate-950/60 border border-slate-200/80 dark:border-white/15 rounded-xl text-slate-800 dark:text-slate-100"
                    />
                  </div>
                ) : (
                  <div />
                )}

                <button
                  type="submit"
                  className="btn-accent h-9 px-4 text-xs font-semibold rounded-xl transition-all"
                >
                  Save {noteKind === 'reminder' ? 'Reminder' : 'Note'}
                </button>
              </div>
            </form>
          )}

          {filteredNotes.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                No notes or reminders for this filter yet.
              </p>
              <button
                type="button"
                onClick={() => setShowComposer(true)}
                className="btn-accent inline-flex items-center gap-1.5 h-9 px-4 text-xs font-semibold rounded-xl transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Create First Note
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200/60 dark:divide-white/10">
              {filteredNotes.map((note) => (
                <div key={note.id} className="p-4 sm:p-5 flex items-start gap-3">
                  {note.kind === 'reminder' && (
                    <button
                      type="button"
                      onClick={() => onToggleNoteComplete(note.id)}
                      aria-label={note.completed ? 'Mark incomplete' : 'Mark complete'}
                      className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                        note.completed
                          ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-fg)]'
                          : 'border-slate-300 dark:border-white/25 hover:border-[var(--accent)]'
                      }`}
                    >
                      {note.completed && <Check className="w-3 h-3 stroke-[3]" />}
                    </button>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3
                        className={`text-sm font-semibold ${
                          note.completed
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {note.title}
                      </h3>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onToggleNotePin(note.id)}
                          aria-label={note.pinned ? 'Unpin important note' : 'Pin as important'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            note.pinned
                              ? 'text-[var(--accent)]'
                              : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                          }`}
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteNote(note.id)}
                          aria-label={`Delete ${note.title}`}
                          className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {note.content && (
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                        {note.content}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <span>{getSubjectTopicLabel(note.subjectId, note.topicId)}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {note.kind === 'reminder' ? (
                          <span className="inline-flex items-center gap-1">
                            <Bell className="w-3 h-3" />
                            {note.dueDate ? `Due ${note.dueDate}` : 'Reminder'}
                          </span>
                        ) : (
                          'Note'
                        )}
                      </span>
                      {note.pinned && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-medium text-[var(--accent)]">Important</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* RIGHT: Local PDF Vault (IndexedDB) */}
        <section
          aria-label="Important PDFs storage"
          className="lg:col-span-5 glass-panel rounded-2xl overflow-hidden"
        >
          <div className="p-5 border-b border-slate-200/70 dark:border-white/10 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                PDF Storage
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {pdfs.length} {pdfs.length === 1 ? 'file' : 'files'} · {formatFileSize(totalPdfBytes)}{' '}
                stored locally
              </p>
            </div>
          </div>

          {/* Upload Panel */}
          <div className="p-5 border-b border-slate-200/70 dark:border-white/10 space-y-3 bg-white/30 dark:bg-white/[0.02]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <select
                aria-label="PDF subject"
                value={pdfSubjectId}
                onChange={(e) => {
                  setPdfSubjectId(e.target.value);
                  setPdfTopicId('');
                }}
                className="h-9 px-2.5 text-xs font-medium bg-white/75 dark:bg-slate-950/60 border border-slate-200/80 dark:border-white/15 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <select
                aria-label="PDF topic"
                value={pdfTopicId}
                onChange={(e) => setPdfTopicId(e.target.value)}
                className="h-9 px-2.5 text-xs font-medium bg-white/75 dark:bg-slate-950/60 border border-slate-200/80 dark:border-white/15 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value="">General (Subject-wide)</option>
                {pdfTopics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFilesSelected(e.dataTransfer.files);
              }}
              className="border border-dashed border-slate-300 dark:border-white/20 rounded-xl p-5 text-center space-y-2.5 hover:border-[var(--accent)] transition-colors"
            >
              <Upload className="w-5 h-5 mx-auto text-slate-400 dark:text-slate-400" />
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Drop Banking PDFs, formula sheets, or mock papers here
              </p>
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="btn-accent inline-flex items-center gap-1.5 h-9 px-4 text-xs font-semibold rounded-xl transition-all disabled:opacity-50"
              >
                {uploading ? 'Saving PDF...' : 'Upload PDF'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="application/pdf,.pdf"
                onChange={(e) => {
                  handleFilesSelected(e.target.files);
                  e.target.value = '';
                }}
                className="hidden"
              />
            </div>

            {uploadError && (
              <p role="alert" className="text-xs text-red-600 dark:text-red-400">
                {uploadError}
              </p>
            )}
          </div>

          {/* Stored PDF List */}
          {filteredPdfs.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No PDFs uploaded for this selection yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-200/60 dark:divide-white/10">
              {filteredPdfs.map((pdf) => (
                <div key={pdf.id} className="p-4 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <FileText className="w-4 h-4 mt-0.5 text-[var(--accent)] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {pdf.name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums truncate">
                        {getSubjectTopicLabel(pdf.subjectId, pdf.topicId)} ·{' '}
                        {formatFileSize(pdf.sizeBytes)} · {formatShortDate(new Date(pdf.addedAt))}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenPreview(pdf)}
                      aria-label={`Preview ${pdf.name}`}
                      className="p-1.5 text-slate-500 hover:text-[var(--accent)] rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadPdf(pdf)}
                      aria-label={`Download ${pdf.name}`}
                      className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    {confirmDeletePdfId === pdf.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={async () => {
                            await onRemovePdf(pdf.id);
                            setConfirmDeletePdfId(null);
                          }}
                          className="px-2 py-1 text-[11px] font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeletePdfId(null)}
                          className="px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeletePdfId(pdf.id)}
                        aria-label={`Delete ${pdf.name}`}
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* In-App Glassmorphic PDF Preview Modal */}
      {previewPdf && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`PDF Preview: ${previewPdf.name}`}
        >
          <div className="w-full max-w-5xl h-[88vh] glass-panel rounded-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 border-b border-slate-200/70 dark:border-white/10 flex items-center justify-between gap-4">
              <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                {previewPdf.name}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={previewPdf.url}
                  download={previewPdf.name}
                  className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium glass-subtle text-slate-800 dark:text-slate-100 rounded-lg"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(previewPdf.url);
                    setPreviewPdf(null);
                  }}
                  aria-label="Close PDF preview"
                  className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <iframe
              src={previewPdf.url}
              title={previewPdf.name}
              className="flex-1 w-full bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}
