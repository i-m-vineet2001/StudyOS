import { StudySession, StudyStore, Subject } from '../types/study';
import { addDays, getLocalDateKey, startOfLocalDay } from './time';

export const STORAGE_KEY = 'cadence_study_state_v1';

export const SESSION_TAGS = [
  'Concept',
  'Practice',
  'Mock Test',
  'Revision',
  'PYQs',
  'Vocabulary',
];

export const SUBJECT_COLORS = [
  { name: 'System Blue', hex: '#0A84FF' },
  { name: 'Mint', hex: '#30D158' },
  { name: 'Indigo', hex: '#5E5CE6' },
  { name: 'Amber', hex: '#FF9F0A' },
  { name: 'Cyan', hex: '#32ADE6' },
  { name: 'Rose', hex: '#FF375F' },
];

export function createBankingSubjects(now = Date.now()): Subject[] {
  return [
    {
      id: 'sub_quant',
      name: 'Quantitative Aptitude',
      color: '#0A84FF',
      preferredMode: 'countdown',
      targetMinutes: 45,
      remainingSeconds: 45 * 60,
      stopwatchSeconds: 0,
      todaySeconds: 0,
      totalSeconds: 0,
      topics: [
        { id: 't_q1', name: 'Data Interpretation' },
        { id: 't_q2', name: 'Simplification & Approximation' },
        { id: 't_q3', name: 'Number Series' },
        { id: 't_q4', name: 'Quadratic Equations' },
        { id: 't_q5', name: 'Arithmetic Word Problems' },
      ],
      activeTopicId: 't_q1',
      createdAt: now,
    },
    {
      id: 'sub_reasoning',
      name: 'Reasoning Ability',
      color: '#5E5CE6',
      preferredMode: 'countdown',
      targetMinutes: 45,
      remainingSeconds: 45 * 60,
      stopwatchSeconds: 0,
      todaySeconds: 0,
      totalSeconds: 0,
      topics: [
        { id: 't_r1', name: 'Puzzles & Seating Arrangement' },
        { id: 't_r2', name: 'Syllogism' },
        { id: 't_r3', name: 'Inequalities' },
        { id: 't_r4', name: 'Blood Relations & Direction' },
        { id: 't_r5', name: 'Coding-Decoding' },
      ],
      activeTopicId: 't_r1',
      createdAt: now + 1,
    },
    {
      id: 'sub_english',
      name: 'English Language',
      color: '#30D158',
      preferredMode: 'countdown',
      targetMinutes: 30,
      remainingSeconds: 30 * 60,
      stopwatchSeconds: 0,
      todaySeconds: 0,
      totalSeconds: 0,
      topics: [
        { id: 't_e1', name: 'Reading Comprehension' },
        { id: 't_e2', name: 'Cloze Test' },
        { id: 't_e3', name: 'Error Spotting' },
        { id: 't_e4', name: 'Para Jumbles' },
        { id: 't_e5', name: 'Vocabulary & Fillers' },
      ],
      activeTopicId: 't_e1',
      createdAt: now + 2,
    },
    {
      id: 'sub_ga',
      name: 'General & Banking Awareness',
      color: '#FF9F0A',
      preferredMode: 'stopwatch',
      targetMinutes: 30,
      remainingSeconds: 30 * 60,
      stopwatchSeconds: 0,
      todaySeconds: 0,
      totalSeconds: 0,
      topics: [
        { id: 't_g1', name: 'Current Affairs' },
        { id: 't_g2', name: 'RBI & Banking Policy' },
        { id: 't_g3', name: 'Financial Awareness' },
        { id: 't_g4', name: 'Static GK' },
        { id: 't_g5', name: 'Budget & Economic Survey' },
      ],
      activeTopicId: 't_g1',
      createdAt: now + 3,
    },
  ];
}

export function createInitialStore(): StudyStore {
  const now = Date.now();
  return {
    version: 2,
    lastActiveDate: getLocalDateKey(now),
    todayUniversalSeconds: 0,
    subjects: createBankingSubjects(now),
    sessions: [],
    notes: [],
    timer: {
      universalElapsedSeconds: 0,
      isRunning: false,
      activeMode: 'stopwatch',
      activeSubjectId: null,
      activeTopicId: null,
      activeTag: null,
      lastTickAt: null,
      currentSessionStartedAt: null,
      currentSessionAccumulatedSeconds: 0,
    },
    settings: {
      dailyGoalMinutes: 240,
      soundEnabled: true,
      theme: 'dark',
      colorTheme: 'sapphire',
      glowIntensity: 70,
      userName: '',
    },
  };
}

