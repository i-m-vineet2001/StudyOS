import { useMemo, useState } from 'react';
import { AppSettings, DashboardRange, StudySession } from '../types/study';
import {
  addDays,
  formatHumanDuration,
  formatShortDate,
  formatWeekdayShort,
  getLocalDateKey,
  pad2,
  startOfLocalDay,
} from '../utils/time';

interface DashboardViewProps {
  sessions: StudySession[];
  settings: AppSettings;
  onGoToTimer: () => void;
  onLoadSampleData: () => void;
}

interface BucketDetail {
  label: string;
  shortAxis: string;
  seconds: number;
  topSubject: string | null;
}

function getOverlapSeconds(session: StudySession, rangeStart: number, rangeEnd: number): number {
  const sStart = session.startedAt;
  const sEnd = Math.max(session.startedAt + session.durationSeconds * 1000, session.endedAt);
  const overlapMs = Math.max(0, Math.min(sEnd, rangeEnd) - Math.max(sStart, rangeStart));
  return Math.round(overlapMs / 1000);
}

function getHeatLevel(seconds: number, mode: DashboardRange, isBlock = false): 0 | 1 | 2 | 3 | 4 {
  if (seconds <= 0) return 0;
  const mins = seconds / 60;
  if (mode === '1d') {
    if (mins < 15) return 1;
    if (mins < 30) return 2;
    if (mins < 45) return 3;
    return 4;
  }
  if (mode === '1w' && isBlock) {
    if (mins < 25) return 1;
    if (mins < 60) return 2;
    if (mins < 110) return 3;
    return 4;
  }
  if (mins < 30) return 1;
  if (mins < 60) return 2;
  if (mins < 120) return 3;
  return 4;
}

const HEAT_CELL_CLASSES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-slate-200/55 dark:bg-white/[0.06] border border-slate-300/35 dark:border-white/10',
  1: 'bg-sky-400/80 dark:bg-sky-500/50 border border-sky-500/40 dark:border-sky-400/40',
  2: 'bg-emerald-400/85 dark:bg-emerald-500/65 border border-emerald-500/50 dark:border-emerald-400/50',
  3: 'bg-amber-400/90 dark:bg-amber-500/80 border border-amber-500/60 dark:border-amber-400/60',
  4: 'bg-rose-500 dark:bg-rose-500/90 border border-rose-600/60 dark:border-rose-400/70',
};

const HEAT_BAR_CLASSES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-slate-300/45 dark:bg-white/10',
  1: 'bg-gradient-to-t from-sky-500 to-cyan-400',
  2: 'bg-gradient-to-t from-emerald-500 to-teal-400',
  3: 'bg-gradient-to-t from-amber-500 to-yellow-400',
  4: 'bg-gradient-to-t from-rose-500 to-orange-400',
};

