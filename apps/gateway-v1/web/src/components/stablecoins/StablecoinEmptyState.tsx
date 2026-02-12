import type { ReactElement } from 'react';
import { CircleDollarSign, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StablecoinEmptyStateProps {
  onCreate: () => void;
}

export function StablecoinEmptyState({ onCreate }: StablecoinEmptyStateProps): ReactElement {
  return (
    <div className="px-6 py-14 text-center">
      <div className="w-14 h-14 rounded-2xl bg-lavender/8 flex items-center justify-center mx-auto mb-4">
        <CircleDollarSign className="h-7 w-7 text-lavender" />
      </div>
      <h2 className="text-[15px] font-semibold text-[#2D3436] mb-1.5">No Tokens Yet</h2>
      <p className="text-[13px] text-[#6B6560] max-w-[280px] mx-auto leading-relaxed mb-4">
        Create your first TIP-20 stablecoin or import an existing one to get started.
      </p>
      <Button
        onClick={onCreate}
        variant="outline"
        className="h-9 px-4 rounded-xl text-[13px] font-semibold border-[#EDE9E3]"
      >
        <Plus className="w-3.5 h-3.5 mr-1.5" />
        Create Token
      </Button>
    </div>
  );
}
