import { useEffect } from 'react';
import { Pause, Play, RotateCcw, X } from 'lucide-react';
import { useLiveSubMs } from '../hooks/useLiveSubMs';
import { Subject, TimerState } from '../types/study';
import { formatHMS } from '../utils/time';
import { PreciseClock } from './PreciseClock';

interface FocusModeProps {
  timer: TimerState;
  subjects: Subject[];
  activeSubject: Subject | null;
  glowIntensity: number;
  onTogglePlayPause: () => void;
  onSelectMode: (mode: 'stopwatch' | 'countdown', subjectId?: string | null) => void;
  onSelectTopic: (subjectId: string, topicId: string | null) => void;
  onResetCurrent: () => void;
  onExit: () => void;
}

export function FocusMode({
  timer,
  subjects,
  activeSubject,
  glowIntensity,
  onTogglePlayPause,
  onSelectMode,
  onSelectTopic,
  onResetCurrent,
  onExit,
}: FocusModeProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      ) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        onTogglePlayPause();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onExit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onTogglePlayPause, onExit]);

  const isCountdown = timer.activeMode === 'countdown' && activeSubject !== null;
  const isSubjectStopwatch = timer.activeMode === 'stopwatch' && activeSubject !== null;
  const pausedSub = timer.pausedSubMs || 0;
  const subMs = useLiveSubMs(timer.isRunning, timer.lastTickAt, pausedSub);

  const ringColor = activeSubject ? activeSubject.color : 'var(--accent)';

  const radius = 136;
  const circumference = 2 * Math.PI * radius;

  let progressFraction = 0;
  if (isCountdown && activeSubject) {
    const totalMs = Math.max(1000, activeSubject.targetMinutes * 60 * 1000);
    const remMs =
      timer.isRunning && activeSubject.remainingSeconds > 0
        ? Math.max(0, activeSubject.remainingSeconds * 1000 - subMs)
        : !timer.isRunning && activeSubject.remainingSeconds > 0 && pausedSub > 0
          ? Math.max(0, activeSubject.remainingSeconds * 1000 - pausedSub)
          : activeSubject.remainingSeconds * 1000;
    progressFraction = Math.min(1, Math.max(0, remMs / totalMs));
  } else {
    const currentSeconds = isSubjectStopwatch
      ? activeSubject.stopwatchSeconds
      : timer.universalElapsedSeconds;
    const msMod = (currentSeconds % 60) * 1000 + (timer.isRunning ? subMs : pausedSub);
    progressFraction = currentSeconds === 0 && msMod === 0 ? 0 : Math.min(1, msMod / 60000);
  }

  const strokeDashoffset = circumference * (1 - progressFraction);
  const angleRad = (progressFraction * 360 - 90) * (Math.PI / 180);
  const tipX = 160 + radius * Math.cos(angleRad);
  const tipY = 160 + radius * Math.sin(angleRad);

  const activeTopic =
    activeSubject && activeSubject.activeTopicId
      ? activeSubject.topics.find((t) => t.id === activeSubject.activeTopicId)
      : null;

  const displaySeconds = isCountdown
    ? activeSubject.remainingSeconds
    : isSubjectStopwatch
      ? activeSubject.stopwatchSeconds
      : timer.universalElapsedSeconds;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-between apple-canvas text-slate-900 dark:text-slate-100 px-6 py-6 sm:px-10 sm:py-8 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Focus Mode"
    >
      {/* Frosted Minimal Top Bar */}
      <div className="max-w-4xl w-full mx-auto flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center p-1 glass-subtle rounded-xl">
            <button
              type="button"
              onClick={() => onSelectMode('stopwatch', activeSubject?.id ?? null)}
              className={`px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap shrink-0 ${
                !isCountdown
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Stopwatch
            </button>
            <button
              type="button"
              disabled={subjects.length === 0}
              onClick={() => onSelectMode('countdown', activeSubject?.id || subjects[0]?.id)}
              className={`px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap shrink-0 disabled:opacity-40 ${
                isCountdown
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Timer
            </button>
          </div>

          {subjects.length > 0 && (
            <select
              aria-label="Select focus target"
              value={activeSubject?.id || '__universal__'}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '__universal__') {
                  onSelectMode('stopwatch', null);
                } else {
                  onSelectMode(isCountdown ? 'countdown' : 'stopwatch', val);
                }
              }}
              className="h-9 px-3 text-sm font-medium glass-subtle rounded-xl text-slate-800 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF]"
            >
              {!isCountdown && <option value="__universal__">Universal Stopwatch</option>}
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          )}

          {activeSubject && activeSubject.topics.length > 0 && (
            <select
              aria-label="Select topic"
              value={activeSubject.activeTopicId || ''}
              onChange={(e) => onSelectTopic(activeSubject.id, e.target.value || null)}
              className="h-9 px-3 text-sm glass-subtle rounded-xl text-slate-700 dark:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF]"
            >
              {activeSubject.topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium glass-subtle text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800/80 rounded-xl transition-colors whitespace-nowrap shrink-0"
        >
          <X className="w-4 h-4" />
          Exit
        </button>
      </div>

      {/* Circular Stopwatch / Timer with Smooth 60fps Glowing Ring */}
      <div className="flex-1 flex flex-col items-center justify-center text-center my-6">
        <div className="relative flex items-center justify-center">
          <div
            aria-hidden="true"
            className="absolute inset-4 rounded-full blur-3xl transition-opacity duration-500 pointer-events-none"
            style={{
              backgroundColor: ringColor,
              opacity:
                (timer.isRunning ? 0.36 : 0.14) *
                (Math.max(0, Math.min(100, glowIntensity)) / 100),
            }}
          />

          <button
            type="button"
            onClick={onTogglePlayPause}
            aria-label={timer.isRunning ? 'Pause timer' : 'Play timer'}
            className="relative group w-[304px] h-[304px] sm:w-[360px] sm:h-[360px] rounded-full glass-panel flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] transition-transform active:scale-[0.985]"
          >
            <svg
              viewBox="0 0 320 320"
              className="absolute inset-0 w-full h-full"
              aria-hidden="true"
            >
              <defs>
                <filter id="cadence-ring-glow" x="-25%" y="-25%" width="150%" height="150%">
                  <feGaussianBlur
                    stdDeviation={(8 * (Math.max(0, Math.min(100, glowIntensity)) / 100)).toFixed(1)}
                    result="coloredBlur"
                  />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {Array.from({ length: 60 }, (_, idx) => {
                const a = (idx * 6 - 90) * (Math.PI / 180);
                const isMajor = idx % 5 === 0;
                const rOuter = 152;
                const rInner = isMajor ? 144 : 148;
                return (
                  <line
                    key={idx}
                    x1={160 + rInner * Math.cos(a)}
                    y1={160 + rInner * Math.sin(a)}
                    x2={160 + rOuter * Math.cos(a)}
                    y2={160 + rOuter * Math.sin(a)}
                    stroke="currentColor"
                    strokeWidth={isMajor ? 1.5 : 0.8}
                    className={
                      isMajor
                        ? 'text-slate-400/60 dark:text-white/25'
                        : 'text-slate-300/60 dark:text-white/10'
                    }
                  />
                );
              })}

              <circle
                cx="160"
                cy="160"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="7"
                className="text-slate-200/70 dark:text-white/10"
              />

              <circle
                cx="160"
                cy="160"
                r={radius}
                fill="none"
                stroke={ringColor}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                transform="rotate(-90 160 160)"
                filter="url(#cadence-ring-glow)"
              />

              {progressFraction > 0 && (
                <circle
                  cx={tipX}
                  cy={tipY}
                  r="6"
                  fill="#ffffff"
                  stroke={ringColor}
                  strokeWidth="3"
                  filter="url(#cadence-ring-glow)"
                />
              )}
            </svg>

            <div className="relative z-10 flex flex-col items-center px-5">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 max-w-[200px] truncate">
                {activeSubject
                  ? `${activeSubject.name} · ${isCountdown ? 'Timer' : 'Stopwatch'}`
                  : 'Universal Stopwatch'}
              </span>

              <PreciseClock
                mode={isCountdown ? 'countdown' : 'stopwatch'}
                seconds={displaySeconds}
                isActiveRunning={timer.isRunning}
                lastTickAt={timer.lastTickAt}
                pausedSubMs={pausedSub}
                className="mt-2 font-semibold tracking-tight leading-none text-[2.25rem] sm:text-[2.7rem] text-slate-900 dark:text-white"
                subClassName="text-[0.44em] opacity-70 font-medium"
              />

              {activeTopic ? (
                <span className="mt-2.5 text-xs font-medium text-slate-600 dark:text-slate-300 max-w-[210px] truncate">
                  {activeTopic.name}
                </span>
              ) : (
                <span className="mt-2.5 text-xs text-slate-400 dark:text-slate-500">
                  {timer.isRunning ? 'Tap dial to pause' : 'Tap dial to play'}
                </span>
              )}
            </div>
          </button>
        </div>

        {/* One-Tap Play / Pause Controls */}
        <div className="mt-8 flex items-center gap-4">
          <button
            type="button"
            onClick={onTogglePlayPause}
            className={`inline-flex items-center justify-center gap-3 min-w-[196px] h-14 px-8 rounded-2xl text-base font-semibold transition-all whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
              timer.isRunning
                ? 'glass-panel text-slate-900 dark:text-white hover:bg-white/90 dark:hover:bg-slate-800/80'
                : 'btn-accent'
            }`}
          >
            {timer.isRunning ? (
              <>
                <Pause className="w-5 h-5 fill-current" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" />
                Play
              </>
            )}
          </button>

          {!timer.isRunning && (
            <button
              type="button"
              onClick={onResetCurrent}
              aria-label="Reset current timer"
              className="inline-flex items-center justify-center gap-2 h-14 px-5 rounded-2xl text-sm font-medium glass-subtle text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800/80 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          )}
        </div>

        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
          Universal set: {formatHMS(timer.universalElapsedSeconds)}
        </p>
      </div>

      <div className="text-center text-xs text-slate-500 dark:text-slate-400">
        Space to play or pause · Esc to exit
      </div>
    </div>
  );
}
