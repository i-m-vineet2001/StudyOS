import { useEffect, useState } from 'react';

/**
 * Returns live 0..999 sub-second milliseconds using requestAnimationFrame
 * only while `isRunning` is true, keeping paused states at zero CPU.
 */
export function useLiveSubMs(
  isRunning: boolean,
  lastTickAt: number | null,
  pausedSubMs = 0
): number {
  const [subMs, setSubMs] = useState<number>(() =>
    isRunning && lastTickAt ? Math.max(0, Math.min(999, Date.now() - lastTickAt)) : pausedSubMs
  );

  useEffect(() => {
    if (!isRunning || !lastTickAt) {
      setSubMs(pausedSubMs);
      return;
    }

    let rafId = 0;
    const update = () => {
      const diff = Date.now() - lastTickAt;
      setSubMs(Math.max(0, Math.min(999, diff % 1000)));
      rafId = window.requestAnimationFrame(update);
    };

    rafId = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(rafId);
  }, [isRunning, lastTickAt, pausedSubMs]);

  return subMs;
}

export function pad3(n: number): string {
  return String(Math.max(0, Math.min(999, Math.floor(n)))).padStart(3, '0');
}
