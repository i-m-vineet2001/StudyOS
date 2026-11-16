import { pad3, useLiveSubMs } from '../hooks/useLiveSubMs';
import { formatHMS, formatMS } from '../utils/time';

interface PreciseClockProps {
  mode: 'stopwatch' | 'countdown';
  seconds: number;
  isActiveRunning: boolean;
  lastTickAt: number | null;
  pausedSubMs?: number;
  className?: string;
  subClassName?: string;
}

export function PreciseClock({
  mode,
  seconds,
  isActiveRunning,
  lastTickAt,
  pausedSubMs = 0,
  className = '',
  subClassName = 'text-[0.46em] opacity-70 font-medium',
}: PreciseClockProps) {
  const subMs = useLiveSubMs(isActiveRunning, lastTickAt, isActiveRunning ? 0 : pausedSubMs);

  let mainText = '';
  let fracText = '000';

  if (mode === 'stopwatch') {
    mainText = formatHMS(seconds);
    fracText = pad3(isActiveRunning ? subMs : pausedSubMs);
  } else {
    if (isActiveRunning && seconds > 0) {
      const totalMs = Math.max(0, seconds * 1000 - subMs);
      mainText = formatMS(Math.floor(totalMs / 1000));
      fracText = pad3(totalMs % 1000);
    } else if (!isActiveRunning && seconds > 0 && pausedSubMs > 0) {
      const totalMs = Math.max(0, seconds * 1000 - pausedSubMs);
      mainText = formatMS(Math.floor(totalMs / 1000));
      fracText = pad3(totalMs % 1000);
    } else {
      mainText = formatMS(seconds);
      fracText = '000';
    }
  }

  return (
    <span className={`font-mono tabular-nums inline-flex items-baseline ${className}`}>
      <span>{mainText}</span>
      <span className={subClassName}>.{fracText}</span>
    </span>
  );
}
