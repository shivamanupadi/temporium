import { useState, type ReactElement } from 'react';
import { Users, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useContacts } from '@/hooks/useContacts';
import { cn, isValidAddress } from '@/lib/utils';

interface AddressInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  showValidation?: boolean;
  className?: string;
}

export function AddressInput({
  label,
  value,
  onChange,
  placeholder = '0x...',
  showValidation = true,
  className,
}: AddressInputProps): ReactElement {
  const { contacts } = useContacts();
  const [showContacts, setShowContacts] = useState(false);

  const hasContacts = contacts.length > 0;
  const isInvalid = showValidation && value && !isValidAddress(value);

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </label>
        {hasContacts && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowContacts(!showContacts)}
              className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 font-medium transition-colors"
            >
              <Users className="h-3 w-3" />
              Contacts
              <ChevronDown
                className={cn('h-3 w-3 transition-transform', showContacts && 'rotate-180')}
              />
            </button>
            {showContacts && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowContacts(false)} />
                <div className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-border bg-white z-20 overflow-hidden shadow-lg">
                  <div className="max-h-48 overflow-y-auto">
                    {contacts.map(contact => (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => {
                          onChange(contact.address);
                          setShowContacts(false);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-muted transition-colors"
                      >
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-[11px] font-semibold text-primary">
                            {contact.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[12px] font-medium text-foreground truncate">
                            {contact.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono truncate">
                            {contact.address.slice(0, 10)}...{contact.address.slice(-6)}
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
        onChange={e => onChange(e.target.value)}
        className="h-10 font-mono text-[13px]"
      />
      {isInvalid && <p className="text-[11px] text-destructive mt-1.5">Invalid address</p>}
    </div>
  );
}
