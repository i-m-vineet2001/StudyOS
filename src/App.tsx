import { useState } from 'react';
import { AiAssistantModal } from './components/AiAssistantModal';
import { DashboardView } from './components/DashboardView';
import { FocusMode } from './components/FocusMode';
import { Header } from './components/Header';
import { HistoryBackupView } from './components/HistoryBackupView';
import { LibraryView } from './components/LibraryView';
import { SettingsModal } from './components/SettingsModal';
import { TimerWorkspace } from './components/TimerWorkspace';
import { useStudyTracker } from './hooks/useStudyTracker';
import { AppView } from './types/study';

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('timer');
  const [focusOpen, setFocusOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aiModal, setAiModal] = useState<{
    open: boolean;
    subjectId?: string | null;
    topicId?: string | null;
  }>({ open: false });
  const [libraryFilter, setLibraryFilter] = useState<{
    subjectId?: string;
    topicId?: string | null;
  }>({});

  const {
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
  } = useStudyTracker();

  const handleOpenFocusMode = (mode?: 'stopwatch' | 'countdown', subjectId?: string | null) => {
    if (mode !== undefined) {
      if (
        !store.timer.isRunning ||
        store.timer.activeMode !== mode ||
        store.timer.activeSubjectId !== (subjectId ?? null)
      ) {
        setFocusModeType(mode, subjectId ?? null);
      }
    }
    setFocusOpen(true);
  };

  const handleOpenLibrary = (subjectId: string, topicId?: string | null) => {
    setLibraryFilter({ subjectId, topicId });
    setActiveView('library');
  };

  const handleOpenAiAssistant = (subjectId?: string | null, topicId?: string | null) => {
    setAiModal({ open: true, subjectId, topicId });
  };

  const handleResetCurrentFocus = () => {
    if (store.timer.activeSubjectId) {
      resetSubject(store.timer.activeSubjectId, store.timer.activeMode);
    } else {
      resetUniversalSet();
    }
  };

  return (
    <div className="min-h-screen flex flex-col apple-canvas text-slate-900 dark:text-slate-100">
      <Header
        activeView={activeView}
        onNavigate={(view) => {
          if (view === 'library') {
            setLibraryFilter({});
          }
          setActiveView(view);
        }}
        onOpenFocusMode={() => handleOpenFocusMode()}
      />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeView === 'timer' && (
          <TimerWorkspace
            timer={store.timer}
            todayUniversalSeconds={store.todayUniversalSeconds}
            subjects={store.subjects}
            notes={store.notes}
            pdfs={pdfs}
            activeSubject={activeSubject}
            settings={store.settings}
            completedBanner={completedBanner}
            onDismissBanner={dismissCompletedBanner}
            onTogglePlayPause={togglePlayPause}
            onStartUniversalStopwatch={startUniversalStopwatch}
            onResetUniversalSet={resetUniversalSet}
            onSetSubjectMode={setSubjectMode}
            onSetSubjectTopic={setSubjectActiveTopic}
            onSetActiveTag={setActiveTag}
            onToggleSubject={toggleSubject}
            onResetSubject={resetSubject}
            onAddSubject={addSubject}
            onUpdateSubject={updateSubject}
            onDeleteSubject={deleteSubject}
            onOpenFocusMode={handleOpenFocusMode}
            onOpenLibrary={handleOpenLibrary}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenAiAssistant={handleOpenAiAssistant}
            onUpdateSettings={updateSettings}
          />
        )}

        {activeView === 'dashboard' && (
          <DashboardView
            sessions={effectiveSessions}
            settings={store.settings}
            onGoToTimer={() => setActiveView('timer')}
            onLoadSampleData={loadSampleData}
          />
        )}

        {activeView === 'library' && (
          <LibraryView
            subjects={store.subjects}
            notes={store.notes}
            pdfs={pdfs}
            initialSubjectId={libraryFilter.subjectId}
            initialTopicId={libraryFilter.topicId}
            onAddNote={addNote}
            onToggleNotePin={toggleNotePin}
            onToggleNoteComplete={toggleNoteComplete}
            onDeleteNote={deleteNote}
            onUploadPdf={uploadPdf}
            onRemovePdf={removePdf}
            onGetPdfBlob={getPdfBlob}
            onOpenAiAssistant={handleOpenAiAssistant}
          />
        )}

        {activeView === 'history' && (
          <HistoryBackupView
            store={store}
            sessions={store.sessions}
            subjects={store.subjects}
            settings={store.settings}
            onDeleteSession={deleteSession}
            onUpdateSettings={updateSettings}
            onLoadSampleData={loadSampleData}
            onResetBankingPreset={resetToBankingPreset}
            onClearAllData={clearAllData}
            onImportData={importStoreData}
          />
        )}
      </main>

      {focusOpen && (
        <FocusMode
          timer={store.timer}
          subjects={store.subjects}
          activeSubject={activeSubject}
          glowIntensity={store.settings.glowIntensity ?? 70}
          onTogglePlayPause={togglePlayPause}
          onSelectMode={setFocusModeType}
          onSelectTopic={setSubjectActiveTopic}
          onResetCurrent={handleResetCurrentFocus}
          onExit={() => setFocusOpen(false)}
        />
      )}

      <SettingsModal
        isOpen={settingsOpen}
        settings={store.settings}
        onUpdateSettings={updateSettings}
        onClose={() => setSettingsOpen(false)}
      />

      <AiAssistantModal
        isOpen={aiModal.open}
        subjects={store.subjects}
        defaultSubjectId={aiModal.subjectId}
        defaultTopicId={aiModal.topicId}
        onSaveAsNote={addNote}
        onClose={() => setAiModal({ open: false })}
      />
    </div>
  );
}
