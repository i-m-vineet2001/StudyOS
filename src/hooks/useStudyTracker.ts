import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppSettings, PdfDocumentMeta, StudyNote, StudySession, StudyStore, Subject, Topic } from '../types/study';
import {
  clearAllPdfs,
  deletePdfFile,
  getPdfBlob,
  listPdfMetas,
  savePdfFile,
} from '../utils/pdfVault';
import { playCompletionChime } from '../utils/sound';
import {
  createBankingSubjects,
  createInitialStore,
  generateSampleMonthHistory,
  loadStudyStore,
  saveStudyStore,
} from '../utils/storage';
import { getLocalDateKey } from '../utils/time';
import { getColorTheme } from '../utils/themes';

function buildSessionFromTimer(store: StudyStore, now: number): StudySession | null {
  const { timer, subjects } = store;
  if (timer.currentSessionAccumulatedSeconds < 1) return null;

  const subject = timer.activeSubjectId
    ? subjects.find((s) => s.id === timer.activeSubjectId)
    : undefined;
  const topic =
    subject && timer.activeTopicId
      ? subject.topics.find((t) => t.id === timer.activeTopicId)
      : subject && subject.activeTopicId
        ? subject.topics.find((t) => t.id === subject.activeTopicId)
        : undefined;

  const duration = timer.currentSessionAccumulatedSeconds;
  const startedAt = timer.currentSessionStartedAt || now - duration * 1000;

  return {
    id: `sess_${now}_${Math.random().toString(36).slice(2, 7)}`,
    subjectId: subject ? subject.id : 'universal',
    subjectName: subject ? subject.name : 'General Study',
    subjectColor: subject ? subject.color : '#0A84FF',
    topicId: topic ? topic.id : null,
    topicName: topic ? topic.name : null,
    tag: timer.activeTag || null,
    startedAt,
    endedAt: now,
    durationSeconds: duration,
    mode: timer.activeMode,
  };
}

function commitActiveSession(store: StudyStore, now: number, preserveSubMs = false): StudyStore {
  const session = buildSessionFromTimer(store, now);
  const nextSessions = session ? [session, ...store.sessions] : store.sessions;
  const subMs =
    preserveSubMs && store.timer.lastTickAt
      ? Math.max(0, Math.min(999, now - store.timer.lastTickAt))
      : 0;

  return {
    ...store,
    sessions: nextSessions,
    timer: {
      ...store.timer,
      isRunning: false,
      lastTickAt: null,
      pausedSubMs: subMs,
      currentSessionStartedAt: null,
      currentSessionAccumulatedSeconds: 0,
    },
  };
}

