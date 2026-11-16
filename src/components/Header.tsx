import { AppView } from '../types/study';

interface HeaderProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  onOpenFocusMode: () => void;
}

export function Header({ activeView, onNavigate, onOpenFocusMode }: HeaderProps) {
  const navItems: { id: AppView; label: string }[] = [
    { id: 'timer', label: 'Timer' },
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'library', label: 'Library' },
    { id: 'history', label: 'History' },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white/65 dark:bg-[#060911]/65 backdrop-blur-2xl border-b border-white/60 dark:border-white/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('timer')}
          className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded"
        >
          StudyOS
        </button>

        {/* Zone 2: Clean Typography Navigation Links */}
        <nav className="flex items-center gap-6 sm:gap-8" aria-label="Primary">
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`relative py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF] rounded ${
                  isActive
                    ? 'text-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[17px] h-0.5 bg-[var(--accent)]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={onOpenFocusMode}
            className="btn-accent px-4 py-2 text-sm font-semibold active:scale-[0.98] rounded-xl transition-all whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-black"
          >
            Focus Mode
          </button>
        </div>
      </div>
    </header>
  );
}
