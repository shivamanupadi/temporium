import type { ReactElement } from 'react';
import { Shield, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PolicyEmptyStateProps {
  onCreate: () => void;
}

export function PolicyEmptyState({ onCreate }: PolicyEmptyStateProps): ReactElement {
  return (
    <>
      <div className="w-14 h-14 rounded-2xl bg-[#F5F2ED] flex items-center justify-center mx-auto mb-4">
        <Shield className="w-7 h-7 text-[#B5B0AA]" />
      </div>
      <h3 className="text-[16px] font-semibold text-[#2D3436]">No Policies Yet</h3>
      <p className="text-[13px] text-[#9B9590] mt-1.5 max-w-sm mx-auto leading-relaxed">
        TIP-403 policies control which addresses can transfer tokens. Create or import a policy to
        get started.
      </p>
      <Button
        onClick={onCreate}
        variant="outline"
        className="mt-5 h-10 px-6 rounded-xl text-[13px] font-semibold border-[#EDE9E3] gap-2"
      >
        <Plus className="w-4 h-4" />
        Create Policy
      </Button>
    </>
  );
}
