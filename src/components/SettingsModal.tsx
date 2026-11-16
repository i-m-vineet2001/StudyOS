import { Moon, Sun, Volume2, VolumeX, X } from 'lucide-react';
import { AppSettings } from '../types/study';
import { COLOR_THEMES } from '../utils/themes';
import { formatHumanDuration } from '../utils/time';

interface SettingsModalProps {
  isOpen: boolean;
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onClose: () => void;
}

export function SettingsModal({
  isOpen,
  settings,
  onUpdateSettings,
  onClose,
}: SettingsModalProps) {
  if (!isOpen) return null;

  const glowPct = Math.max(0, Math.min(100, settings.glowIntensity ?? 70));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="w-full max-w-lg glass-panel rounded-2xl p-6 max-h-[90vh] overflow-y-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2
            id="settings-modal-title"
            className="font-display text-lg font-semibold text-slate-900 dark:text-white"
          >
            StudyOS Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Profile Greeting Name */}
        <div>
          <label
            htmlFor="settings-user-name"
            className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1.5"
          >
            Your Name
          </label>
          <input
            id="settings-user-name"
            type="text"
            maxLength={36}
            value={settings.userName || ''}
            onChange={(e) => onUpdateSettings({ userName: e.target.value })}
            placeholder="Enter your name (e.g., Vineet)"
            className="w-full h-10 px-3 text-sm bg-white/75 dark:bg-slate-950/60 border border-slate-300/80 dark:border-white/15 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Personalizes your workspace greeting (e.g., &ldquo;Hi,{' '}
            {settings.userName?.trim() || 'there'}&rdquo;).
          </p>
        </div>

        {/* Appearance & Chime */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <span className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1.5">
              Appearance
            </span>
            <div className="inline-flex w-full p-1 glass-subtle rounded-xl">
              <button
                type="button"
                onClick={() => onUpdateSettings({ theme: 'light' })}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 h-8 text-xs font-medium rounded-lg transition-colors ${
                  settings.theme === 'light'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                Light
              </button>
              <button
                type="button"
                onClick={() => onUpdateSettings({ theme: 'dark' })}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 h-8 text-xs font-medium rounded-lg transition-colors ${
                  settings.theme === 'dark'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                Dark
              </button>
            </div>
          </div>

          <div>
            <span className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1.5">
              Completion Chime
            </span>
            <div className="inline-flex w-full p-1 glass-subtle rounded-xl">
              <button
                type="button"
                onClick={() => onUpdateSettings({ soundEnabled: true })}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 h-8 text-xs font-medium rounded-lg transition-colors ${
                  settings.soundEnabled
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5" />
                On
              </button>
              <button
                type="button"
                onClick={() => onUpdateSettings({ soundEnabled: false })}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 h-8 text-xs font-medium rounded-lg transition-colors ${
                  !settings.soundEnabled
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <VolumeX className="w-3.5 h-3.5" />
                Muted
              </button>
            </div>
          </div>
        </div>

        {/* Color Theme Picker */}
        <div>
          <span className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
            Color Theme
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {COLOR_THEMES.map((themeItem) => {
              const selected = (settings.colorTheme || 'sapphire') === themeItem.id;
              return (
                <button
                  key={themeItem.id}
                  type="button"
                  onClick={() => onUpdateSettings({ colorTheme: themeItem.id })}
                  className={`flex items-center gap-2.5 h-10 px-3 rounded-xl text-xs font-medium transition-all border ${
                    selected
                      ? 'border-[var(--accent)] bg-white/80 dark:bg-white/10 text-slate-900 dark:text-white'
                      : 'glass-subtle border-transparent text-slate-700 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-white/10'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{
                      backgroundColor: themeItem.swatchHex,
                      boxShadow: selected ? `0 0 10px ${themeItem.swatchHex}` : undefined,
                    }}
                  />
                  <span className="truncate">{themeItem.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Glow Intensity Slider */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="settings-glow-slider"
              className="text-sm font-medium text-slate-800 dark:text-slate-200"
            >
              Glow Effect Intensity
            </label>
            <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
              {glowPct}%
            </span>
          </div>
          <input
            id="settings-glow-slider"
            type="range"
            min={0}
            max={100}
            step={5}
            value={glowPct}
            onChange={(e) => onUpdateSettings({ glowIntensity: Number(e.target.value) })}
            className="w-full accent-[var(--accent)] cursor-pointer"
          />
          <div className="flex justify-between text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
            <span>Off (0%)</span>
            <span>Balanced (70%)</span>
            <span>Radiant (100%)</span>
          </div>
        </div>

        {/* Daily Goal */}
        <div>
          <label
            htmlFor="settings-daily-goal"
            className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1.5"
          >
            Daily Study Goal (minutes)
          </label>
          <div className="flex items-center gap-3">
            <input
              id="settings-daily-goal"
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
              className="w-32 h-10 px-3 text-sm font-mono tabular-nums bg-white/75 dark:bg-slate-950/60 border border-slate-300/80 dark:border-white/15 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {formatHumanDuration(settings.dailyGoalMinutes * 60)} per day
            </span>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="btn-accent h-10 px-5 text-sm font-semibold rounded-xl transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
