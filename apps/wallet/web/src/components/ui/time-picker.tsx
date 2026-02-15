import * as React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TimePickerProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

function TimePicker({ date, setDate }: TimePickerProps) {
  const handleTimeChange = (type: 'hour' | 'minute' | 'ampm', value: string) => {
    const newDate = new Date(date ?? new Date());
    if (type === 'hour') {
      newDate.setHours((parseInt(value) % 12) + (newDate.getHours() >= 12 ? 12 : 0));
    } else if (type === 'minute') {
      newDate.setMinutes(parseInt(value));
    } else if (type === 'ampm') {
      const currentHours = newDate.getHours();
      if (value === 'PM' && currentHours < 12) {
        newDate.setHours(currentHours + 12);
      } else if (value === 'AM' && currentHours >= 12) {
        newDate.setHours(currentHours - 12);
      }
    }
    setDate(newDate);
  };

  const isHourSelected = (hour: number) => date != null && date.getHours() % 12 === hour % 12;

  const isMinuteSelected = (minute: number) => date != null && date.getMinutes() === minute;

  const isAmPmSelected = (ampm: 'AM' | 'PM') =>
    date != null &&
    ((ampm === 'AM' && date.getHours() < 12) || (ampm === 'PM' && date.getHours() >= 12));

  return (
    <div className="flex divide-x divide-[#EDE9E3]">
      <Column label="Hr">
        {HOURS.map(hour => (
          <TimeButton
            key={hour}
            selected={isHourSelected(hour)}
            onClick={() => handleTimeChange('hour', hour.toString())}
          >
            {hour}
          </TimeButton>
        ))}
      </Column>
      <Column label="Min">
        {MINUTES.map(minute => (
          <TimeButton
            key={minute}
            selected={isMinuteSelected(minute)}
            onClick={() => handleTimeChange('minute', minute.toString())}
          >
            {minute.toString().padStart(2, '0')}
          </TimeButton>
        ))}
      </Column>
      <Column label=" " scroll={false}>
        {(['AM', 'PM'] as const).map(ampm => (
          <TimeButton
            key={ampm}
            selected={isAmPmSelected(ampm)}
            onClick={() => handleTimeChange('ampm', ampm)}
          >
            {ampm}
          </TimeButton>
        ))}
      </Column>
    </div>
  );
}

function Column({
  label,
  scroll = true,
  children,
}: {
  label: string;
  scroll?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col w-[100px]">
      <p className="text-[10px] font-semibold text-[#9B9590] uppercase tracking-wider text-center px-1 pt-2 pb-1">
        {label}
      </p>
      <div className={cn('px-0.5 pb-1', scroll && 'h-[180px] overflow-y-auto')}>{children}</div>
    </div>
  );
}

function TimeButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      size="icon"
      type="button"
      variant={selected ? 'default' : 'ghost'}
      className={cn(
        'w-full shrink-0 aspect-square',
        selected ? 'bg-lavender hover:bg-lavender/90 text-white' : 'text-[#6B6560]'
      )}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export { TimePicker };
