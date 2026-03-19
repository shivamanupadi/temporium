import type { ReactElement } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ShieldCheck, ShieldX, ChevronRight } from 'lucide-react';
import { formatAddress } from '@/lib/utils';
import type { PolicyWithMetadata } from '@/hooks/usePolicies';

interface PolicyCardProps {
  policy: PolicyWithMetadata;
}

export function PolicyCard({ policy }: PolicyCardProps): ReactElement {
  const navigate = useNavigate();

  const handleClick = (): void => {
    navigate({ to: '/portal/tip403-factory/$policyId', params: { policyId: policy.policyId } });
  };

  const isWhitelist = policy.type === 'whitelist';

  return (
    <button
      onClick={handleClick}
      className="w-full px-6 py-4 text-left hover:bg-[#FDFBF8] transition-colors cursor-pointer"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isWhitelist ? 'bg-[#6B8F71]/8' : 'bg-coral/8'}`}
          >
            {isWhitelist ? (
              <ShieldCheck className="h-5 w-5 text-[#6B8F71]" />
            ) : (
              <ShieldX className="h-5 w-5 text-coral" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[14px] font-semibold text-[#2D3436]">Policy #{policy.policyId}</p>
              <span className="text-[11px] font-medium text-[#6B6560] bg-[#F5F2ED] px-1.5 py-0.5 rounded">
                {isWhitelist ? 'Whitelist' : 'Blacklist'}
              </span>
              {policy.isAdmin && (
                <span className="text-[11px] font-medium text-[#6B6560] bg-[#F5F2ED] px-1.5 py-0.5 rounded">
                  Admin
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#9B9590] font-mono mt-0.5">
              {formatAddress(policy.admin, 6)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ChevronRight className="h-4 w-4 text-[#B5B0AA]" />
        </div>
      </div>
    </button>
  );
}
