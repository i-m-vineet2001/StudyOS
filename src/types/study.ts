export interface Topic {
  id: string;
  name: string;
}

export interface Subject {
  id: string;
  name: string;
  color: string;
  preferredMode: 'countdown' | 'stopwatch';
  targetMinutes: number;
  remainingSeconds: number;
  stopwatchSeconds: number;
  todaySeconds: number;
  totalSeconds: number;
  topics: Topic[];
  activeTopicId: string | null;
  createdAt: number;
}

export interface StudySession {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  topicId?: string | null;
  topicName?: string | null;
  tag?: string | null;
  startedAt: number;
  endedAt: number;
  durationSeconds: number;
  mode: 'countdown' | 'stopwatch';
}

export interface TimerState {
  universalElapsedSeconds: number;
  isRunning: boolean;
  activeMode: 'stopwatch' | 'countdown';
  activeSubjectId: string | null;
  activeTopicId: string | null;
  activeTag?: string | null;
  lastTickAt: number | null;
  pausedSubMs?: number;
  currentSessionStartedAt: number | null;
  currentSessionAccumulatedSeconds: number;
}

import { ColorThemeId } from '../utils/themes';

export interface AppSettings {
  dailyGoalMinutes: number;
  soundEnabled: boolean;
  theme: 'light' | 'dark';
  colorTheme: ColorThemeId;
  glowIntensity: number;
  userName: string;
}

export interface StudyNote {
  id: string;
  subjectId: string;
  topicId: string | null;
  kind: 'note' | 'reminder';
  title: string;
  content: string;
  dueDate?: string | null;
  pinned: boolean;
  completed: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface PdfDocumentMeta {
  id: string;
  name: string;
  sizeBytes: number;
  subjectId: string;
  topicId: string | null;
  addedAt: number;
}

export interface StudyStore {
  version: 2;
  lastActiveDate: string;
  todayUniversalSeconds: number;
  subjects: Subject[];
  sessions: StudySession[];
  notes: StudyNote[];
  timer: TimerState;
  settings: AppSettings;
}

export type AppView = 'timer' | 'dashboard' | 'library' | 'history';
export type DashboardRange = '1d' | '1w' | '1m';
