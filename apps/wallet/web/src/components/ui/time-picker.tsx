import * as React from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AccentColor } from '@/components/ui/calendar';

const accentMap = {
  coral: {
    active: 'bg-coral text-white shadow-sm',
    ring: 'focus:ring-coral/30 focus:border-coral/50',
    chipHover: 'hover:border-coral/40 hover:text-coral',
  },
  lavender: {
    active: 'bg-[#9B72CF] text-white shadow-sm',
    ring: 'focus:ring-[#9B72CF]/30 focus:border-[#9B72CF]/50',
    chipHover: 'hover:border-[#9B72CF]/40 hover:text-[#9B72CF]',
  },
  sage: {
    active: 'bg-sage text-white shadow-sm',
    ring: 'focus:ring-sage/30 focus:border-sage/50',
    chipHover: 'hover:border-sage/40 hover:text-sage',
  },
} as const;

interface TimePickerProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  color?: AccentColor;
}

function TimePicker({ date, setDate, color = 'coral' }: TimePickerProps) {
  const accent = accentMap[color];
  const current = date ?? new Date(new Date().setMinutes(0, 0, 0));
  const hour24 = current.getHours();
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const minute = current.getMinutes();
  const isPM = hour24 >= 12;

  const [hourStr, setHourStr] = React.useState(hour12.toString().padStart(2, '0'));
  const [minuteStr, setMinuteStr] = React.useState(minute.toString().padStart(2, '0'));

  React.useEffect(() => {
    setHourStr(hour12.toString().padStart(2, '0'));
    setMinuteStr(minute.toString().padStart(2, '0'));
  }, [hour12, minute]);

  const commit = (h: number, m: number, pm: boolean) => {
    const next = new Date(date ?? new Date());
    const normalized24 = (h % 12) + (pm ? 12 : 0);
    next.setHours(normalized24, m, 0, 0);
    setDate(next);
  };

  const handleHourBlur = () => {
    let n = parseInt(hourStr, 10);
    if (isNaN(n)) n = 12;
    n = Math.max(1, Math.min(12, n));
    setHourStr(n.toString().padStart(2, '0'));
    commit(n, minute, isPM);
  };

  const handleMinuteBlur = () => {
    let n = parseInt(minuteStr, 10);
    if (isNaN(n)) n = 0;
    n = Math.max(0, Math.min(59, n));
    setMinuteStr(n.toString().padStart(2, '0'));
    commit(hour12, n, isPM);
  };

  const togglePm = (pm: boolean) => commit(hour12, minute, pm);

  const quickPicks: Array<{ label: string; apply: () => void }> = [
    {
      label: 'Now',
      apply: () => {
        const n = new Date();
        const h = n.getHours() % 12 === 0 ? 12 : n.getHours() % 12;
        commit(h, n.getMinutes(), n.getHours() >= 12);
      },
    },
    { label: '9:00 AM', apply: () => commit(9, 0, false) },
    { label: '12:00 PM', apply: () => commit(12, 0, true) },
    { label: '5:00 PM', apply: () => commit(5, 0, true) },
  ];

  return (
    <div className="p-4 space-y-3 min-w-[260px]">
      <div className="flex items-center gap-1.5">
        <Clock className="w-3 h-3 text-[#9B9590]" />
        <span className="text-[10px] uppercase font-semibold text-[#9B9590] tracking-wider">
          Time
        </span>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          maxLength={2}
          value={hourStr}
          onChange={e => setHourStr(e.target.value.replace(/\D/g, ''))}
          onBlur={handleHourBlur}
          onFocus={e => e.target.select()}
          className={cn(
            'w-14 h-11 rounded-xl border border-[#EDE9E3] bg-[#FDFBF8] text-center text-[16px] font-semibold tabular-nums text-[#2D3436] outline-none transition-colors focus:ring-2',
            accent.ring
          )}
        />
        <span className="text-[16px] font-semibold text-[#B5B0AA]">:</span>
        <input
          type="text"
          inputMode="numeric"
          maxLength={2}
          value={minuteStr}
          onChange={e => setMinuteStr(e.target.value.replace(/\D/g, ''))}
          onBlur={handleMinuteBlur}
          onFocus={e => e.target.select()}
          className={cn(
            'w-14 h-11 rounded-xl border border-[#EDE9E3] bg-[#FDFBF8] text-center text-[16px] font-semibold tabular-nums text-[#2D3436] outline-none transition-colors focus:ring-2',
            accent.ring
          )}
        />

        <div className="ml-auto flex items-center rounded-xl border border-[#EDE9E3] bg-[#FDFBF8] p-0.5 h-11">
          <button
            type="button"
            onClick={() => togglePm(false)}
            className={cn(
              'px-3 h-10 rounded-lg text-[12px] font-semibold transition-all',
              !isPM ? accent.active : 'text-[#6B6560] hover:text-[#2D3436]'
            )}
          >
            AM
          </button>
          <button
            type="button"
            onClick={() => togglePm(true)}
            className={cn(
              'px-3 h-10 rounded-lg text-[12px] font-semibold transition-all',
              isPM ? accent.active : 'text-[#6B6560] hover:text-[#2D3436]'
            )}
          >
            PM
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 pt-0.5">
        {quickPicks.map(q => (
          <button
            key={q.label}
            type="button"
            onClick={q.apply}
            className={cn(
              'h-7 px-2.5 rounded-lg border border-[#EDE9E3] bg-white text-[11px] font-medium text-[#6B6560] transition-colors',
              accent.chipHover
            )}
          >
            {q.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export { TimePicker };
