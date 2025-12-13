import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  backTo?: string;
  action?: ReactNode;
}

export function PageHeader({
  title,
  backTo = '/portal/dashboard',
  action,
}: PageHeaderProps): ReactElement {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between mb-3 -mt-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate({ to: backTo })}
          className="p-1.5 -ml-1.5 rounded-md hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <h1 className="text-[15px] font-medium text-foreground">{title}</h1>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