function migrateSubjects(rawSubjects: unknown): Subject[] {
  if (!Array.isArray(rawSubjects)) return createBankingSubjects();
  // Detect untouched v1 generic defaults and upgrade seamlessly to Banking 4-subject preset
  const oldDefaultIds = new Set(['sub_math', 'sub_physics', 'sub_cs', 'sub_lit']);
  const isUntouchedV1 =
    rawSubjects.length === 4 &&
    rawSubjects.every(
      (s: Partial<Subject>) =>
        s && typeof s.id === 'string' && oldDefaultIds.has(s.id) && (s.totalSeconds || 0) === 0
    );
  if (isUntouchedV1) {
    return createBankingSubjects();
  }

  return rawSubjects.map((s: Partial<Subject>) => {
    const topics = Array.isArray(s.topics) ? s.topics : [];
    return {
      id: s.id || `sub_${Date.now()}`,
      name: s.name || 'Subject',
      color: s.color || '#0A84FF',
      preferredMode: s.preferredMode === 'stopwatch' ? 'stopwatch' : 'countdown',
      targetMinutes: s.targetMinutes || 45,
      remainingSeconds: typeof s.remainingSeconds === 'number' ? s.remainingSeconds : 45 * 60,
      stopwatchSeconds: typeof s.stopwatchSeconds === 'number' ? s.stopwatchSeconds : 0,
      todaySeconds: typeof s.todaySeconds === 'number' ? s.todaySeconds : 0,
      totalSeconds: typeof s.totalSeconds === 'number' ? s.totalSeconds : 0,
      topics,
      activeTopicId: s.activeTopicId ?? (topics[0]?.id || null),
      createdAt: s.createdAt || Date.now(),
    };
  });
}

export function loadStudyStore(): StudyStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createInitialStore();
    }
    const parsed = JSON.parse(raw) as Partial<StudyStore> & { version?: number };
    const fallback = createInitialStore();
    const todayKey = getLocalDateKey();
    const isSameDay = parsed.lastActiveDate === todayKey;

    const migratedSubjects = migrateSubjects(parsed.subjects).map((s) => ({
      ...s,
      todaySeconds: isSameDay ? s.todaySeconds || 0 : 0,
    }));

    const timer = parsed.timer
      ? {
          ...fallback.timer,
          ...parsed.timer,
          activeTopicId: parsed.timer.activeTopicId ?? null,
        }
      : fallback.timer;

    // Catch up elapsed time if the tab was closed while timer was running
    let catchUpSeconds = 0;
    if (timer.isRunning && timer.lastTickAt) {
      const now = Date.now();
      const diff = Math.floor((now - timer.lastTickAt) / 1000);
      if (diff > 0 && diff < 16 * 3600) {
        catchUpSeconds = diff;
      } else if (diff >= 16 * 3600) {
        timer.isRunning = false;
        timer.lastTickAt = null;
      }
    }

    let todayUniversalSeconds = isSameDay ? parsed.todayUniversalSeconds || 0 : 0;
    const sessions: StudySession[] = Array.isArray(parsed.sessions) ? parsed.sessions : [];

    if (catchUpSeconds > 0 && timer.isRunning) {
      timer.universalElapsedSeconds += catchUpSeconds;
      todayUniversalSeconds += catchUpSeconds;
      timer.currentSessionAccumulatedSeconds += catchUpSeconds;
      timer.lastTickAt = Date.now();

      if (timer.activeSubjectId) {
        const subIdx = migratedSubjects.findIndex((s) => s.id === timer.activeSubjectId);
        if (subIdx !== -1) {
          const sub = migratedSubjects[subIdx];
          if (timer.activeMode === 'countdown') {
            const consumed = Math.min(sub.remainingSeconds, catchUpSeconds);
            migratedSubjects[subIdx] = {
              ...sub,
              remainingSeconds: Math.max(0, sub.remainingSeconds - catchUpSeconds),
              todaySeconds: sub.todaySeconds + consumed,
              totalSeconds: sub.totalSeconds + consumed,
            };
            if (migratedSubjects[subIdx].remainingSeconds === 0) {
              timer.isRunning = false;
              timer.lastTickAt = null;
              if (timer.currentSessionAccumulatedSeconds > 0) {
                const topic = sub.topics.find((t) => t.id === timer.activeTopicId);
                sessions.unshift({
                  id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                  subjectId: sub.id,
                  subjectName: sub.name,
                  subjectColor: sub.color,
                  topicId: topic?.id || null,
                  topicName: topic?.name || null,
                  startedAt:
                    timer.currentSessionStartedAt ||
                    Date.now() - timer.currentSessionAccumulatedSeconds * 1000,
                  endedAt: Date.now(),
                  durationSeconds: timer.currentSessionAccumulatedSeconds,
                  mode: 'countdown',
                });
                timer.currentSessionAccumulatedSeconds = 0;
                timer.currentSessionStartedAt = null;
              }
            }
          } else {
            // Subject stopwatch catch-up
            migratedSubjects[subIdx] = {
              ...sub,
              stopwatchSeconds: sub.stopwatchSeconds + catchUpSeconds,
              todaySeconds: sub.todaySeconds + catchUpSeconds,
              totalSeconds: sub.totalSeconds + catchUpSeconds,
            };
          }
        }
      }
    }

    const notes = Array.isArray(parsed.notes) ? parsed.notes : [];

    return {
      version: 2,
      lastActiveDate: todayKey,
      todayUniversalSeconds,
      subjects: migratedSubjects,
      sessions,
      notes,
      timer,
      settings: {
        ...fallback.settings,
        ...(parsed.settings || {}),
      },
    };
  } catch {
    return createInitialStore();
  }
}

