import * as React from 'react';
import { CalendarIcon, Clock } from 'lucide-react';
import { format } from 'date-fns';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar, type AccentColor } from '@/components/ui/calendar';
import { TimePicker } from '@/components/ui/time-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const colorMap = {
  coral: {
    ring: 'focus:ring-coral/30 focus:border-coral',
    activeBorder: 'border-coral/40 bg-coral/[0.03]',
  },
  lavender: {
    ring: 'focus:ring-lavender/30 focus:border-lavender',
    activeBorder: 'border-lavender/40 bg-lavender/[0.03]',
  },
  sage: {
    ring: 'focus:ring-sage/30 focus:border-sage',
    activeBorder: 'border-sage/40 bg-sage/[0.03]',
  },
} as const;

interface DateTimePickerProps {
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  color?: AccentColor;
  placeholder?: string;
  disabled?: (date: Date) => boolean;
  className?: string;
}

function DateTimePicker({
  date,
  onDateChange,
  color = 'lavender',
  placeholder = 'Pick date & time',
  disabled,
  className,
}: DateTimePickerProps) {
  const colors = colorMap[color];

  const handleDaySelect = (day: Date | undefined) => {
    if (!day) {
      onDateChange(undefined);
      return;
    }
    const next = new Date(day);
    if (date) {
      next.setHours(date.getHours(), date.getMinutes(), 0, 0);
    } else {
      // Default to next hour
      const now = new Date();
      next.setHours(now.getHours() + 1, 0, 0, 0);
    }
    onDateChange(next);
  };

  const handleTimeChange = (timeDate: Date | undefined) => {
    if (!timeDate) return;
    const next = new Date(date ?? new Date());
    next.setHours(timeDate.getHours(), timeDate.getMinutes(), 0, 0);
    onDateChange(next);
  };

  const hasValue = date != null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'w-full h-10 justify-start text-left font-normal rounded-xl border-[#EDE9E3] focus:ring-1 transition-all',
            hasValue && colors.activeBorder,
            !hasValue && 'text-[#B5B0AA]',
            colors.ring,
            className
          )}
        >
          <CalendarIcon className="w-3.5 h-3.5 mr-2 shrink-0" />
          <span className="text-[13px] truncate">
            {hasValue ? format(date, 'MMM d, yyyy') : placeholder}
          </span>
          {hasValue && (
            <>
              <span className="mx-1.5 text-[#D5D0CA]">|</span>
              <Clock className="w-3.5 h-3.5 mr-1.5 shrink-0" />
              <span className="text-[13px]">{format(date, 'hh:mm aa')}</span>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col sm:flex-row">
          <Calendar
            mode="single"
            captionLayout="dropdown"
            selected={date}
            onSelect={handleDaySelect}
            disabled={disabled}
            accentColor={color}
          />
          <div className="border-t sm:border-t-0 sm:border-l border-[#EDE9E3]">
            <TimePicker date={date} setDate={handleTimeChange} color={color} />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { DateTimePicker };
export type { DateTimePickerProps, AccentColor };
