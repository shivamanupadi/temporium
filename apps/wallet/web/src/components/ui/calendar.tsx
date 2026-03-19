import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

type AccentColor = 'coral' | 'lavender' | 'sage';

const accentColorMap = {
  coral: {
    selected: 'bg-coral text-white hover:bg-coral hover:text-white focus:bg-coral focus:text-white',
    dayButton:
      'aria-selected:bg-coral aria-selected:text-white aria-selected:hover:bg-coral aria-selected:hover:text-white',
  },
  lavender: {
    selected: 'bg-coral text-white hover:bg-coral hover:text-white focus:bg-coral focus:text-white',
    dayButton:
      'aria-selected:bg-coral aria-selected:text-white aria-selected:hover:bg-coral aria-selected:hover:text-white',
  },
  sage: {
    selected: 'bg-sage text-white hover:bg-sage hover:text-white focus:bg-sage focus:text-white',
    dayButton:
      'aria-selected:bg-sage aria-selected:text-white aria-selected:hover:bg-sage aria-selected:hover:text-white',
  },
} as const;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  accentColor = 'coral',
  ...props
}: React.ComponentProps<typeof DayPicker> & { accentColor?: AccentColor }) {
  const colors = accentColorMap[accentColor];

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row gap-2',
        month: 'flex flex-col gap-4',
        month_caption: 'flex justify-center pt-1 relative items-center w-full',
        caption_label: 'text-sm font-medium hidden',
        dropdowns: 'flex items-center gap-2',
        dropdown:
          'appearance-none bg-transparent text-sm font-medium cursor-pointer border border-border rounded-md px-2 py-1 outline-none',
        nav: 'flex items-center gap-1',
        button_previous: cn(
          buttonVariants({ variant: 'outline' }),
          'absolute left-1 top-0 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100'
        ),
        button_next: cn(
          buttonVariants({ variant: 'outline' }),
          'absolute right-1 top-0 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100'
        ),
        month_grid: 'w-full border-collapse space-x-1',
        weekdays: 'flex',
        weekday: 'text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]',
        week: 'flex w-full mt-2',
        day: cn(
          'relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50',
          props.mode === 'range'
            ? '[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md'
            : '[&:has([aria-selected])]:rounded-md'
        ),
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-8 w-8 p-0 font-normal aria-selected:opacity-100',
          colors.dayButton
        ),
        range_end: 'day-range-end',
        range_start: 'day-range-start',
        selected: colors.selected,
        today: 'bg-accent text-accent-foreground',
        outside:
          'day-outside text-muted-foreground aria-selected:text-muted-foreground opacity-50 aria-selected:opacity-30',
        disabled: 'text-muted-foreground opacity-50',
        range_middle: 'aria-selected:bg-accent aria-selected:text-accent-foreground',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          const Icon = orientation === 'left' ? ChevronLeft : ChevronRight;
          return <Icon className="h-4 w-4" />;
        },
      }}
      {...props}
    />
  );
}

export { Calendar };
export type { AccentColor };