export function DashboardView({
  sessions,
  settings,
  onGoToTimer,
  onLoadSampleData,
}: DashboardViewProps) {
  const [range, setRange] = useState<DashboardRange>('1m');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [matrixTab, setMatrixTab] = useState<'topics' | 'tags'>('topics');
  const [hoveredDetail, setHoveredDetail] = useState<BucketDetail | null>(null);

  const now = Date.now();
  const todayStart = startOfLocalDay(new Date(now));
  const tomorrowStart = addDays(todayStart, 1).getTime();

  const { rangeStartMs, rangeEndMs, rangeTitle, daysInRange } = useMemo(() => {
    if (range === '1d') {
      return {
        rangeStartMs: todayStart.getTime(),
        rangeEndMs: tomorrowStart,
        rangeTitle: `Today · ${formatShortDate(todayStart)}`,
        daysInRange: 1,
      };
    }
    if (range === '1w') {
      const start = addDays(todayStart, -6);
      return {
        rangeStartMs: start.getTime(),
        rangeEndMs: tomorrowStart,
        rangeTitle: `7 Days · ${formatShortDate(start)} – ${formatShortDate(todayStart)}`,
        daysInRange: 7,
      };
    }
    const start = addDays(todayStart, -29);
    return {
      rangeStartMs: start.getTime(),
      rangeEndMs: tomorrowStart,
      rangeTitle: `30 Days · ${formatShortDate(start)} – ${formatShortDate(todayStart)}`,
      daysInRange: 30,
    };
  }, [range, todayStart, tomorrowStart]);

  // Subject breakdown across the full timeframe (for the Power BI cross-filter slicer + donut)
  const { allRangeTotalSeconds, subjectBreakdown } = useMemo(() => {
    let total = 0;
    const bySubject = new Map<string, { name: string; color: string; seconds: number }>();

    for (const s of sessions) {
      const overlap = getOverlapSeconds(s, rangeStartMs, rangeEndMs);
      if (overlap > 0) {
        total += overlap;
        const cur = bySubject.get(s.subjectId) || {
          name: s.subjectName,
          color: s.subjectColor,
          seconds: 0,
        };
        cur.seconds += overlap;
        bySubject.set(s.subjectId, cur);
      }
    }

    const breakdown = Array.from(bySubject.entries())
      .map(([id, data]) => ({
        id,
        ...data,
        sharePct: total > 0 ? Math.round((data.seconds / total) * 100) : 0,
      }))
      .sort((a, b) => b.seconds - a.seconds);

    return { allRangeTotalSeconds: total, subjectBreakdown: breakdown };
  }, [sessions, rangeStartMs, rangeEndMs]);

  // Cross-filtered sessions (when a user clicks a subject in the donut/bars or slicer)
  const scopedSessions = useMemo(
    () =>
      selectedSubjectId === 'all'
        ? sessions
        : sessions.filter((s) => s.subjectId === selectedSubjectId),
    [sessions, selectedSubjectId]
  );

  const selectedSubjectName = useMemo(
    () => subjectBreakdown.find((s) => s.id === selectedSubjectId)?.name || null,
    [subjectBreakdown, selectedSubjectId]
  );

  const {
    totalSeconds,
    sessionCount,
    avgSessionSeconds,
    topicBreakdown,
    tagBreakdown,
    streakDays,
  } = useMemo(() => {
    let total = 0;
    let count = 0;
    const byTopic = new Map<
      string,
      { name: string; subjectName: string; color: string; seconds: number }
    >();
    const byTag = new Map<string, { name: string; seconds: number; count: number }>();

    for (const s of scopedSessions) {
      const overlap = getOverlapSeconds(s, rangeStartMs, rangeEndMs);
      if (overlap > 0) {
        total += overlap;
        count += 1;

        if (s.topicName) {
          const tKey = `${s.subjectId}_${s.topicName}`;
          const curTopic = byTopic.get(tKey) || {
            name: s.topicName,
            subjectName: s.subjectName,
            color: s.subjectColor,
            seconds: 0,
          };
          curTopic.seconds += overlap;
          byTopic.set(tKey, curTopic);
        }

        const tagLabel = s.tag || 'Untagged';
        const curTag = byTag.get(tagLabel) || { name: tagLabel, seconds: 0, count: 0 };
        curTag.seconds += overlap;
        curTag.count += 1;
        byTag.set(tagLabel, curTag);
      }
    }

    const topics = Array.from(byTopic.entries())
      .map(([id, data]) => ({
        id,
        ...data,
        sharePct: total > 0 ? Math.round((data.seconds / total) * 100) : 0,
      }))
      .sort((a, b) => b.seconds - a.seconds);

    const tags = Array.from(byTag.values())
      .map((data) => ({
        ...data,
        sharePct: total > 0 ? Math.round((data.seconds / total) * 100) : 0,
      }))
      .sort((a, b) => b.seconds - a.seconds);

    const activeDates = new Set<string>();
    for (const s of scopedSessions) {
      if (s.durationSeconds >= 10) {
        activeDates.add(getLocalDateKey(s.startedAt));
      }
    }
    let streak = 0;
    let cursor = todayStart;
    if (!activeDates.has(getLocalDateKey(cursor))) {
      cursor = addDays(cursor, -1);
    }
    while (activeDates.has(getLocalDateKey(cursor))) {
      streak += 1;
      cursor = addDays(cursor, -1);
    }

    return {
      totalSeconds: total,
      sessionCount: count,
      avgSessionSeconds: count > 0 ? Math.round(total / count) : 0,
      topicBreakdown: topics,
      tagBreakdown: tags,
      streakDays: streak,
    };
  }, [scopedSessions, rangeStartMs, rangeEndMs, todayStart]);

  // 1-Day: 24 hourly buckets
  const hourlyBuckets = useMemo(() => {
    const baseMs = todayStart.getTime();
    return Array.from({ length: 24 }, (_, hour) => {
      const start = baseMs + hour * 3600 * 1000;
      const end = start + 3600 * 1000;
      let sec = 0;
      const subjTotals: Record<string, number> = {};

      for (const s of scopedSessions) {
        const overlap = getOverlapSeconds(s, start, end);
        if (overlap > 0) {
          sec += overlap;
          subjTotals[s.subjectName] = (subjTotals[s.subjectName] || 0) + overlap;
        }
      }
      const top = Object.entries(subjTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      return {
        hour,
        label: `${pad2(hour)}:00 – ${pad2((hour + 1) % 24)}:00`,
        shortAxis: `${pad2(hour)}`,
        seconds: sec,
        topSubject: top,
      };
    });
  }, [scopedSessions, todayStart]);

  // 1-Week: 7 days x 4 time-of-day rows
  const weeklyData = useMemo(() => {
    const blocks = [
      { id: 'morning', label: '06–12', startH: 6, endH: 12 },
      { id: 'afternoon', label: '12–18', startH: 12, endH: 18 },
      { id: 'evening', label: '18–22', startH: 18, endH: 22 },
      { id: 'night', label: '22–06', startH: 22, endH: 30 },
    ];

    const days = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(todayStart, i - 6);
      const dayStart = d.getTime();
      const dayEnd = addDays(d, 1).getTime();

      let dayTotal = 0;
      const daySubj: Record<string, number> = {};

      for (const s of scopedSessions) {
        const overlap = getOverlapSeconds(s, dayStart, dayEnd);
        if (overlap > 0) {
          dayTotal += overlap;
          daySubj[s.subjectName] = (daySubj[s.subjectName] || 0) + overlap;
        }
      }
      const dayTop = Object.entries(daySubj).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

      const cells = blocks.map((b) => {
        const bStart = dayStart + b.startH * 3600 * 1000;
        const bEnd = dayStart + b.endH * 3600 * 1000;
        let sec = 0;
        const subjTotals: Record<string, number> = {};

        for (const s of scopedSessions) {
          const overlap = getOverlapSeconds(s, bStart, bEnd);
          if (overlap > 0) {
            sec += overlap;
            subjTotals[s.subjectName] = (subjTotals[s.subjectName] || 0) + overlap;
          }
        }
        const top = Object.entries(subjTotals).sort((a, b2) => b2[1] - a[1])[0]?.[0] || null;
        return {
          blockId: b.id,
          label: `${formatShortDate(d)} · ${b.label}`,
          shortAxis: formatWeekdayShort(d),
          seconds: sec,
          topSubject: top,
        };
      });

      return {
        dateKey: getLocalDateKey(d),
        dayLabel: formatWeekdayShort(d),
        shortDate: formatShortDate(d),
        totalSeconds: dayTotal,
        topSubject: dayTop,
        cells,
      };
    });

    return { blocks, days };
  }, [scopedSessions, todayStart]);

  // 1-Month: 30 daily buckets + padded calendar cells
  const { monthDays, monthlyCalendarCells } = useMemo(() => {
    const startDate = addDays(todayStart, -29);
    const jsDay = startDate.getDay();
    const mondayOffset = jsDay === 0 ? 6 : jsDay - 1;
    const todayKey = getLocalDateKey(todayStart);

    const daysList: Array<{
      dateKey: string;
      label: string;
      shortAxis: string;
      dayNum: number;
      seconds: number;
      topSubject: string | null;
      isToday: boolean;
    }> = [];

    for (let i = 0; i < 30; i++) {
      const d = addDays(startDate, i);
      const dStart = d.getTime();
      const dEnd = addDays(d, 1).getTime();
      let sec = 0;
      const subjTotals: Record<string, number> = {};

      for (const s of scopedSessions) {
        const overlap = getOverlapSeconds(s, dStart, dEnd);
        if (overlap > 0) {
          sec += overlap;
          subjTotals[s.subjectName] = (subjTotals[s.subjectName] || 0) + overlap;
        }
      }
      const top = Object.entries(subjTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      const key = getLocalDateKey(d);
      daysList.push({
        dateKey: key,
        label: `${formatWeekdayShort(d)}, ${formatShortDate(d)}`,
        shortAxis: `${d.getDate()}`,
        dayNum: d.getDate(),
        seconds: sec,
        topSubject: top,
        isToday: key === todayKey,
      });
    }

    const padded: Array<(typeof daysList)[number] & { isPlaceholder: boolean }> = [];
    for (let p = 0; p < mondayOffset; p++) {
      padded.push({
        isPlaceholder: true,
        dateKey: `pad_${p}`,
        label: '',
        shortAxis: '',
        dayNum: 0,
        seconds: 0,
        topSubject: null,
        isToday: false,
      });
    }
    for (const d of daysList) {
      padded.push({ ...d, isPlaceholder: false });
    }

    return { monthDays: daysList, monthlyCalendarCells: padded };
  }, [scopedSessions, todayStart]);

  const heatBars: BucketDetail[] = useMemo(() => {
    if (range === '1d') {
      return hourlyBuckets.map((b) => ({
        label: b.label,
        shortAxis: b.hour % 4 === 0 ? `${pad2(b.hour)}h` : '',
        seconds: b.seconds,
        topSubject: b.topSubject,
      }));
    }
    if (range === '1w') {
      return weeklyData.days.map((d) => ({
        label: `${d.dayLabel}, ${d.shortDate}`,
        shortAxis: d.dayLabel,
        seconds: d.totalSeconds,
        topSubject: d.topSubject,
      }));
    }
    return monthDays.map((d, idx) => ({
      label: d.label,
      shortAxis: idx % 5 === 0 || idx === monthDays.length - 1 ? d.shortAxis : '',
      seconds: d.seconds,
      topSubject: d.topSubject,
    }));
  }, [range, hourlyBuckets, weeklyData, monthDays]);

  const dailyGoalSeconds = Math.max(60, settings.dailyGoalMinutes * 60);
  const periodGoalSeconds = dailyGoalSeconds * daysInRange;
  const goalAttainmentPct = Math.min(100, Math.round((totalSeconds / periodGoalSeconds) * 100));

  const maxBarSeconds = useMemo(() => {
    const peak = Math.max(...heatBars.map((b) => b.seconds), 0);
    if (range === '1d') return Math.max(peak, 3600);
    return Math.max(peak, dailyGoalSeconds);
  }, [heatBars, range, dailyGoalSeconds]);

  const goalLineBottomPct =
    range !== '1d' && maxBarSeconds > 0
      ? Math.min(96, Math.round((dailyGoalSeconds / maxBarSeconds) * 100))
      : null;

  // Power BI Donut SVG geometry
  const donutRadius = 52;
  const donutCirc = 2 * Math.PI * donutRadius;
  const donutSegments = useMemo(() => {
    let offset = 0;
    return subjectBreakdown.map((sub) => {
      const fraction = allRangeTotalSeconds > 0 ? sub.seconds / allRangeTotalSeconds : 0;
      const dashLen = fraction * donutCirc;
      const seg = {
        ...sub,
        dashArray: `${Math.max(0, dashLen - 2)} ${donutCirc}`,
        dashOffset: -offset,
      };
      offset += dashLen;
      return seg;
    });
  }, [subjectBreakdown, allRangeTotalSeconds, donutCirc]);

  return (
    <div className="space-y-4">
      {/* Power BI Report Header + Slicers */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-1">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Analytics
          </h1>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {rangeTitle}
          </span>
          {selectedSubjectName && (
            <>
              <span aria-hidden="true" className="text-slate-400">
                ·
              </span>
              <span className="text-xs font-semibold text-[var(--accent)]">
                Filtered: {selectedSubjectName}
              </span>
              <button
                type="button"
                onClick={() => setSelectedSubjectId('all')}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white underline underline-offset-2"
              >
                Clear
              </button>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Subject Cross-Filter Slicer */}
          <select
            aria-label="Filter dashboard by subject"
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="h-9 px-3 text-xs font-medium glass-subtle rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            <option value="all">All Subjects</option>
            {subjectBreakdown.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>

          {/* Timeframe Slicer */}
          <div
            className="inline-flex items-center p-1 glass-subtle rounded-xl"
            role="tablist"
            aria-label="Timeframe"
          >
            {(
              [
                { id: '1d', label: '1D' },
                { id: '1w', label: '1W' },
                { id: '1m', label: '1M' },
              ] as const
            ).map((tab) => {
              const active = range === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setRange(tab.id);
                    setHoveredDetail(null);
                  }}
                  className={`px-3.5 py-1 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Empty State Prompt */}
      {sessions.length === 0 && (
        <div className="glass-panel rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
              No study sessions recorded yet
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Start a subject timer or load a sample month to populate the analytics grid.
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onGoToTimer}
              className="btn-accent h-9 px-4 text-xs font-semibold rounded-xl transition-all whitespace-nowrap"
            >
              Start Studying
            </button>
            <button
              type="button"
              onClick={onLoadSampleData}
              className="h-9 px-4 text-xs font-medium text-slate-700 dark:text-slate-200 glass-subtle hover:bg-white/80 dark:hover:bg-slate-800/70 rounded-xl transition-colors whitespace-nowrap"
            >
              Load Sample Month
            </button>
          </div>
        </div>
      )}

      {/* ROW 1: 4 Power BI KPI Grid Cards */}
      <section
        aria-label="Key performance indicators"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Studied
          </span>
          <p className="mt-2 font-mono tabular-nums text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            {formatHumanDuration(totalSeconds)}
          </p>
          <span className="mt-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {range === '1d'
              ? `Goal ${formatHumanDuration(dailyGoalSeconds)}`
              : `Avg ${formatHumanDuration(Math.round(totalSeconds / daysInRange))} / day`}
          </span>
        </div>

        <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Goal Progress
          </span>
          <p className="mt-2 font-mono tabular-nums text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            {goalAttainmentPct}%
          </p>
          <div className="mt-2 h-1.5 w-full bg-slate-200/75 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] rounded-full transition-all duration-300"
              style={{ width: `${goalAttainmentPct}%` }}
            />
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Study Streak
          </span>
          <p className="mt-2 font-mono tabular-nums text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            {streakDays}d
          </p>
          <span className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Consecutive active days
          </span>
        </div>

        <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Sessions
          </span>
          <p className="mt-2 font-mono tabular-nums text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            {sessionCount}
          </p>
          <span className="mt-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {sessionCount > 0 ? `Avg ${formatHumanDuration(avgSessionSeconds)}` : 'No activity'}
          </span>
        </div>
      </section>

      {/* ROW 2: Primary Power BI Visual Grid (7 cols Heat Bar + 5 cols Subject Donut) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Tile A: Heat Bar Graph */}
        <section
          aria-label="Study heat bar graph"
          className="lg:col-span-7 glass-panel rounded-2xl p-5 flex flex-col justify-between"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                {range === '1d'
                  ? 'Hourly Output'
                  : range === '1w'
                    ? 'Daily Output (7D)'
                    : 'Daily Output (30D)'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                {hoveredDetail
                  ? `${hoveredDetail.label} · ${formatHumanDuration(hoveredDetail.seconds)}${
                      hoveredDetail.topSubject ? ` · ${hoveredDetail.topSubject}` : ''
                    }`
                  : `Peak ${formatHumanDuration(maxBarSeconds)}${
                      range !== '1d' ? ` · Target ${formatHumanDuration(dailyGoalSeconds)}/day` : ''
                    }`}
              </p>
            </div>

            <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
              <span>Low</span>
              <span className="w-2.5 h-2.5 rounded-xs bg-slate-300/60 dark:bg-white/10" aria-hidden="true" />
              <span className="w-2.5 h-2.5 rounded-xs bg-sky-400" aria-hidden="true" />
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-400" aria-hidden="true" />
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-400" aria-hidden="true" />
              <span className="w-2.5 h-2.5 rounded-xs bg-rose-500" aria-hidden="true" />
              <span>Peak</span>
            </div>
          </div>

          <div className="relative pt-3 pb-5">
            {goalLineBottomPct !== null && (
              <div
                aria-hidden="true"
                className="absolute inset-x-0 border-t border-dashed border-slate-400/50 dark:border-white/20 pointer-events-none"
                style={{ bottom: `calc(${goalLineBottomPct}% * 0.78 + 20px)` }}
              />
            )}

            <div
              className="grid gap-1 sm:gap-1.5 items-end h-44 border-b border-slate-200/70 dark:border-white/10"
              style={{
                gridTemplateColumns: `repeat(${heatBars.length}, minmax(0, 1fr))`,
              }}
            >
              {heatBars.map((bar, idx) => {
                const level = getHeatLevel(bar.seconds, range, false);
                const heightPct =
                  bar.seconds <= 0
                    ? 4
                    : Math.max(8, Math.round((bar.seconds / maxBarSeconds) * 100));

                return (
                  <div
                    key={`${bar.label}_${idx}`}
                    className="relative h-full flex flex-col justify-end items-center"
                  >
                    <button
                      type="button"
                      onMouseEnter={() => setHoveredDetail(bar)}
                      onFocus={() => setHoveredDetail(bar)}
                      onClick={() => setHoveredDetail(bar)}
                      aria-label={`${bar.label}: ${formatHumanDuration(bar.seconds)}`}
                      className={`w-full max-w-[30px] rounded-t-sm transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${HEAT_BAR_CLASSES[level]}`}
                      style={{ height: `${heightPct}%` }}
                    />
                    {bar.shortAxis && (
                      <span className="absolute -bottom-5 text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {bar.shortAxis}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Tile B: Subject Mix Donut + Click-to-Filter Bars */}
        <section
          aria-label="Subject mix"
          className="lg:col-span-5 glass-panel rounded-2xl p-5 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
              Subject Share
            </h2>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Click to filter
            </span>
          </div>

          {subjectBreakdown.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-10 text-xs text-slate-500 dark:text-slate-400">
              No subject activity in this timeframe.
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-5 flex-1">
              {/* Donut Ring */}
              <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
                <svg viewBox="0 0 132 132" className="w-full h-full -rotate-90">
                  <circle
                    cx="66"
                    cy="66"
                    r={donutRadius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="14"
                    className="text-slate-200/70 dark:text-white/10"
                  />
                  {donutSegments.map((seg) => {
                    const dimmed =
                      selectedSubjectId !== 'all' && selectedSubjectId !== seg.id;
                    return (
                      <circle
                        key={seg.id}
                        cx="66"
                        cy="66"
                        r={donutRadius}
                        fill="none"
                        stroke={seg.color}
                        strokeWidth="14"
                        strokeDasharray={seg.dashArray}
                        strokeDashoffset={seg.dashOffset}
                        strokeLinecap="butt"
                        onClick={() =>
                          setSelectedSubjectId((prev) => (prev === seg.id ? 'all' : seg.id))
                        }
                        className="cursor-pointer transition-opacity duration-200"
                        style={{ opacity: dimmed ? 0.25 : 1 }}
                      />
                    );
                  })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="font-mono tabular-nums text-sm font-bold text-slate-900 dark:text-white">
                    {formatHumanDuration(totalSeconds)}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {selectedSubjectId === 'all' ? 'Total' : 'Filtered'}
                  </span>
                </div>
              </div>

              {/* Interactive Subject Rows */}
              <div className="w-full flex-1 space-y-2.5 min-w-0">
                {subjectBreakdown.map((item) => {
                  const isSelected = selectedSubjectId === item.id;
                  const dimmed = selectedSubjectId !== 'all' && !isSelected;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        setSelectedSubjectId((prev) => (prev === item.id ? 'all' : item.id))
                      }
                      aria-pressed={isSelected}
                      className={`w-full text-left space-y-1 p-1.5 -mx-1.5 rounded-lg transition-all hover:bg-white/50 dark:hover:bg-white/[0.05] ${
                        dimmed ? 'opacity-45' : 'opacity-100'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium text-slate-800 dark:text-slate-100 truncate">
                          {item.name}
                        </span>
                        <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300 shrink-0">
                          {item.sharePct}% · {formatHumanDuration(item.seconds)}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-200/70 dark:bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.max(4, item.sharePct)}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ROW 3: Secondary Power BI Visual Grid (7 cols Compact Heatmap + 5 cols Top Focus Matrix) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Tile C: Compact Activity Heatmap */}
        <section
          aria-label="Consistency heatmap"
          className="lg:col-span-7 glass-panel rounded-2xl p-5 flex flex-col justify-between"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                {range === '1d'
                  ? '24-Hour Pattern'
                  : range === '1w'
                    ? 'Time-of-Day Pattern'
                    : '30-Day Consistency'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                {hoveredDetail
                  ? `${hoveredDetail.label} · ${formatHumanDuration(hoveredDetail.seconds)}`
                  : 'Hover any tile to inspect duration.'}
              </p>
            </div>

            <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
              <span>0</span>
              {([0, 1, 2, 3, 4] as const).map((lvl) => (
                <span
                  key={lvl}
                  className={`w-3 h-3 rounded-xs ${HEAT_CELL_CLASSES[lvl]}`}
                  aria-hidden="true"
                />
              ))}
              <span>Max</span>
            </div>
          </div>

          {range === '1d' && (
            <div className="grid grid-cols-8 sm:grid-cols-12 gap-1.5">
              {hourlyBuckets.map((b) => {
                const level = getHeatLevel(b.seconds, '1d');
                return (
                  <button
                    key={b.hour}
                    type="button"
                    onMouseEnter={() => setHoveredDetail(b)}
                    onFocus={() => setHoveredDetail(b)}
                    onClick={() => setHoveredDetail(b)}
                    aria-label={`${b.label}: ${formatHumanDuration(b.seconds)}`}
                    className={`h-11 rounded-lg flex flex-col items-center justify-center transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${HEAT_CELL_CLASSES[level]}`}
                  >
                    <span
                      className={`text-[10px] font-mono tabular-nums ${
                        level >= 3 ? 'text-white font-semibold' : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {b.shortAxis}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {range === '1w' && (
            <div className="space-y-1.5">
              <div className="grid grid-cols-[54px_repeat(7,minmax(0,1fr))] gap-1.5 text-center">
                <div />
                {weeklyData.days.map((d) => (
                  <div
                    key={d.dateKey}
                    className="text-[11px] font-medium text-slate-500 dark:text-slate-400"
                  >
                    {d.dayLabel}
                  </div>
                ))}
              </div>
              {weeklyData.blocks.map((block, bIdx) => (
                <div
                  key={block.id}
                  className="grid grid-cols-[54px_repeat(7,minmax(0,1fr))] gap-1.5 items-center"
                >
                  <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {block.label}
                  </span>
                  {weeklyData.days.map((day) => {
                    const cell = day.cells[bIdx];
                    const level = getHeatLevel(cell.seconds, '1w', true);
                    return (
                      <button
                        key={`${day.dateKey}_${block.id}`}
                        type="button"
                        onMouseEnter={() => setHoveredDetail(cell)}
                        onFocus={() => setHoveredDetail(cell)}
                        onClick={() => setHoveredDetail(cell)}
                        aria-label={`${cell.label}: ${formatHumanDuration(cell.seconds)}`}
                        className={`h-8 rounded-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${HEAT_CELL_CLASSES[level]}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {range === '1m' && (
            <div className="space-y-1.5">
              <div className="grid grid-cols-7 gap-1.5 text-center">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((wd, idx) => (
                  <div
                    key={`${wd}_${idx}`}
                    className="text-[11px] font-medium text-slate-500 dark:text-slate-400"
                  >
                    {wd}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {monthlyCalendarCells.map((cell) => {
                  if (cell.isPlaceholder) {
                    return <div key={cell.dateKey} className="h-9" aria-hidden="true" />;
                  }
                  const level = getHeatLevel(cell.seconds, '1m');
                  return (
                    <button
                      key={cell.dateKey}
                      type="button"
                      onMouseEnter={() => setHoveredDetail(cell)}
                      onFocus={() => setHoveredDetail(cell)}
                      onClick={() => setHoveredDetail(cell)}
                      aria-label={`${cell.label}: ${formatHumanDuration(cell.seconds)}`}
                      className={`h-9 rounded-lg flex items-center justify-center text-[11px] font-mono tabular-nums transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                        HEAT_CELL_CLASSES[level]
                      } ${
                        level >= 3
                          ? 'text-white font-semibold'
                          : 'text-slate-700 dark:text-slate-200'
                      } ${
                        cell.isToday
                          ? 'ring-2 ring-[var(--accent)] ring-offset-1 dark:ring-offset-black'
                          : ''
                      }`}
                    >
                      {cell.dayNum}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Tile D: Power BI Focus Matrix (Topics / Tags) */}
        <section
          aria-label="Top focus breakdown"
          className="lg:col-span-5 glass-panel rounded-2xl p-5 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
              Focus Matrix
            </h2>
            <div className="inline-flex items-center p-0.5 glass-subtle rounded-lg">
              <button
                type="button"
                onClick={() => setMatrixTab('topics')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                  matrixTab === 'topics'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Topics
              </button>
              <button
                type="button"
                onClick={() => setMatrixTab('tags')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                  matrixTab === 'tags'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Tags
              </button>
            </div>
          </div>

          {matrixTab === 'topics' ? (
            topicBreakdown.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-8 text-xs text-slate-500 dark:text-slate-400">
                No topic sessions in this view.
              </div>
            ) : (
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200/70 dark:border-white/10 text-slate-500 dark:text-slate-400">
                      <th className="pb-2 font-medium">Topic</th>
                      <th className="pb-2 font-medium text-right">Time</th>
                      <th className="pb-2 font-medium text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/50 dark:divide-white/5">
                    {topicBreakdown.slice(0, 5).map((item) => (
                      <tr key={item.id} className="h-10">
                        <td className="pr-3 max-w-[180px]">
                          <p className="font-medium text-slate-800 dark:text-slate-100 truncate">
                            {item.name}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {item.subjectName}
                          </p>
                        </td>
                        <td className="text-right font-mono tabular-nums text-slate-700 dark:text-slate-200 whitespace-nowrap">
                          {formatHumanDuration(item.seconds)}
                        </td>
                        <td className="pl-3 text-right font-mono tabular-nums font-medium text-[var(--accent)] whitespace-nowrap">
                          {item.sharePct}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : tagBreakdown.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-8 text-xs text-slate-500 dark:text-slate-400">
              Tag sessions on the timer to compare modes here.
            </div>
          ) : (
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200/70 dark:border-white/10 text-slate-500 dark:text-slate-400">
                    <th className="pb-2 font-medium">Session Tag</th>
                    <th className="pb-2 font-medium text-right">Sessions</th>
                    <th className="pb-2 font-medium text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/50 dark:divide-white/5">
                  {tagBreakdown.slice(0, 5).map((item) => (
                    <tr key={item.name} className="h-10">
                      <td className="pr-3 font-medium text-slate-800 dark:text-slate-100 truncate">
                        {item.name}
                      </td>
                      <td className="text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {item.count}
                      </td>
                      <td className="pl-3 text-right font-mono tabular-nums font-medium text-[var(--accent)] whitespace-nowrap">
                        {formatHumanDuration(item.seconds)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
