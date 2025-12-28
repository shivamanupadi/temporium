import type { ReactElement, ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  action?: ReactNode;
}

export function PageHeader({ title, action }: PageHeaderProps): ReactElement {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
      <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{title}</h1>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}
