import type { ReactElement } from 'react';
import { Coins, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StablecoinEmptyStateProps {
  onCreate: () => void;
}

export function StablecoinEmptyState({ onCreate }: StablecoinEmptyStateProps): ReactElement {
  return (
    <div className="p-8 text-center">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
        <Coins className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-[14px] font-medium text-foreground mb-1">No stablecoins yet</p>
      <p className="text-[13px] text-muted-foreground mb-4">
        Create your own stablecoin to get started
      </p>
      <Button variant="outline" size="sm" onClick={onCreate}>
        <Plus className="h-4 w-4" />
        Create Stablecoin
      </Button>
    </div>
  );
}
