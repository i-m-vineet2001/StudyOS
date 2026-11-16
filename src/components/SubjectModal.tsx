import React, { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Subject, Topic } from '../types/study';
import { SUBJECT_COLORS } from '../utils/storage';

interface SubjectModalProps {
  isOpen: boolean;
  editingSubject: Subject | null;
  onClose: () => void;
  onSave: (name: string, targetMinutes: number, color: string, topics: Topic[]) => void;
}

const PRESET_MINUTES = [25, 30, 45, 60, 90];

export function SubjectModal({ isOpen, editingSubject, onClose, onSave }: SubjectModalProps) {
  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState(45);
  const [color, setColor] = useState(SUBJECT_COLORS[0].hex);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [newTopicName, setNewTopicName] = useState('');

  useEffect(() => {
    if (editingSubject) {
      setName(editingSubject.name);
      setMinutes(editingSubject.targetMinutes);
      setColor(editingSubject.color);
      setTopics(editingSubject.topics || []);
    } else {
      setName('');
      setMinutes(45);
      setColor(SUBJECT_COLORS[0].hex);
      setTopics([]);
    }
    setNewTopicName('');
  }, [editingSubject, isOpen]);

  if (!isOpen) return null;

  const handleAddTopic = () => {
    const trimmed = newTopicName.trim();
    if (!trimmed) return;
    setTopics((prev) => [
      ...prev,
      { id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, name: trimmed },
    ]);
    setNewTopicName('');
  };

  const handleRemoveTopic = (topicId: string) => {
    setTopics((prev) => prev.filter((t) => t.id !== topicId));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const pendingTopic = newTopicName.trim();
    const finalTopics = pendingTopic
      ? [
          ...topics,
          { id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, name: pendingTopic },
        ]
      : topics;

    onSave(name.trim(), Math.max(1, Math.min(480, Number(minutes) || 25)), color, finalTopics);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="subject-modal-title"
    >
      <div className="w-full max-w-lg glass-panel rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2
            id="subject-modal-title"
            className="font-display text-lg font-semibold text-slate-900 dark:text-white"
          >
            {editingSubject ? 'Edit Subject & Topics' : 'Add Subject & Topics'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="subject-name"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Subject Name
            </label>
            <input
              id="subject-name"
              type="text"
              required
              autoFocus
              maxLength={48}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Quantitative Aptitude"
              className="w-full h-10 px-3 text-sm bg-white/75 dark:bg-slate-950/60 border border-slate-300/80 dark:border-white/15 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0A84FF]"
            />
          </div>

          <div>
            <label
              htmlFor="subject-minutes"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Countdown Block (minutes)
            </label>
            <div className="flex items-center gap-2 mb-2.5">
              {PRESET_MINUTES.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setMinutes(preset)}
                  className={`flex-1 h-9 text-xs font-medium rounded-xl border transition-colors ${
                    minutes === preset
                      ? 'bg-[#0A84FF] border-[#0A84FF] text-white'
                      : 'glass-subtle text-slate-700 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-800/70'
                  }`}
                >
                  {preset}m
                </button>
              ))}
            </div>
            <input
              id="subject-minutes"
              type="number"
              min={1}
              max={480}
              required
              value={minutes}
              onChange={(e) => setMinutes(Math.max(1, Number(e.target.value)))}
              className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white/75 dark:bg-slate-950/60 border border-slate-300/80 dark:border-white/15 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0A84FF]"
            />
          </div>

          <div>
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Topics under this Subject
            </span>
            <div className="flex items-center gap-2 mb-2.5">
              <input
                type="text"
                maxLength={48}
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTopic();
                  }
                }}
                placeholder="Add topic (e.g., Data Interpretation)"
                className="flex-1 h-10 px-3 text-sm bg-white/75 dark:bg-slate-950/60 border border-slate-300/80 dark:border-white/15 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0A84FF]"
              />
              <button
                type="button"
                onClick={handleAddTopic}
                className="inline-flex items-center gap-1 h-10 px-3.5 text-sm font-medium text-white bg-[#0A84FF] hover:bg-[#0071E3] rounded-xl transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            {topics.length > 0 ? (
              <div className="divide-y divide-slate-200/70 dark:divide-white/10 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/50 dark:bg-slate-950/40 max-h-40 overflow-y-auto">
                {topics.map((topic) => (
                  <div
                    key={topic.id}
                    className="flex items-center justify-between px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
                  >
                    <span className="truncate">{topic.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTopic(topic.id)}
                      aria-label={`Remove ${topic.name}`}
                      className="p-1 text-slate-400 hover:text-red-500 rounded"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No topics added yet. Add specific topics to track granular study time.
              </p>
            )}
          </div>

          <div>
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Accent Ring Color
            </span>
            <div className="flex items-center gap-3">
              {SUBJECT_COLORS.map((c) => {
                const selected = color === c.hex;
                return (
                  <button
                    key={c.hex}
                    type="button"
                    aria-label={`Select ${c.name} color`}
                    onClick={() => setColor(c.hex)}
                    className={`w-8 h-8 rounded-full transition-transform ${
                      selected
                        ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-white dark:ring-offset-slate-900 scale-110'
                        : 'hover:scale-105 opacity-85 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/10 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-10 px-5 text-sm font-medium text-white bg-[#0A84FF] hover:bg-[#0071E3] rounded-xl transition-colors shadow-[0_4px_14px_rgba(10,132,255,0.3)]"
            >
              {editingSubject ? 'Save Changes' : 'Create Subject'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
