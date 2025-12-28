import type { ReactElement } from 'react';
import { Key, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AccessKeyEmptyStateProps {
  onCreate: () => void;
}

export function AccessKeyEmptyState({ onCreate }: AccessKeyEmptyStateProps): ReactElement {
  return (
    <div className="p-8 text-center">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
        <Key className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-[14px] font-medium text-foreground mb-1">No access keys yet</p>
      <p className="text-[13px] text-muted-foreground mb-4">
        Create an access key to enable transactions without passkey prompts
      </p>
      <Button variant="outline" size="sm" onClick={onCreate}>
        <Plus className="h-4 w-4" />
        Create Access Key
      </Button>
    </div>
  );
}
