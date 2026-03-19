import { type ReactElement, useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Users, ChevronDown, AlertTriangle } from 'lucide-react';
import { apiGet } from '@/lib/api-client';
import { Input } from '@/components/ui/input';
import { formatAddress, isValidAddress, cn } from '@/lib/utils';
import type { Contact } from '@/types';

export interface ContactPickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  showValidation?: boolean;
  compact?: boolean;
  selfAddress?: string;
  matchLabel?: string;
}

export function ContactPicker({
  value,
  onChange,
  label = 'Recipient Address',
  placeholder = '0x...',
  showValidation = true,
  compact = false,
  selfAddress,
  matchLabel = 'Sending to',
}: ContactPickerProps): ReactElement {
  const [showContacts, setShowContacts] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const [portalPos, setPortalPos] = useState<{ top: number; left: number } | null>(null);

  const isInvalid = showValidation && value && !isValidAddress(value);

  const loadContacts = useCallback(async () => {
    if (contactsLoaded) return;
    try {
      const data = await apiGet<Contact[]>('/v1/contacts');
      setContacts(data);
    } catch {
      // silently fail
    } finally {
      setContactsLoaded(true);
    }
  }, [contactsLoaded]);

  const toggleDropdown = useCallback(() => {
    const next = !showContacts;
    setShowContacts(next);
    if (next) loadContacts();
  }, [showContacts, loadContacts]);

  // Position portal dropdown in compact mode
  useEffect(() => {
    if (!compact || !showContacts || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPortalPos({
      top: rect.top + window.scrollY,
      left: rect.right - 260,
    });
  }, [compact, showContacts]);

  // Close on outside click
  useEffect(() => {
    if (!showContacts) return;
    const handler = (e: MouseEvent): void => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        (!portalRef.current || !portalRef.current.contains(target))
      ) {
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
    [onChange]
  );

  const hasSelfInContacts = selfAddress
    ? contacts.some(c => c.address.toLowerCase() === selfAddress.toLowerCase())
    : true;

  const allContacts: Contact[] = [
    ...(selfAddress && !hasSelfInContacts
      ? [
          {
            id: '__self__',
            name: 'Self',
            address: selfAddress as `0x${string}`,
            createdAt: '',
            updatedAt: '',
          },
        ]
      : []),
    ...contacts,
  ];

  const matchedContact = allContacts.find(c => c.address.toLowerCase() === value.toLowerCase());

  const dropdownContent = (
    <div className="max-h-[220px] overflow-y-auto py-1">
      {!contactsLoaded ? (
        <div className="px-4 py-4 text-[12px] text-[#9B9590] text-center">Loading...</div>
      ) : allContacts.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <div className="w-8 h-8 rounded-full bg-[#F5F2ED] flex items-center justify-center mx-auto mb-2">
            <Users className="w-3.5 h-3.5 text-[#B5B0AA]" />
          </div>
          <p className="text-[12px] text-[#9B9590]">No contacts yet</p>
        </div>
      ) : (
        allContacts.map(contact => {
          const isSelected = contact.address.toLowerCase() === value.toLowerCase();
          const initials = contact.name
            .split(' ')
            .map(w => w[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();
          return (
            <button
              key={contact.id}
              type="button"
              onMouseDown={e => {
                e.preventDefault();
                selectContact(contact);
              }}
              className={cn(
                'flex items-center gap-2.5 w-full px-3 py-2 text-left transition-colors',
                isSelected ? 'bg-[#F5F2ED]' : 'hover:bg-[#FDFBF8]'
              )}
            >
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-[#F5F2ED]">
                <span className="text-[10px] font-bold text-[#9B9590]">{initials}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-[#2D3436] truncate">{contact.name}</p>
                <p className="text-[10px] text-[#B5B0AA] font-mono truncate">
                  {formatAddress(contact.address, 6)}
                </p>
              </div>
              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[#2D3436] shrink-0" />}
            </button>
          );
        })
      )}
    </div>
  );

  const dropdown = showContacts && (
    <div className="absolute right-0 top-full mt-1 w-64 rounded-xl border border-[#EDE9E3] bg-white z-50 overflow-hidden shadow-lg shadow-black/[0.06]">
      {dropdownContent}
    </div>
  );

  const portalDropdown =
    showContacts &&
    portalPos &&
    createPortal(
      <div
        ref={portalRef}
        className="fixed w-64 rounded-xl border border-[#EDE9E3] bg-white z-[9999] overflow-hidden shadow-lg shadow-black/[0.06]"
        style={{
          top: portalPos.top - 8,
          left: portalPos.left,
          transform: 'translateY(-100%)',
        }}
      >
        {dropdownContent}
      </div>,
      document.body
    );

  return (
    <div ref={containerRef}>
      {/* Label row */}
      {!compact && (
        <div className="flex items-center justify-between mb-3">
          <label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
            {label}
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={toggleDropdown}
              className={cn(
                'flex items-center gap-1.5 text-[11px] font-medium transition-colors px-2.5 py-1 rounded-lg',
                showContacts
                  ? 'text-[#2D3436] bg-[#EDE9E3]'
                  : 'text-[#9B9590] bg-[#F5F2ED] hover:bg-[#EDE9E3] hover:text-[#6B6560]'
              )}
            >
              <Users className="h-3 w-3" />
              Contacts
              <ChevronDown
                className={cn(
                  'h-3 w-3 transition-transform duration-200',
                  showContacts && 'rotate-180'
                )}
              />
            </button>
            {dropdown}
          </div>
        </div>
      )}

      {/* Address input */}
      <div className="relative">
        <Input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value.trim())}
          className={cn(
            'text-[14px] font-mono',
            compact ? 'px-3 pr-9 bg-white' : 'px-4 bg-[#FDFBF8]',
            isInvalid && 'border-red-300 bg-red-50/30'
          )}
        />
        {compact && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <button
              ref={triggerRef}
              type="button"
              onClick={toggleDropdown}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                showContacts
                  ? 'text-[#2D3436] bg-[#EDE9E3]'
                  : 'text-[#B5B0AA] bg-[#F5F2ED] hover:bg-[#EDE9E3] hover:text-[#6B6560]'
              )}
            >
              <Users className="h-3.5 w-3.5" />
            </button>
            {portalDropdown}
          </div>
        )}
      </div>
      {!compact && matchedContact && (
        <p className="text-[11px] font-medium text-[#9B9590] mt-1.5">
          {matchLabel} <span className="text-[#2D3436]">{matchedContact.name}</span>
        </p>
      )}

      {/* Validation error */}
      {isInvalid && !compact && (
        <p className="text-[11px] text-red-500 mt-1.5 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Invalid address format
        </p>
      )}
    </div>
  );
}
