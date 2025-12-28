import { useState, type ReactElement } from 'react';
import { ShieldCheck, ShieldX, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { usePolicies } from '@/hooks/usePolicies';
import { cn } from '@/lib/utils';

interface PolicyIdInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function PolicyIdInput({
  label,
  value,
  onChange,
  placeholder = 'Enter policy ID (e.g., 2)',
  className,
}: PolicyIdInputProps): ReactElement {
  const { policies } = usePolicies();
  const [showPolicies, setShowPolicies] = useState(false);

  const hasPolicies = policies.length > 0;

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </label>
        {hasPolicies && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowPolicies(!showPolicies)}
              className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 font-medium transition-colors"
            >
              <ShieldCheck className="h-3 w-3" />
              Saved Policies
              <ChevronDown
                className={cn('h-3 w-3 transition-transform', showPolicies && 'rotate-180')}
              />
            </button>
            {showPolicies && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowPolicies(false)} />
                <div className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-border bg-white z-20 overflow-hidden">
                  <div className="max-h-48 overflow-y-auto">
                    {policies.map(policy => (
                      <button
                        key={policy.id}
                        type="button"
                        onClick={() => {
                          onChange(policy.policyId);
                          setShowPolicies(false);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-muted transition-colors"
                      >
                        <div
                          className={cn(
                            'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0',
                            policy.type === 'whitelist' ? 'bg-emerald-100' : 'bg-rose-100'
                          )}
                        >
                          {policy.type === 'whitelist' ? (
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <ShieldX className="h-3.5 w-3.5 text-rose-600" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[12px] font-medium text-foreground">
                            Policy #{policy.policyId}
                          </p>
                          <p
                            className={cn(
                              'text-[10px] font-medium capitalize',
                              policy.type === 'whitelist' ? 'text-emerald-600' : 'text-rose-600'
                            )}
                          >
                            {policy.type}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <Input
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value.replace(/[^0-9]/g, ''))}
        className="h-10 font-mono"
      />
      <p className="text-[11px] text-muted-foreground mt-1">Enter the on-chain policy ID to link</p>
    </div>
  );
}
