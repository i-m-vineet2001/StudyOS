import React, { useMemo, useRef, useState } from 'react';
import { Download, Search, Trash2, Upload } from 'lucide-react';
import { AppSettings, StudySession, StudyStore, Subject } from '../types/study';
import { formatHumanDuration, formatTimeClock, getLocalDateKey } from '../utils/time';

interface HistoryBackupViewProps {
  store: StudyStore;
  sessions: StudySession[];
  subjects: Subject[];
  settings: AppSettings;
  onDeleteSession: (id: string) => void;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onLoadSampleData: () => void;
  onResetBankingPreset: () => void;
  onClearAllData: () => void;
  onImportData: (rawJson: string) => { ok: boolean; error?: string };
}

export function HistoryBackupView({
  store,
  sessions,
  subjects,
  settings,
  onDeleteSession,
  onUpdateSettings,
  onLoadSampleData,
  onResetBankingPreset,
  onClearAllData,
  onImportData,
}: HistoryBackupViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [confirmClear, setConfirmClear] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sessions.filter((s) => {
      if (subjectFilter !== 'all' && s.subjectId !== subjectFilter) return false;
      if (
        q &&
        !s.subjectName.toLowerCase().includes(q) &&
        !(s.topicName || '').toLowerCase().includes(q) &&
        !(s.tag || '').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [sessions, subjectFilter, searchQuery]);

  const handleExportJSON = () => {
    const payload = JSON.stringify(store, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `studyos-backup-${getLocalDateKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage({ type: 'ok', text: 'Backup file downloaded to your device.' });
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const res = onImportData(text);
      if (res.ok) {
        setStatusMessage({ type: 'ok', text: 'Study history restored from backup file.' });
      } else {
        setStatusMessage({ type: 'err', text: res.error || 'Import failed.' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Session History &amp; Backup
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          All study sessions save instantaneously to local browser storage with portable JSON export.
        </p>
      </div>

      {/* Preferences & Local Storage Backup Panel */}
      <section className="glass-panel rounded-2xl p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label
              htmlFor="daily-goal-input"
              className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1.5"
            >
              Daily Study Goal (minutes)
            </label>
            <div className="flex items-center gap-3">
              <input
                id="daily-goal-input"
                type="number"
                min={15}
                max={960}
                step={15}
                value={settings.dailyGoalMinutes}
                onChange={(e) =>
                  onUpdateSettings({
                    dailyGoalMinutes: Math.max(15, Math.min(960, Number(e.target.value) || 60)),
                  })
                }
                className="w-32 h-10 px-3 text-sm font-mono tabular-nums bg-white/75 dark:bg-slate-950/60 border border-slate-300/80 dark:border-white/15 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0A84FF]"
              />
              <span className="text-sm text-slate-500 dark:text-slate-400 tabular-nums">
                = {formatHumanDuration(settings.dailyGoalMinutes * 60)} per day
              </span>
            </div>
          </div>

          <div className="flex flex-col justify-end">
            <span className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1.5">
              Portable Backup &amp; Presets
            </span>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleExportJSON}
                className="btn-accent inline-flex items-center gap-2 h-10 px-4 text-sm font-semibold rounded-xl transition-all whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                Export JSON
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 h-10 px-4 text-sm font-medium text-slate-700 dark:text-slate-200 glass-subtle hover:bg-white/80 dark:hover:bg-slate-800/70 rounded-xl transition-colors whitespace-nowrap"
              >
                <Upload className="w-4 h-4" />
                Import JSON
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleFileImport}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => {
                  onLoadSampleData();
                  setStatusMessage({ type: 'ok', text: '30-day sample study history loaded.' });
                }}
                className="inline-flex items-center h-10 px-4 text-sm font-medium text-slate-700 dark:text-slate-200 glass-subtle hover:bg-white/80 dark:hover:bg-slate-800/70 rounded-xl transition-colors whitespace-nowrap"
              >
                Load Sample Month
              </button>

              <button
                type="button"
                onClick={() => {
                  onResetBankingPreset();
                  setStatusMessage({ type: 'ok', text: 'Restored 4 Banking subjects and topics.' });
                }}
                className="inline-flex items-center h-10 px-4 text-sm font-medium text-slate-700 dark:text-slate-200 glass-subtle hover:bg-white/80 dark:hover:bg-slate-800/70 rounded-xl transition-colors whitespace-nowrap"
              >
                Banking Preset
              </button>

              {confirmClear ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClearAllData();
                      setConfirmClear(false);
                      setStatusMessage({ type: 'ok', text: 'All study data cleared.' });
                    }}
                    className="h-10 px-3 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors whitespace-nowrap"
                  >
                    Confirm Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="h-10 px-3 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/10 rounded-xl transition-colors whitespace-nowrap"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="inline-flex items-center h-10 px-4 text-sm font-medium text-red-600 dark:text-red-400 border border-red-300/60 dark:border-red-500/30 hover:bg-red-50/70 dark:hover:bg-red-950/30 rounded-xl transition-colors whitespace-nowrap"
                >
                  Clear All Data
                </button>
              )}
            </div>
          </div>
        </div>

        {statusMessage && (
          <p
            role="status"
            className={`text-xs font-medium ${
              statusMessage.type === 'ok'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {statusMessage.text}
          </p>
        )}
      </section>

      {/* High-Density Session Table */}
      <section className="glass-panel rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-200/70 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            Logged Sessions ({filteredSessions.length})
          </h2>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by subject, topic, or tag..."
                className="h-9 pl-9 pr-3 text-sm bg-white/75 dark:bg-slate-950/60 border border-slate-200/80 dark:border-white/15 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0A84FF]"
              />
            </div>

            <select
              aria-label="Filter sessions by subject"
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="h-9 px-3 text-sm bg-white/75 dark:bg-slate-950/60 border border-slate-200/80 dark:border-white/15 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0A84FF]"
            >
              <option value="all">All Subjects</option>
              <option value="universal">General Study</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredSessions.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No matching study sessions found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/70 dark:border-white/10 text-xs font-medium text-slate-500 dark:text-slate-400 bg-white/40 dark:bg-white/[0.03]">
                  <th className="py-2.5 px-5">Subject</th>
                  <th className="py-2.5 px-4">Topic</th>
                  <th className="py-2.5 px-4">Tag</th>
                  <th className="py-2.5 px-4">Mode</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Window</th>
                  <th className="py-2.5 px-4 text-right">Duration</th>
                  <th className="py-2.5 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/50 dark:divide-white/5 text-sm">
                {filteredSessions.slice(0, 120).map((s) => (
                  <tr
                    key={s.id}
                    className="h-11 hover:bg-white/50 dark:hover:bg-white/[0.04] transition-colors"
                  >
                    <td className="px-5 font-medium text-slate-900 dark:text-slate-100">
                      {s.subjectName}
                    </td>
                    <td className="px-4 text-slate-600 dark:text-slate-300">
                      {s.topicName || '—'}
                    </td>
                    <td className="px-4 text-slate-600 dark:text-slate-300">
                      {s.tag ? (
                        <span className="font-medium text-[var(--accent)]">{s.tag}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 text-slate-600 dark:text-slate-400 capitalize">
                      {s.mode}
                    </td>
                    <td className="px-4 font-mono tabular-nums text-xs text-slate-600 dark:text-slate-400">
                      {getLocalDateKey(s.startedAt)}
                    </td>
                    <td className="px-4 font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400">
                      {formatTimeClock(s.startedAt)} – {formatTimeClock(s.endedAt)}
                    </td>
                    <td className="px-4 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                      {formatHumanDuration(s.durationSeconds)}
                    </td>
                    <td className="px-5 text-right">
                      <button
                        type="button"
                        onClick={() => onDeleteSession(s.id)}
                        aria-label={`Delete ${s.subjectName} session`}
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
