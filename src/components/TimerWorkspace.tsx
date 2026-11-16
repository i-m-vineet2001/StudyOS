import React, { useState } from 'react';
import {
  ChevronRight,
  Maximize2,
  Moon,
  Palette,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Settings,
  Sparkles,
  Sun,
  Tag,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { AppSettings, PdfDocumentMeta, StudyNote, Subject, TimerState, Topic } from '../types/study';
import { SESSION_TAGS } from '../utils/storage';
import { COLOR_THEMES } from '../utils/themes';
import { formatHumanDuration } from '../utils/time';
import { PreciseClock } from './PreciseClock';
import { SubjectModal } from './SubjectModal';

interface TimerWorkspaceProps {
  timer: TimerState;
  todayUniversalSeconds: number;
  subjects: Subject[];
  notes: StudyNote[];
  pdfs: PdfDocumentMeta[];
  activeSubject: Subject | null;
  settings: AppSettings;
  completedBanner: string | null;
  onDismissBanner: () => void;
  onTogglePlayPause: () => void;
  onStartUniversalStopwatch: () => void;
  onResetUniversalSet: () => void;
  onSetSubjectMode: (id: string, mode: 'countdown' | 'stopwatch') => void;
  onSetSubjectTopic: (id: string, topicId: string | null) => void;
  onSetActiveTag: (tag: string | null) => void;
  onToggleSubject: (id: string, mode?: 'countdown' | 'stopwatch') => void;
  onResetSubject: (id: string, mode?: 'countdown' | 'stopwatch') => void;
  onAddSubject: (name: string, targetMinutes: number, color: string, topics: Topic[]) => void;
  onUpdateSubject: (
    id: string,
    name: string,
    targetMinutes: number,
    color: string,
    topics: Topic[]
  ) => void;
  onDeleteSubject: (id: string) => void;
  onOpenFocusMode: (mode?: 'stopwatch' | 'countdown', subjectId?: string | null) => void;
  onOpenLibrary: (subjectId: string, topicId?: string | null) => void;
  onOpenSettings: () => void;
  onOpenAiAssistant: (subjectId?: string | null, topicId?: string | null) => void;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
}

export function TimerWorkspace({
  timer,
  todayUniversalSeconds,
  subjects,
  notes,
  pdfs,
  activeSubject,
  settings,
  completedBanner,
  onDismissBanner,
  onTogglePlayPause,
  onStartUniversalStopwatch,
  onResetUniversalSet,
  onSetSubjectMode,
  onSetSubjectTopic,
  onSetActiveTag,
  onToggleSubject,
  onResetSubject,
  onAddSubject,
  onUpdateSubject,
  onDeleteSubject,
  onOpenFocusMode,
  onOpenLibrary,
  onOpenSettings,
  onOpenAiAssistant,
  onUpdateSettings,
}: TimerWorkspaceProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [controlsExpanded, setControlsExpanded] = useState(false);
  const [customTagInput, setCustomTagInput] = useState('');
  const [showCustomTagForm, setShowCustomTagForm] = useState(false);

  const dailyGoalSeconds = Math.max(60, settings.dailyGoalMinutes * 60);
  const goalPct = Math.min(100, Math.round((todayUniversalSeconds / dailyGoalSeconds) * 100));

  const activeTopicName =
    activeSubject && activeSubject.activeTopicId
      ? activeSubject.topics.find((t) => t.id === activeSubject.activeTopicId)?.name
      : null;

  const trimmedUserName = settings.userName?.trim() || '';

  const handleOpenAdd = () => {
    setEditingSubject(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (sub: Subject) => {
    setEditingSubject(sub);
    setModalOpen(true);
  };

  const handleSaveModal = (
    name: string,
    targetMinutes: number,
    color: string,
    topics: Topic[]
  ) => {
    if (editingSubject) {
      onUpdateSubject(editingSubject.id, name, targetMinutes, color, topics);
    } else {
      onAddSubject(name, targetMinutes, color, topics);
    }
  };

  const handleCustomTagSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = customTagInput.trim();
    if (!cleaned) return;
    onSetActiveTag(cleaned);
    setCustomTagInput('');
    setShowCustomTagForm(false);
  };

  const isPresetTag = timer.activeTag ? SESSION_TAGS.includes(timer.activeTag) : false;

  return (
    <div className="space-y-8">
      {/* Workspace Greeting & Collapsible Circular Utility Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Hi, {trimmedUserName || 'there'}
            </h1>
            <button
              type="button"
              onClick={onOpenSettings}
              className="text-xs font-medium text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded"
            >
              {trimmedUserName ? 'Edit name' : 'Set your name'}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <span>Today&apos;s total:</span>
            <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
              {formatHumanDuration(todayUniversalSeconds)}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              {goalPct}% of {formatHumanDuration(dailyGoalSeconds)} goal
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Collapsible Circular Control for Theme, Chime & Light/Dark */}
          <div className="inline-flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setControlsExpanded((prev) => !prev)}
              aria-expanded={controlsExpanded}
              aria-label={
                controlsExpanded
                  ? 'Collapse theme, chime and appearance controls'
                  : 'Expand theme, chime and appearance controls'
              }
              title="Theme, Chime & Light/Dark"
              className={`w-10 h-10 rounded-full inline-flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                controlsExpanded
                  ? 'btn-accent'
                  : 'glass-subtle text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800/70'
              }`}
            >
              {controlsExpanded ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <Palette className="w-4 h-4" />
              )}
            </button>

            {controlsExpanded && (
              <div
                role="group"
                aria-label="Quick theme, chime, and appearance controls"
                className="inline-flex flex-wrap items-center gap-1.5 p-1 glass-subtle rounded-full"
              >
                {/* Circular Color Theme Swatches */}
                <div
                  role="group"
                  aria-label="App color theme"
                  className="inline-flex items-center gap-1.5 px-2"
                >
                  {COLOR_THEMES.map((themeItem) => {
                    const isSelected = (settings.colorTheme || 'sapphire') === themeItem.id;
                    return (
                      <button
                        key={themeItem.id}
                        type="button"
                        onClick={() => onUpdateSettings({ colorTheme: themeItem.id })}
                        title={themeItem.label}
                        aria-label={`Select ${themeItem.label} theme`}
                        aria-pressed={isSelected}
                        className={`w-5 h-5 rounded-full transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                          isSelected
                            ? 'scale-125 ring-2 ring-slate-900 dark:ring-white ring-offset-1 dark:ring-offset-black'
                            : 'opacity-80 hover:opacity-100 hover:scale-110'
                        }`}
                        style={{
                          backgroundColor: themeItem.swatchHex,
                          boxShadow: isSelected ? `0 0 10px ${themeItem.swatchHex}` : undefined,
                        }}
                      />
                    );
                  })}
                </div>

                {/* Circular Chime Toggle Button */}
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
                  aria-label={settings.soundEnabled ? 'Chime On — click to mute' : 'Muted — click to enable chime'}
                  aria-pressed={settings.soundEnabled}
                  title={settings.soundEnabled ? 'Chime On' : 'Chime Muted'}
                  className={`w-8 h-8 rounded-full inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                    settings.soundEnabled
                      ? 'bg-[var(--accent)] text-[var(--accent-fg)]'
                      : 'bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {settings.soundEnabled ? (
                    <Volume2 className="w-3.5 h-3.5" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5" />
                  )}
                </button>

                {/* Circular Light/Dark Toggle Button */}
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })
                  }
                  aria-label={
                    settings.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
                  }
                  title={settings.theme === 'dark' ? 'Light mode' : 'Dark mode'}
                  className="w-8 h-8 rounded-full inline-flex items-center justify-center bg-white/80 dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:scale-105 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  {settings.theme === 'dark' ? (
                    <Sun className="w-3.5 h-3.5" />
                  ) : (
                    <Moon className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Ask AI Button */}
          <button
            type="button"
            onClick={() =>
              onOpenAiAssistant(
                activeSubject?.id || subjects[0]?.id || null,
                activeSubject?.activeTopicId || null
              )
            }
            className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-full text-xs font-semibold glass-subtle text-slate-800 dark:text-slate-100 hover:bg-white/80 dark:hover:bg-slate-800/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Ask AI</span>
          </button>

          {/* Circular Settings Button */}
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Open StudyOS settings"
            title="Settings (Theme, Chime, Dark, Glow, Name)"
            className="w-10 h-10 rounded-full inline-flex items-center justify-center glass-subtle text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Countdown Completion Notice */}
      {completedBanner && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 glass-panel border-emerald-400/50 dark:border-emerald-500/30 rounded-2xl text-sm text-emerald-900 dark:text-emerald-200"
        >
          <span>
            <strong className="font-semibold">{completedBanner}</strong> countdown finished and was
            logged to your study progress.
          </span>
          <button
            type="button"
            onClick={onDismissBanner}
            className="text-xs font-medium underline underline-offset-2 hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Dominant Anchor: Universal Study Timer */}
      <section
        aria-label="Universal study timer"
        className="glass-panel rounded-2xl overflow-hidden"
      >
        <div className="p-6 sm:p-8 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                <span>Universal Study Timer</span>
                <span aria-hidden="true">·</span>
                <span>
                  {timer.isRunning
                    ? activeSubject
                      ? `Tracking ${activeSubject.name}${activeTopicName ? ` (${activeTopicName})` : ''} · ${
                          timer.activeMode === 'countdown' ? 'Countdown' : 'Stopwatch'
                        }`
                      : 'Running universal stopwatch'
                    : 'Paused'}
                </span>
                {timer.activeTag && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-[var(--accent)] font-semibold">
                      Tag: {timer.activeTag}
                    </span>
                  </>
                )}
              </div>

              <div className="font-semibold tracking-tight text-slate-900 dark:text-white text-[clamp(2.5rem,5vw,4.25rem)] leading-none">
                <PreciseClock
                  mode="stopwatch"
                  seconds={timer.universalElapsedSeconds}
                  isActiveRunning={timer.isRunning}
                  lastTickAt={timer.lastTickAt}
                  pausedSubMs={timer.pausedSubMs || 0}
                  subClassName="text-[0.44em] opacity-65 font-medium"
                />
              </div>

              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                Master study duration across every subject countdown and stopwatch session.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onTogglePlayPause}
                className={`inline-flex items-center justify-center gap-2.5 h-11 px-6 rounded-xl text-sm font-semibold transition-all whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                  timer.isRunning
                    ? 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100'
                    : 'btn-accent'
                }`}
              >
                {timer.isRunning ? (
                  <>
                    <Pause className="w-4 h-4 fill-current" />
                    Pause Study
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    Start Stopwatch
                  </>
                )}
              </button>

              {timer.isRunning && timer.activeSubjectId !== null && (
                <button
                  type="button"
                  onClick={onStartUniversalStopwatch}
                  className="inline-flex items-center justify-center h-11 px-4 rounded-xl text-sm font-medium glass-subtle text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800/70 transition-colors whitespace-nowrap shrink-0"
                >
                  Universal Stopwatch
                </button>
              )}

              <button
                type="button"
                onClick={onResetUniversalSet}
                disabled={timer.universalElapsedSeconds === 0 && !timer.isRunning}
                className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl text-sm font-medium glass-subtle text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800/70 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-4 h-4" />
                New Set
              </button>

              <button
                type="button"
                onClick={() => onOpenFocusMode('stopwatch', null)}
                className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl text-sm font-medium glass-subtle text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800/70 transition-colors whitespace-nowrap shrink-0"
              >
                <Maximize2 className="w-4 h-4" />
                Focus
              </button>
            </div>
          </div>

          {/* Session Tag Selector */}
          <div className="pt-4 border-t border-slate-200/50 dark:border-white/10 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 mr-1">
              <Tag className="w-3.5 h-3.5" />
              Session Tag:
            </span>

            {SESSION_TAGS.map((tagName) => {
              const selected = timer.activeTag === tagName;
              return (
                <button
                  key={tagName}
                  type="button"
                  onClick={() => onSetActiveTag(selected ? null : tagName)}
                  aria-pressed={selected}
                  className={`h-7 px-2.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    selected
                      ? 'bg-[var(--accent)] text-[var(--accent-fg)]'
                      : 'glass-subtle text-slate-700 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-white/10'
                  }`}
                >
                  {tagName}
                </button>
              );
            })}

            {timer.activeTag && !isPresetTag && (
              <span className="inline-flex items-center gap-1 h-7 px-2.5 text-xs font-medium rounded-lg bg-[var(--accent)] text-[var(--accent-fg)]">
                {timer.activeTag}
                <button
                  type="button"
                  onClick={() => onSetActiveTag(null)}
                  aria-label="Clear custom session tag"
                  className="hover:opacity-75"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {showCustomTagForm ? (
              <form onSubmit={handleCustomTagSubmit} className="inline-flex items-center gap-1.5">
                <input
                  type="text"
                  maxLength={24}
                  value={customTagInput}
                  onChange={(e) => setCustomTagInput(e.target.value)}
                  placeholder="Custom tag..."
                  autoFocus
                  className="h-7 w-28 px-2 text-xs bg-white/80 dark:bg-slate-950/65 border border-slate-300/80 dark:border-white/15 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
                <button
                  type="submit"
                  className="h-7 px-2.5 text-xs font-medium rounded-lg bg-[var(--accent)] text-[var(--accent-fg)]"
                >
                  Set
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomTagForm(false);
                    setCustomTagInput('');
                  }}
                  aria-label="Cancel custom tag"
                  className="h-7 px-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowCustomTagForm(true)}
                className="inline-flex items-center gap-1 h-7 px-2.5 text-xs font-medium glass-subtle text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors"
              >
                <Plus className="w-3 h-3" />
                Custom
              </button>
            )}
          </div>
        </div>

        {/* Daily Goal Progress Bar */}
        <div className="h-1.5 w-full bg-slate-200/70 dark:bg-white/10">
          <div
            className="h-full bg-[var(--accent)] transition-all duration-300"
            style={{ width: `${goalPct}%` }}
          />
        </div>
      </section>

      {/* Subset: Banking Subjects with Topics + Countdown & Stopwatch */}
      <section aria-label="Subject timers" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              Subject Timers
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Choose a topic and run either a Countdown block or a Stopwatch for each subject.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-medium glass-subtle text-slate-800 dark:text-slate-100 hover:bg-white/80 dark:hover:bg-slate-800/70 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Subject
          </button>
        </div>

        {subjects.length === 0 ? (
          <div className="glass-panel rounded-2xl p-10 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              No subjects configured yet. Add a subject to track countdowns, stopwatches, and topics.
            </p>
            <button
              type="button"
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-medium text-white bg-[#0A84FF] hover:bg-[#0071E3] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create First Subject
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {subjects.map((sub) => {
              const cardMode = sub.preferredMode || 'countdown';
              const isActive =
                timer.isRunning &&
                timer.activeSubjectId === sub.id &&
                timer.activeMode === cardMode;

              const targetSec = Math.max(1, sub.targetMinutes * 60);
              const pctRemaining = Math.min(
                100,
                Math.max(0, Math.round((sub.remainingSeconds / targetSec) * 100))
              );
              const pctElapsed = 100 - pctRemaining;

              return (
                <div
                  key={sub.id}
                  className={`glass-panel rounded-2xl overflow-hidden transition-all ${
                    isActive ? 'ring-2' : ''
                  }`}
                  style={isActive ? { boxShadow: `0 0 0 2px ${sub.color}` } : undefined}
                >
                  <div className="p-5 space-y-4">
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white truncate">
                          {sub.name}
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          {sub.targetMinutes}m block · Today {formatHumanDuration(sub.todaySeconds)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(sub)}
                          aria-label={`Edit ${sub.name}`}
                          className="p-2 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {confirmDeleteId === sub.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteSubject(sub.id);
                                setConfirmDeleteId(null);
                              }}
                              className="px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/10 rounded-lg"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(sub.id)}
                            aria-label={`Delete ${sub.name}`}
                            className="p-2 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Per-Subject Mode Switch + Topic Selector */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <div className="inline-flex items-center p-0.5 glass-subtle rounded-xl">
                        <button
                          type="button"
                          onClick={() => onSetSubjectMode(sub.id, 'countdown')}
                          className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                            cardMode === 'countdown'
                              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          Countdown
                        </button>
                        <button
                          type="button"
                          onClick={() => onSetSubjectMode(sub.id, 'stopwatch')}
                          className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                            cardMode === 'stopwatch'
                              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          Stopwatch
                        </button>
                      </div>

                      {sub.topics.length > 0 && (
                        <select
                          aria-label={`Select topic for ${sub.name}`}
                          value={sub.activeTopicId || ''}
                          onChange={(e) => onSetSubjectTopic(sub.id, e.target.value || null)}
                          className="h-8 max-w-[200px] px-2.5 text-xs font-medium glass-subtle rounded-xl text-slate-700 dark:text-slate-200 truncate focus:outline-none focus:ring-2 focus:ring-[#0A84FF]"
                        >
                          {sub.topics.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Clock Readout */}
                    <div className="flex items-baseline justify-between gap-4">
                      <PreciseClock
                        mode={cardMode}
                        seconds={
                          cardMode === 'countdown' ? sub.remainingSeconds : sub.stopwatchSeconds
                        }
                        isActiveRunning={isActive}
                        lastTickAt={isActive ? timer.lastTickAt : null}
                        pausedSubMs={
                          !timer.isRunning &&
                          timer.activeSubjectId === sub.id &&
                          timer.activeMode === cardMode
                            ? timer.pausedSubMs || 0
                            : 0
                        }
                        className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 dark:text-white"
                        subClassName="text-[0.45em] opacity-65 font-medium"
                      />
                      <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {cardMode === 'countdown'
                          ? sub.remainingSeconds === 0
                            ? 'Complete'
                            : `${pctRemaining}% left`
                          : 'Count-up'}
                      </span>
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onToggleSubject(sub.id, cardMode)}
                        className={`flex-1 inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                          isActive
                            ? 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100'
                            : 'text-white hover:brightness-110'
                        }`}
                        style={!isActive ? { backgroundColor: sub.color } : undefined}
                      >
                        {isActive ? (
                          <>
                            <Pause className="w-4 h-4 fill-current" />
                            Pause
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 fill-current" />
                            {cardMode === 'countdown' && sub.remainingSeconds === 0
                              ? 'Restart'
                              : 'Start'}
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => onResetSubject(sub.id, cardMode)}
                        aria-label={`Reset ${sub.name} ${cardMode}`}
                        className="inline-flex items-center justify-center h-10 px-3 rounded-xl text-sm font-medium glass-subtle text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800/70 transition-colors"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenFocusMode(cardMode, sub.id)}
                        aria-label={`Open ${sub.name} in Focus Mode`}
                        className="inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl text-sm font-medium glass-subtle text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800/70 transition-colors whitespace-nowrap"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        Focus
                      </button>
                    </div>

                    {/* Subject Notes, Reminders, PDFs & Ask AI Shortcut */}
                    {(() => {
                      const subNotes = notes.filter((n) => n.subjectId === sub.id && !n.completed);
                      const subPdfs = pdfs.filter((p) => p.subjectId === sub.id);
                      const pinnedNote = subNotes.find((n) => n.pinned);
                      return (
                        <div className="pt-2 border-t border-slate-200/50 dark:border-white/10 flex items-center justify-between gap-2 text-xs">
                          <span className="text-slate-500 dark:text-slate-400 truncate">
                            {pinnedNote
                              ? `Pinned: ${pinnedNote.title}`
                              : `${subNotes.length} notes/reminders · ${subPdfs.length} PDFs`}
                          </span>
                          <div className="flex items-center gap-3 shrink-0">
                            <button
                              type="button"
                              onClick={() => onOpenAiAssistant(sub.id, sub.activeTopicId)}
                              className="inline-flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300 hover:text-[var(--accent)] whitespace-nowrap"
                            >
                              <Sparkles className="w-3 h-3 text-[var(--accent)]" />
                              Ask AI
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenLibrary(sub.id, sub.activeTopicId)}
                              className="font-medium text-[var(--accent)] hover:underline whitespace-nowrap"
                            >
                              Notes &amp; PDFs
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Thin Subject Accent Progress Bar */}
                  <div className="h-1 w-full bg-slate-200/70 dark:bg-white/10">
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width:
                          cardMode === 'countdown'
                            ? `${pctElapsed}%`
                            : `${Math.min(100, ((sub.stopwatchSeconds % 60) / 60) * 100)}%`,
                        backgroundColor: sub.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <SubjectModal
        isOpen={modalOpen}
        editingSubject={editingSubject}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveModal}
      />
    </div>
  );
}
