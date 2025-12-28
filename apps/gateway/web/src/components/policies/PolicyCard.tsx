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
  const isWhitelist = policy.type === 'whitelist';

  const handleClick = (): void => {
    navigate({ to: '/portal/tip403-factory/$policyId', params: { policyId: policy.policyId } });
  };

  return (
    <button
      onClick={handleClick}
      className="w-full p-4 text-left hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isWhitelist ? 'bg-emerald-100' : 'bg-rose-100'
            }`}
          >
            {isWhitelist ? (
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            ) : (
              <ShieldX className="h-5 w-5 text-rose-600" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[14px] font-medium text-foreground">Policy #{policy.policyId}</p>
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                  isWhitelist ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'
                }`}
              >
                {isWhitelist ? 'Whitelist' : 'Blacklist'}
              </span>
              {policy.isAdmin && (
                <span className="text-[10px] font-medium text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                  Admin
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Admin: {formatAddress(policy.admin, 6)}
            </p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </button>
  );
}
