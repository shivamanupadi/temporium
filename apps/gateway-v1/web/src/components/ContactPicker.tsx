import { type ReactElement, useState, useEffect, useRef, useCallback } from 'react';
import { Users, ChevronDown, AlertTriangle } from 'lucide-react';
import { apiGet } from '@/lib/api-client';
import { formatAddress, isValidAddress, cn } from '@/lib/utils';
import type { Contact } from '@/types';

export interface ContactPickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  showValidation?: boolean;
}

export function ContactPicker({
  value,
  onChange,
  label = 'Recipient Address',
  placeholder = '0x...',
  showValidation = true,
}: ContactPickerProps): ReactElement {
  const [showContacts, setShowContacts] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isInvalid = showValidation && value && !isValidAddress(value);

  // Load contacts on first open
  const loadContacts = useCallback(async () => {
    if (contactsLoaded) return;
    try {
      const data = await apiGet<Contact[]>('/v1/contacts');
      setContacts(data);
    } catch {
      // silently fail — contacts are optional
    } finally {
      setContactsLoaded(true);
    }
  }, [contactsLoaded]);

  const toggleDropdown = useCallback(() => {
    const next = !showContacts;
    setShowContacts(next);
    if (next) loadContacts();
  }, [showContacts, loadContacts]);

  // Close on outside click
  useEffect(() => {
    if (!showContacts) return;
    const handler = (e: MouseEvent): void => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowContacts(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showContacts]);

  const selectContact = useCallback(
    (contact: Contact) => {
      onChange(contact.address);
      setShowContacts(false);
    },
    [onChange],
  );

  // Find matching contact for current value
  const matchedContact = contacts.find(
    (c) => c.address.toLowerCase() === value.toLowerCase(),
  );

  return (
    <div>
      {/* Label row with Contacts toggle */}
      <div className="flex items-center justify-between mb-2">
        <label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
          {label}
        </label>
        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            onClick={toggleDropdown}
            className={cn(
              'flex items-center gap-1 text-[11px] font-medium transition-colors cursor-pointer',
              showContacts
                ? 'text-coral'
                : 'text-[#9B9590] hover:text-[#6B6560]',
            )}
          >
            <Users className="h-3 w-3" />
            Contacts
            <ChevronDown
              className={cn('h-3 w-3 transition-transform', showContacts && 'rotate-180')}
            />
          </button>

          {/* Contacts dropdown */}
          {showContacts && (
            <div className="absolute right-0 top-full mt-1.5 w-60 rounded-xl border border-[#EDE9E3] bg-white z-50 overflow-hidden shadow-lg shadow-black/[0.06]">
              <div className="max-h-[200px] overflow-y-auto">
                {!contactsLoaded ? (
                  <div className="px-4 py-3 text-[12px] text-[#9B9590]">
                    Loading contacts...
                  </div>
                ) : contacts.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <div className="w-9 h-9 rounded-full bg-[#F5F2ED] flex items-center justify-center mx-auto mb-2">
                      <Users className="w-4 h-4 text-[#B5B0AA]" />
                    </div>
                    <p className="text-[12px] text-[#9B9590]">No contacts yet</p>
                  </div>
                ) : (
                  contacts.map((contact, index) => {
                    const isSelected = contact.address.toLowerCase() === value.toLowerCase();
                    const isLast = index === contacts.length - 1;
                    return (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => selectContact(contact)}
                        className={cn(
                          'flex items-center gap-2.5 w-full px-3 py-2.5 text-left transition-colors cursor-pointer',
                          isSelected ? 'bg-coral/5' : 'hover:bg-[#F5F2ED]',
                          !isLast && 'border-b border-[#EDE9E3]/40',
                        )}
                      >
                        <div className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                          isSelected ? 'bg-coral/10' : 'bg-lavender/10',
                        )}>
                          <span className={cn(
                            'text-[11px] font-bold',
                            isSelected ? 'text-coral' : 'text-lavender',
                          )}>
                            {contact.name
                              .split(' ')
                              .map((w) => w[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-[#2D3436] truncate">
                            {contact.name}
                          </p>
                          <p className="text-[11px] text-[#9B9590] font-mono truncate">
                            {formatAddress(contact.address, 6)}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Address input */}
      <div className="relative">
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          className={cn(
            'w-full px-4 py-3 rounded-xl border border-[#EDE9E3] bg-[#FDFBF8] text-[14px] text-[#2D3436] font-mono placeholder:text-[#B5B0AA] focus:border-coral/40 focus:outline-none transition-colors',
            isInvalid && 'border-coral/50 bg-coral/[0.03]',
          )}
        />
        {matchedContact && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-coral bg-coral/8 px-2 py-0.5 rounded-full">
            {matchedContact.name}
          </span>
        )}
      </div>

      {/* Validation error */}
      {isInvalid && (
        <p className="text-[11px] text-coral mt-1.5 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Invalid address format
        </p>
      )}
    </div>
  );
}