export function saveStudyStore(store: StudyStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Handle quota exceeded gracefully
  }
}

export function generateSampleMonthHistory(subjects: Subject[]): {
  sessions: StudySession[];
  todayUniversalSeconds: number;
  updatedSubjects: Subject[];
} {
  const activeSubjects = subjects.length > 0 ? subjects : createBankingSubjects();
  const sessions: StudySession[] = [];
  const todayStart = startOfLocalDay(new Date());
  const todayKey = getLocalDateKey(todayStart);

  const dailyPatterns = [
    2, 1, 3, 0, 2, 4, 2,
    1, 3, 2, 2, 0, 3, 4,
    2, 2, 1, 3, 2, 1, 0,
    3, 2, 4, 2, 1, 3, 2,
    3, 2,
  ];

  const subjectTotals: Record<string, number> = {};
  const subjectToday: Record<string, number> = {};
  let todayUniversalSeconds = 0;

  for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
    const dayDate = addDays(todayStart, -dayOffset);
    const patternCount = dailyPatterns[29 - dayOffset] ?? 2;
    const isToday = getLocalDateKey(dayDate) === todayKey;

    const hourSlots = isToday ? [8, 13] : [7, 11, 15, 20];
    for (let i = 0; i < Math.min(patternCount, hourSlots.length); i++) {
      const sub = activeSubjects[(dayOffset + i) % activeSubjects.length];
      const topic =
        sub.topics.length > 0 ? sub.topics[(dayOffset + i) % sub.topics.length] : null;
      const durationMinutes = isToday
        ? i === 0
          ? 45
          : 40
        : [30, 45, 60, 50][(dayOffset + i) % 4];
      const durationSeconds = durationMinutes * 60;

      const start = new Date(dayDate);
      start.setHours(hourSlots[i], (i * 15) % 60, 0, 0);
      if (start.getTime() > Date.now() - durationSeconds * 1000) {
        continue;
      }
      const startedAt = start.getTime();
      const endedAt = startedAt + durationSeconds * 1000;

      sessions.push({
        id: `sample_${dayOffset}_${i}_${Math.random().toString(36).slice(2, 6)}`,
        subjectId: sub.id,
        subjectName: sub.name,
        subjectColor: sub.color,
        topicId: topic?.id || null,
        topicName: topic?.name || null,
        startedAt,
        endedAt,
        durationSeconds,
        mode: i % 2 === 0 ? 'countdown' : 'stopwatch',
      });

      subjectTotals[sub.id] = (subjectTotals[sub.id] || 0) + durationSeconds;
      if (isToday) {
        subjectToday[sub.id] = (subjectToday[sub.id] || 0) + durationSeconds;
        todayUniversalSeconds += durationSeconds;
      }
    }
  }

  sessions.sort((a, b) => b.startedAt - a.startedAt);

  const updatedSubjects = activeSubjects.map((s) => ({
    ...s,
    todaySeconds: subjectToday[s.id] || 0,
    totalSeconds: (s.totalSeconds || 0) + (subjectTotals[s.id] || 0),
  }));

  return { sessions, todayUniversalSeconds, updatedSubjects };
}
