import { type ReactElement, useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  compact?: boolean;
  selfAddress?: string;
}

export function ContactPicker({
  value,
  onChange,
  label = 'Recipient Address',
  placeholder = '0x...',
  showValidation = true,
  compact = false,
  selfAddress,
}: ContactPickerProps): ReactElement {
  const [showContacts, setShowContacts] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const [portalPos, setPortalPos] = useState<{ top: number; left: number } | null>(null);

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

  // Position the portal dropdown above the trigger in compact mode
  useEffect(() => {
    if (!compact || !showContacts || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPortalPos({
      top: rect.top + window.scrollY,
      left: rect.right - 240, // w-60 = 240px, align right edge
    });
  }, [compact, showContacts]);

  // Close on outside click
  useEffect(() => {
    if (!showContacts) return;
    const handler = (e: MouseEvent): void => {
      const target = e.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        portalRef.current &&
        !portalRef.current.contains(target)
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

  // Find matching contact for current value
  const matchedContact = contacts.find(c => c.address.toLowerCase() === value.toLowerCase());

  // Show "Self" entry if selfAddress is provided and not already in contacts
  const hasSelfInContacts = selfAddress
    ? contacts.some(c => c.address.toLowerCase() === selfAddress.toLowerCase())
    : true;

  const renderContactRow = (contact: Contact, isLast: boolean): ReactElement => {
    const isSelected = contact.address.toLowerCase() === value.toLowerCase();
    return (
      <button
        key={contact.id}
        type="button"
        onClick={() => selectContact(contact)}
        className={cn(
          'flex items-center gap-2.5 w-full px-3 py-2.5 text-left transition-colors cursor-pointer',
          isSelected ? 'bg-coral/5' : 'hover:bg-[#F5F2ED]',
          !isLast && 'border-b border-[#EDE9E3]/40'
        )}
      >
        <div
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
            isSelected ? 'bg-coral/10' : 'bg-lavender/10'
          )}
        >
          <span
            className={cn('text-[11px] font-bold', isSelected ? 'text-coral' : 'text-lavender')}
          >
            {contact.name
              .split(' ')
              .map(w => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-[#2D3436] truncate">{contact.name}</p>
          <p className="text-[11px] text-[#9B9590] font-mono truncate">
            {formatAddress(contact.address, 6)}
          </p>
        </div>
      </button>
    );
  };

  const dropdownContent = (
    <div className="max-h-[200px] overflow-y-auto">
      {!contactsLoaded ? (
        <div className="px-4 py-3 text-[12px] text-[#9B9590]">Loading contacts...</div>
      ) : contacts.length === 0 && hasSelfInContacts ? (
        <div className="px-4 py-6 text-center">
          <div className="w-9 h-9 rounded-full bg-[#F5F2ED] flex items-center justify-center mx-auto mb-2">
            <Users className="w-4 h-4 text-[#B5B0AA]" />
          </div>
          <p className="text-[12px] text-[#9B9590]">No contacts yet</p>
        </div>
      ) : (
        <>
          {selfAddress &&
            !hasSelfInContacts &&
            renderContactRow(
              {
                id: '__self__',
                name: 'Self',
                address: selfAddress as `0x${string}`,
                createdAt: '',
                updatedAt: '',
              },
              contacts.length === 0
            )}
          {contacts.map((contact, index) =>
            renderContactRow(contact, index === contacts.length - 1)
          )}
        </>
      )}
    </div>
  );

  const inlineDropdown = showContacts && (
    <div className="absolute right-0 top-full mt-1.5 w-60 rounded-xl border border-[#EDE9E3] bg-white z-50 overflow-hidden shadow-lg shadow-black/[0.06]">
      {dropdownContent}
    </div>
  );

  const portalDropdown =
    showContacts &&
    portalPos &&
    createPortal(
      <div
        ref={portalRef}
        className="fixed w-60 rounded-xl border border-[#EDE9E3] bg-white z-[9999] overflow-hidden shadow-lg shadow-black/[0.06]"
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
    <div>
      {/* Label row with Contacts toggle (full mode) */}
      {!compact && (
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
                showContacts ? 'text-coral' : 'text-[#9B9590] hover:text-[#6B6560]'
              )}
            >
              <Users className="h-3 w-3" />
              Contacts
              <ChevronDown
                className={cn('h-3 w-3 transition-transform', showContacts && 'rotate-180')}
              />
            </button>
            {inlineDropdown}
          </div>
        </div>
      )}

      {/* Address input */}
      <div className="relative">
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value.trim())}
          className={cn(
            'w-full rounded-xl border border-[#EDE9E3] text-[14px] text-[#2D3436] font-mono placeholder:text-[#B5B0AA] focus:border-coral/40 focus:outline-none transition-colors',
            compact ? 'h-10 px-3 pr-9 bg-white' : 'px-4 py-3 bg-[#FDFBF8]',
            isInvalid && 'border-coral/50 bg-coral/[0.03]'
          )}
        />
        {compact ? (
          <div ref={dropdownRef} className="absolute right-2 top-1/2 -translate-y-1/2">
            <button
              ref={triggerRef}
              type="button"
              onClick={toggleDropdown}
              className={cn(
                'p-1 rounded-md transition-colors cursor-pointer',
                showContacts
                  ? 'text-coral bg-coral/5'
                  : 'text-[#B5B0AA] hover:text-[#6B6560] hover:bg-[#F5F2ED]'
              )}
            >
              <Users className="h-3.5 w-3.5" />
            </button>
            {portalDropdown}
          </div>
        ) : (
          matchedContact && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-coral bg-coral/8 px-2 py-0.5 rounded-full">
              {matchedContact.name}
            </span>
          )
        )}
      </div>

      {/* Validation error */}
      {isInvalid && !compact && (
        <p className="text-[11px] text-coral mt-1.5 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Invalid address format
        </p>
      )}
    </div>
  );
}