export function useStudyTracker() {
  const [store, setStore] = useState<StudyStore>(() => loadStudyStore());
  const [pdfs, setPdfs] = useState<PdfDocumentMeta[]>([]);
  const [completedBanner, setCompletedBanner] = useState<string | null>(null);
  const storeRef = useRef(store);
  storeRef.current = store;

  useEffect(() => {
    listPdfMetas().then(setPdfs);
  }, []);

  useEffect(() => {
    saveStudyStore(store);
  }, [store]);

  useEffect(() => {
    const root = document.documentElement;
    if (store.settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    const themeCfg = getColorTheme(store.settings.colorTheme);
    const glowPct = Math.max(0, Math.min(100, store.settings.glowIntensity ?? 70));
    const glowFactor = glowPct / 100;
    const scaledAlpha = (0.55 * glowFactor).toFixed(2);
    const scaledCanvas1 = (0.24 * glowFactor).toFixed(2);
    const scaledCanvas2 = (0.16 * glowFactor).toFixed(2);

    root.setAttribute('data-color-theme', themeCfg.id);
    root.style.setProperty('--accent', themeCfg.accent);
    root.style.setProperty('--accent-hover', themeCfg.accentHover);
    root.style.setProperty('--accent-fg', themeCfg.accentFg);
    root.style.setProperty('--glow-factor', glowFactor.toFixed(2));
    root.style.setProperty(
      '--accent-glow',
      themeCfg.accentGlow.replace('0.36', scaledAlpha)
    );
    root.style.setProperty(
      '--canvas-glow-1',
      themeCfg.accentGlow.replace('0.36', scaledCanvas1)
    );
    root.style.setProperty(
      '--canvas-glow-2',
      themeCfg.accentGlow.replace('0.36', scaledCanvas2)
    );
  }, [store.settings.theme, store.settings.colorTheme, store.settings.glowIntensity]);

  const processTick = useCallback(() => {
    setStore((prev) => {
      if (!prev.timer.isRunning || !prev.timer.lastTickAt) return prev;

      const now = Date.now();
      const diffMs = now - prev.timer.lastTickAt;
      const elapsedSec = Math.floor(diffMs / 1000);
      if (elapsedSec < 1) return prev;

      const todayKey = getLocalDateKey(now);
      const dayRolledOver = prev.lastActiveDate !== todayKey;

      let nextTodayUniversal = dayRolledOver ? 0 : prev.todayUniversalSeconds;
      const nextSubjects = dayRolledOver
        ? prev.subjects.map((s) => ({ ...s, todaySeconds: 0 }))
        : [...prev.subjects];

      let consumedSec = elapsedSec;
      let finishedSubjectName: string | null = null;

      if (prev.timer.activeSubjectId) {
        const idx = nextSubjects.findIndex((s) => s.id === prev.timer.activeSubjectId);
        if (idx !== -1) {
          const target = nextSubjects[idx];
          if (prev.timer.activeMode === 'countdown') {
            const remainingBefore = target.remainingSeconds;
            consumedSec = Math.min(remainingBefore > 0 ? remainingBefore : elapsedSec, elapsedSec);
            const remainingAfter = Math.max(0, remainingBefore - elapsedSec);

            nextSubjects[idx] = {
              ...target,
              remainingSeconds: remainingAfter,
              todaySeconds: target.todaySeconds + consumedSec,
              totalSeconds: target.totalSeconds + consumedSec,
            };

            if (remainingBefore > 0 && remainingAfter === 0) {
              finishedSubjectName = target.name;
            }
          } else {
            // Subject-specific stopwatch mode
            nextSubjects[idx] = {
              ...target,
              stopwatchSeconds: target.stopwatchSeconds + elapsedSec,
              todaySeconds: target.todaySeconds + elapsedSec,
              totalSeconds: target.totalSeconds + elapsedSec,
            };
          }
        }
      }

      const nextUniversalElapsed = prev.timer.universalElapsedSeconds + consumedSec;
      nextTodayUniversal += consumedSec;
      const nextAccumulated = prev.timer.currentSessionAccumulatedSeconds + consumedSec;

      const updated: StudyStore = {
        ...prev,
        lastActiveDate: todayKey,
        todayUniversalSeconds: nextTodayUniversal,
        subjects: nextSubjects,
        timer: {
          ...prev.timer,
          universalElapsedSeconds: nextUniversalElapsed,
          lastTickAt: prev.timer.lastTickAt + elapsedSec * 1000,
          currentSessionAccumulatedSeconds: nextAccumulated,
        },
      };

      if (finishedSubjectName) {
        if (prev.settings.soundEnabled) {
          playCompletionChime();
        }
        setCompletedBanner(finishedSubjectName);
        return commitActiveSession(updated, now);
      }

      return updated;
    });
  }, []);

  useEffect(() => {
    const interval = window.setInterval(processTick, 250);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        processTick();
      } else {
        saveStudyStore(storeRef.current);
      }
    };
    const onBeforeUnload = () => {
      saveStudyStore(storeRef.current);
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [processTick]);

  const dismissCompletedBanner = useCallback(() => {
    setCompletedBanner(null);
  }, []);

  const togglePlayPause = useCallback(() => {
    setCompletedBanner(null);
    setStore((prev) => {
      const now = Date.now();
      if (prev.timer.isRunning) {
        return commitActiveSession(prev, now, true);
      }

      let nextSubjects = prev.subjects;
      let nextMode = prev.timer.activeMode;
      let nextSubjectId = prev.timer.activeSubjectId;
      let nextTopicId = prev.timer.activeTopicId;

      if (nextSubjectId) {
        const sub = prev.subjects.find((s) => s.id === nextSubjectId);
        if (!sub) {
          nextMode = 'stopwatch';
          nextSubjectId = null;
          nextTopicId = null;
        } else {
          nextTopicId = sub.activeTopicId;
          if (nextMode === 'countdown' && sub.remainingSeconds <= 0) {
            nextSubjects = prev.subjects.map((s) =>
              s.id === sub.id ? { ...s, remainingSeconds: s.targetMinutes * 60 } : s
            );
          }
        }
      }

      const subOffset = prev.timer.pausedSubMs || 0;

      return {
        ...prev,
        subjects: nextSubjects,
        timer: {
          ...prev.timer,
          isRunning: true,
          activeMode: nextMode,
          activeSubjectId: nextSubjectId,
          activeTopicId: nextTopicId,
          lastTickAt: now - subOffset,
          pausedSubMs: 0,
          currentSessionStartedAt: now,
          currentSessionAccumulatedSeconds: 0,
        },
      };
    });
  }, []);

  const startUniversalStopwatch = useCallback(() => {
    setCompletedBanner(null);
    setStore((prev) => {
      const now = Date.now();
      const base = prev.timer.isRunning ? commitActiveSession(prev, now) : prev;
      return {
        ...base,
        timer: {
          ...base.timer,
          isRunning: true,
          activeMode: 'stopwatch',
          activeSubjectId: null,
          activeTopicId: null,
          lastTickAt: now,
          pausedSubMs: 0,
          currentSessionStartedAt: now,
          currentSessionAccumulatedSeconds: 0,
        },
      };
    });
  }, []);

  const setFocusModeType = useCallback(
    (mode: 'stopwatch' | 'countdown', subjectId?: string | null) => {
      setCompletedBanner(null);
      setStore((prev) => {
        const now = Date.now();
        const wasRunning = prev.timer.isRunning;
        const base = wasRunning ? commitActiveSession(prev, now) : prev;

        // subjectId === null explicitly means Universal Stopwatch
        let targetSubjectId: string | null = null;
        if (mode === 'countdown') {
          targetSubjectId =
            subjectId === undefined
              ? base.timer.activeSubjectId || base.subjects[0]?.id || null
              : subjectId || base.subjects[0]?.id || null;
        } else {
          targetSubjectId = subjectId === undefined ? base.timer.activeSubjectId : subjectId;
        }

        const sub = targetSubjectId
          ? base.subjects.find((s) => s.id === targetSubjectId) || null
          : null;

        const nextSubjects =
          sub && mode === 'countdown' && sub.remainingSeconds <= 0
            ? base.subjects.map((s) =>
                s.id === sub.id ? { ...s, remainingSeconds: s.targetMinutes * 60 } : s
              )
            : base.subjects;

        return {
          ...base,
          subjects: nextSubjects,
          timer: {
            ...base.timer,
            isRunning: wasRunning && (mode === 'stopwatch' || sub !== null),
            activeMode: mode === 'countdown' && sub ? 'countdown' : 'stopwatch',
            activeSubjectId: sub ? sub.id : null,
            activeTopicId: sub ? sub.activeTopicId : null,
            lastTickAt: wasRunning ? now : null,
            currentSessionStartedAt: wasRunning ? now : null,
            currentSessionAccumulatedSeconds: 0,
          },
        };
      });
    },
    []
  );

  const setSubjectMode = useCallback(
    (subjectId: string, mode: 'countdown' | 'stopwatch') => {
      setStore((prev) => {
        const now = Date.now();
        const isThisRunning = prev.timer.isRunning && prev.timer.activeSubjectId === subjectId;
        const base = isThisRunning ? commitActiveSession(prev, now) : prev;

        return {
          ...base,
          subjects: base.subjects.map((s) =>
            s.id === subjectId ? { ...s, preferredMode: mode } : s
          ),
          timer:
            base.timer.activeSubjectId === subjectId
              ? {
                  ...base.timer,
                  activeMode: mode,
                  isRunning: false,
                  lastTickAt: null,
                  currentSessionStartedAt: null,
                  currentSessionAccumulatedSeconds: 0,
                }
              : base.timer,
        };
      });
    },
    []
  );

  const setSubjectActiveTopic = useCallback((subjectId: string, topicId: string | null) => {
    setStore((prev) => {
      const now = Date.now();
      const isThisRunning = prev.timer.isRunning && prev.timer.activeSubjectId === subjectId;
      const base = isThisRunning ? commitActiveSession(prev, now) : prev;

      return {
        ...base,
        subjects: base.subjects.map((s) =>
          s.id === subjectId ? { ...s, activeTopicId: topicId } : s
        ),
        timer: isThisRunning
          ? {
              ...base.timer,
              isRunning: true,
              activeTopicId: topicId,
              lastTickAt: now,
              currentSessionStartedAt: now,
              currentSessionAccumulatedSeconds: 0,
            }
          : base.timer.activeSubjectId === subjectId
            ? { ...base.timer, activeTopicId: topicId }
            : base.timer,
      };
    });
  }, []);

  const toggleSubject = useCallback(
    (subjectId: string, forcedMode?: 'countdown' | 'stopwatch') => {
      setCompletedBanner(null);
      setStore((prev) => {
        const now = Date.now();
        const sub = prev.subjects.find((s) => s.id === subjectId);
        if (!sub) return prev;

        const targetMode = forcedMode || sub.preferredMode;
        const isCurrentlyThisSubject =
          prev.timer.isRunning &&
          prev.timer.activeSubjectId === subjectId &&
          prev.timer.activeMode === targetMode;

        if (isCurrentlyThisSubject) {
          return commitActiveSession(prev, now, true);
        }

        const isResumingSameTarget =
          !prev.timer.isRunning &&
          prev.timer.activeSubjectId === subjectId &&
          prev.timer.activeMode === targetMode;
        const subOffset = isResumingSameTarget ? prev.timer.pausedSubMs || 0 : 0;

        const base = prev.timer.isRunning ? commitActiveSession(prev, now) : prev;
        const nextSubjects = base.subjects.map((s) => {
          if (s.id !== subjectId) return s;
          return {
            ...s,
            preferredMode: targetMode,
            remainingSeconds:
              targetMode === 'countdown' && s.remainingSeconds <= 0
                ? s.targetMinutes * 60
                : s.remainingSeconds,
          };
        });

        return {
          ...base,
          subjects: nextSubjects,
          timer: {
            ...base.timer,
            isRunning: true,
            activeMode: targetMode,
            activeSubjectId: subjectId,
            activeTopicId: sub.activeTopicId,
            lastTickAt: now - subOffset,
            pausedSubMs: 0,
            currentSessionStartedAt: now,
            currentSessionAccumulatedSeconds: 0,
          },
        };
      });
    },
    []
  );

  const resetSubject = useCallback(
    (subjectId: string, modeToReset?: 'countdown' | 'stopwatch') => {
      setStore((prev) => {
        const now = Date.now();
        const sub = prev.subjects.find((s) => s.id === subjectId);
        if (!sub) return prev;

        const targetMode = modeToReset || sub.preferredMode;
        const isThisActive =
          prev.timer.isRunning &&
          prev.timer.activeSubjectId === subjectId &&
          prev.timer.activeMode === targetMode;

        const base = isThisActive ? commitActiveSession(prev, now) : prev;
        return {
          ...base,
          subjects: base.subjects.map((s) => {
            if (s.id !== subjectId) return s;
            return targetMode === 'stopwatch'
              ? { ...s, stopwatchSeconds: 0 }
              : { ...s, remainingSeconds: s.targetMinutes * 60 };
          }),
          timer:
            base.timer.activeSubjectId === subjectId && base.timer.activeMode === targetMode
              ? { ...base.timer, pausedSubMs: 0 }
              : base.timer,
        };
      });
    },
    []
  );

  const resetUniversalSet = useCallback(() => {
    setStore((prev) => {
      const now = Date.now();
      const base = prev.timer.isRunning ? commitActiveSession(prev, now) : prev;
      return {
        ...base,
        timer: {
          ...base.timer,
          universalElapsedSeconds: 0,
          pausedSubMs: 0,
        },
      };
    });
  }, []);

  const addSubject = useCallback(
    (name: string, targetMinutes: number, color: string, topics: Topic[]) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const mins = Math.max(1, Math.min(480, Math.round(targetMinutes)));
      const newSubject: Subject = {
        id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: trimmed,
        color,
        preferredMode: 'countdown',
        targetMinutes: mins,
        remainingSeconds: mins * 60,
        stopwatchSeconds: 0,
        todaySeconds: 0,
        totalSeconds: 0,
        topics,
        activeTopicId: topics[0]?.id || null,
        createdAt: Date.now(),
      };
      setStore((prev) => ({
        ...prev,
        subjects: [...prev.subjects, newSubject],
      }));
    },
    []
  );

  const updateSubject = useCallback(
    (
      subjectId: string,
      name: string,
      targetMinutes: number,
      color: string,
      topics: Topic[]
    ) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const mins = Math.max(1, Math.min(480, Math.round(targetMinutes)));
      setStore((prev) => {
        const now = Date.now();
        const isThisActive =
          prev.timer.isRunning && prev.timer.activeSubjectId === subjectId;
        const base = isThisActive ? commitActiveSession(prev, now) : prev;

        return {
          ...base,
          subjects: base.subjects.map((s) => {
            if (s.id !== subjectId) return s;
            const durationChanged = s.targetMinutes !== mins;
            const activeStillExists = topics.some((t) => t.id === s.activeTopicId);
            return {
              ...s,
              name: trimmed,
              color,
              targetMinutes: mins,
              remainingSeconds: durationChanged ? mins * 60 : s.remainingSeconds,
              topics,
              activeTopicId: activeStillExists ? s.activeTopicId : topics[0]?.id || null,
            };
          }),
        };
      });
    },
    []
  );

  const deleteSubject = useCallback((subjectId: string) => {
    setStore((prev) => {
      const now = Date.now();
      const isThisActive = prev.timer.activeSubjectId === subjectId;
      const base =
        isThisActive && prev.timer.isRunning ? commitActiveSession(prev, now) : prev;

      return {
        ...base,
        subjects: base.subjects.filter((s) => s.id !== subjectId),
        timer: isThisActive
          ? {
              ...base.timer,
              activeMode: 'stopwatch',
              activeSubjectId: null,
              activeTopicId: null,
            }
          : base.timer,
      };
    });
  }, []);

  const deleteSession = useCallback((sessionId: string) => {
    setStore((prev) => ({
      ...prev,
      sessions: prev.sessions.filter((s) => s.id !== sessionId),
    }));
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setStore((prev) => {
      const nextColor = patch.colorTheme ?? prev.settings.colorTheme;
      const colorCfg = getColorTheme(nextColor);
      const nextTheme =
        patch.colorTheme && colorCfg.forcesBlackMode ? 'dark' : (patch.theme ?? prev.settings.theme);

      return {
        ...prev,
        settings: {
          ...prev.settings,
          ...patch,
          colorTheme: nextColor,
          theme: nextTheme,
        },
      };
    });
  }, []);

  const loadSampleData = useCallback(() => {
    setStore((prev) => {
      const now = Date.now();
      const base = prev.timer.isRunning ? commitActiveSession(prev, now) : prev;
      const { sessions, todayUniversalSeconds, updatedSubjects } = generateSampleMonthHistory(
        base.subjects
      );
      return {
        ...base,
        subjects: updatedSubjects,
        sessions,
        todayUniversalSeconds: Math.max(base.todayUniversalSeconds, todayUniversalSeconds),
      };
    });
  }, []);

  const resetToBankingPreset = useCallback(() => {
    setStore((prev) => {
      const now = Date.now();
      const base = prev.timer.isRunning ? commitActiveSession(prev, now) : prev;
      return {
        ...base,
        subjects: createBankingSubjects(now),
        timer: {
          ...base.timer,
          isRunning: false,
          activeMode: 'stopwatch',
          activeSubjectId: null,
          activeTopicId: null,
        },
      };
    });
  }, []);

  const addNote = useCallback(
    (payload: {
      subjectId: string;
      topicId: string | null;
      kind: 'note' | 'reminder';
      title: string;
      content: string;
      dueDate?: string | null;
      pinned?: boolean;
    }) => {
      const now = Date.now();
      const newNote: StudyNote = {
        id: `note_${now}_${Math.random().toString(36).slice(2, 6)}`,
        subjectId: payload.subjectId,
        topicId: payload.topicId,
        kind: payload.kind,
        title: payload.title.trim(),
        content: payload.content.trim(),
        dueDate: payload.dueDate || null,
        pinned: Boolean(payload.pinned),
        completed: false,
        createdAt: now,
        updatedAt: now,
      };
      setStore((prev) => ({
        ...prev,
        notes: [newNote, ...(prev.notes || [])],
      }));
    },
    []
  );

  const toggleNotePin = useCallback((noteId: string) => {
    setStore((prev) => ({
      ...prev,
      notes: (prev.notes || []).map((n) =>
        n.id === noteId ? { ...n, pinned: !n.pinned, updatedAt: Date.now() } : n
      ),
    }));
  }, []);

  const toggleNoteComplete = useCallback((noteId: string) => {
    setStore((prev) => ({
      ...prev,
      notes: (prev.notes || []).map((n) =>
        n.id === noteId ? { ...n, completed: !n.completed, updatedAt: Date.now() } : n
      ),
    }));
  }, []);

  const deleteNote = useCallback((noteId: string) => {
    setStore((prev) => ({
      ...prev,
      notes: (prev.notes || []).filter((n) => n.id !== noteId),
    }));
  }, []);

  const uploadPdf = useCallback(
    async (file: File, subjectId: string, topicId: string | null) => {
      const meta = await savePdfFile(file, subjectId, topicId);
      setPdfs((prev) => [meta, ...prev]);
      return meta;
    },
    []
  );

  const removePdf = useCallback(async (pdfId: string) => {
    await deletePdfFile(pdfId);
    setPdfs((prev) => prev.filter((p) => p.id !== pdfId));
  }, []);

  const clearAllData = useCallback(() => {
    const fresh = createInitialStore();
    clearAllPdfs();
    setPdfs([]);
    setStore((prev) => ({
      ...fresh,
      settings: prev.settings,
    }));
  }, []);

  const importStoreData = useCallback((rawJson: string): { ok: boolean; error?: string } => {
    try {
      const parsed = JSON.parse(rawJson) as StudyStore;
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        !Array.isArray(parsed.subjects) ||
        !Array.isArray(parsed.sessions)
      ) {
        return { ok: false, error: 'Invalid Cadence backup format.' };
      }
      const fallback = createInitialStore();
      setStore({
        version: 2,
        lastActiveDate: getLocalDateKey(),
        todayUniversalSeconds: parsed.todayUniversalSeconds || 0,
        subjects: parsed.subjects.map((s) => ({
          ...s,
          preferredMode: s.preferredMode || 'countdown',
          stopwatchSeconds: s.stopwatchSeconds || 0,
          topics: Array.isArray(s.topics) ? s.topics : [],
          activeTopicId: s.activeTopicId ?? null,
        })),
        sessions: parsed.sessions,
        notes: Array.isArray(parsed.notes) ? parsed.notes : [],
        timer: {
          ...fallback.timer,
          ...(parsed.timer || {}),
          isRunning: false,
          lastTickAt: null,
          currentSessionStartedAt: null,
          currentSessionAccumulatedSeconds: 0,
        },
        settings: {
          ...fallback.settings,
          ...(parsed.settings || {}),
        },
      });
      return { ok: true };
    } catch {
      return { ok: false, error: 'Could not parse JSON file.' };
    }
  }, []);

  const effectiveSessions = useMemo(() => {
    const live = buildSessionFromTimer(store, Date.now());
    return live ? [live, ...store.sessions] : store.sessions;
  }, [store]);

  const activeSubject = useMemo(
    () =>
      store.timer.activeSubjectId
        ? store.subjects.find((s) => s.id === store.timer.activeSubjectId) || null
        : null,
    [store.subjects, store.timer.activeSubjectId]
  );

  const setActiveTag = useCallback((tag: string | null) => {
    setStore((prev) => ({
      ...prev,
      timer: {
        ...prev.timer,
        activeTag: tag ? tag.trim() || null : null,
      },
    }));
  }, []);

  return {
    store,
    pdfs,
    effectiveSessions,
    activeSubject,
    completedBanner,
    dismissCompletedBanner,
    togglePlayPause,
    startUniversalStopwatch,
    setFocusModeType,
    setSubjectMode,
    setSubjectActiveTopic,
    setActiveTag,
    toggleSubject,
    resetSubject,
    resetUniversalSet,
    addSubject,
    updateSubject,
    deleteSubject,
    deleteSession,
    addNote,
    toggleNotePin,
    toggleNoteComplete,
    deleteNote,
    uploadPdf,
    removePdf,
    getPdfBlob,
    updateSettings,
    loadSampleData,
    resetToBankingPreset,
    clearAllData,
    importStoreData,
  };
}
