import { createFileRoute } from '@tanstack/react-router';
import { useState, type ReactElement } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  Users,
  Copy,
  Check,
  Pencil,
  Trash2,
  ExternalLink,
  Loader2,
  UserPlus,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@temporium/shared-ui';
import { useContacts, type Contact } from '@/hooks/useContacts';
import { formatAddress, isValidAddress, cn } from '@/lib/utils';
import { getExplorerAddressUrl } from '@/lib/tempo-client';
import type { Address } from 'viem';

export const Route = createFileRoute('/wallet/contacts')({
  component: ContactsPage,
});

type ModalState = 'add' | 'edit' | 'delete' | null;

const avatarColors = [
  { bg: '#9B72CF', text: '#FFFFFF' },
  { bg: '#9B72CF', text: '#FFFFFF' },
  { bg: '#5B9A6F', text: '#FFFFFF' },
  { bg: '#D4A574', text: '#FFFFFF' },
  { bg: '#6B8EC4', text: '#FFFFFF' },
  { bg: '#E5484D', text: '#FFFFFF' },
];

function getAvatarColor(name: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length]!;
}

function ContactsPage(): ReactElement {
  const { contacts, isLoading, addContact, editContact, removeContact } = useContacts();

  const [searchQuery, setSearchQuery] = useState('');
  const [modalState, setModalState] = useState<ModalState>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (contact: Contact): void => {
    navigator.clipboard.writeText(contact.address);
    setCopiedId(contact.id);
    toast.success('Address copied!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredContacts = contacts.filter(
    contact =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const resetForm = (): void => {
    setName('');
    setAddress('');
    setSelectedContact(null);
    setModalState(null);
  };

  const handleOpenAdd = (): void => {
    resetForm();
    setModalState('add');
  };

  const handleOpenEdit = (contact: Contact): void => {
    setSelectedContact(contact);
    setName(contact.name);
    setAddress(contact.address);
    setModalState('edit');
  };

  const handleOpenDelete = (contact: Contact): void => {
    setSelectedContact(contact);
    setModalState('delete');
  };

  const handleAdd = async (): Promise<void> => {
    if (!name.trim() || !address.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    if (!isValidAddress(address)) {
      toast.error('Invalid address');
      return;
    }

    setIsSubmitting(true);
    try {
      await addContact(name.trim(), address as Address);
      toast.success('Contact added');
      resetForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add contact';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (): Promise<void> => {
    if (!selectedContact || !name.trim() || !address.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    if (!isValidAddress(address)) {
      toast.error('Invalid address');
      return;
    }

    setIsSubmitting(true);
    try {
      await editContact(selectedContact.id, { name: name.trim(), address: address as Address });
      toast.success('Contact updated');
      resetForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update contact';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!selectedContact) return;

    setIsSubmitting(true);
    try {
      await removeContact(selectedContact.id);
      toast.success('Contact deleted');
      resetForm();
    } catch {
      toast.error('Failed to delete contact');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-[#2D3436] tracking-tight">Contacts</h1>
          <p className="text-[14px] text-[#6B6560] mt-1">
            Manage your saved addresses for quick transfers.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="w-9 h-9 rounded-xl bg-primary hover:bg-primary/85 flex items-center justify-center transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4 text-white" />
        </button>
      </motion.div>

      {/* Search bar */}
      {contacts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="relative"
        >
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#B5B0AA]" />
          <Input
            placeholder="Search by name or address..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10 h-11 rounded-xl bg-white border-border/40 text-[13px] placeholder:text-[#B5B0AA] focus-visible:border-primary/40 focus-visible:ring-primary/10"
          />
        </motion.div>
      )}

      {/* Content */}
      {isLoading ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="bg-white border border-border/60 rounded-2xl shadow-sm overflow-hidden"
        >
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className={cn('px-6 py-4 animate-pulse', i < 3 && 'border-b border-border/20')}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-[#F5F2ED]" />
                <div className="flex-1">
                  <div className="h-4 w-24 bg-[#F5F2ED] rounded-md mb-2" />
                  <div className="h-3 w-36 bg-[#F5F2ED] rounded-md" />
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      ) : contacts.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="bg-white border border-border/60 rounded-2xl shadow-sm"
        >
          <div className="px-6 py-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-4">
              <Users className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-[15px] font-semibold text-[#2D3436] mb-1.5">No Contacts Yet</h2>
            <p className="text-[13px] text-muted-foreground max-w-[260px] mx-auto leading-relaxed mb-5">
              Save wallet addresses for quick and easy payments to people you transact with often.
            </p>
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/85 text-white text-[13px] font-semibold transition-colors shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              Add First Contact
            </button>
          </div>
        </motion.div>
      ) : filteredContacts.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-border/60 rounded-2xl shadow-sm"
        >
          <div className="px-6 py-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#F5F2ED] flex items-center justify-center mx-auto mb-4">
              <Search className="w-7 h-7 text-[#9B9590]" />
            </div>
            <h2 className="text-[15px] font-semibold text-[#2D3436] mb-1.5">No Results</h2>
            <p className="text-[13px] text-muted-foreground">
              No contacts match &ldquo;{searchQuery}&rdquo;
            </p>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="bg-white border border-border/60 rounded-2xl shadow-sm overflow-hidden"
        >
          <AnimatePresence mode="popLayout">
            {filteredContacts.map((contact, index) => {
              const isLast = index === filteredContacts.length - 1;
              const colors = getAvatarColor(contact.name);
              const isCopied = copiedId === contact.id;

              return (
                <motion.div
                  key={contact.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3, delay: index * 0.03 }}
                  className={cn(
                    'px-6 py-4 hover:bg-[#FDFBF8] transition-colors',
                    !isLast && 'border-b border-border/20'
                  )}
                >
                  <div className="flex items-center gap-3.5">
                    {/* Avatar */}
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${colors.bg}14` }}
                    >
                      <span className="text-[15px] font-bold" style={{ color: colors.bg }}>
                        {contact.name.charAt(0).toUpperCase()}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[14px] font-semibold text-[#2D3436] truncate mb-0.5">
                        {contact.name}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[#9B9590] font-mono truncate">
                          {formatAddress(contact.address, 6)}
                        </span>
                        <a
                          href={getExplorerAddressUrl(contact.address)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-medium text-[#5B9A6F] hover:text-[#4A8A5E] transition-colors shrink-0"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          Explorer
                        </a>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleCopy(contact)}
                        className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
                          isCopied
                            ? 'bg-[#5B9A6F]/10'
                            : 'border border-border/30 bg-[#FDFBF8] hover:border-[#5B9A6F]/30 hover:bg-[#5B9A6F]/5'
                        )}
                      >
                        {isCopied ? (
                          <Check className="w-3.5 h-3.5 text-[#5B9A6F]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-[#B5B0AA]" />
                        )}
                      </button>
                      <button
                        onClick={() => handleOpenEdit(contact)}
                        className="w-8 h-8 rounded-lg border border-border/30 bg-[#FDFBF8] hover:border-primary/30 hover:bg-primary/5 flex items-center justify-center transition-all"
                      >
                        <Pencil className="w-3.5 h-3.5 text-[#B5B0AA]" />
                      </button>
                      <button
                        onClick={() => handleOpenDelete(contact)}
                        className="w-8 h-8 rounded-lg border border-border/30 bg-[#FDFBF8] hover:border-red-200 hover:bg-red-50 flex items-center justify-center transition-all group"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-[#B5B0AA] group-hover:text-red-500 transition-colors" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={modalState === 'add' || modalState === 'edit'} onOpenChange={() => resetForm()}>
        <DialogContent className="max-w-[340px] p-0 gap-0 overflow-hidden rounded-2xl">
          <DialogTitle className="sr-only">
            {modalState === 'add' ? 'Add Contact' : 'Edit Contact'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {modalState === 'add' ? 'Add a new contact' : 'Edit contact details'}
          </DialogDescription>

          <div className="relative px-6 pt-8 pb-2 text-center">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.04] to-transparent pointer-events-none" />

            <div className="relative">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{
                  backgroundColor:
                    modalState === 'edit' && selectedContact
                      ? `${getAvatarColor(selectedContact.name).bg}14`
                      : 'color-mix(in srgb, var(--primary) 8%, transparent)',
                }}
              >
                {modalState === 'edit' ? (
                  <Pencil className="w-7 h-7 text-primary" />
                ) : (
                  <UserPlus className="w-7 h-7 text-primary" />
                )}
              </div>
              <h3 className="text-[15px] font-semibold text-[#2D3436] mb-1">
                {modalState === 'add' ? 'Add Contact' : 'Edit Contact'}
              </h3>
              <p className="text-[12px] text-muted-foreground">
                {modalState === 'add'
                  ? 'Save a wallet address for quick access'
                  : 'Update contact details'}
              </p>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 block">
                Name
              </label>
              <Input
                placeholder="e.g., Alice, Bob..."
                value={name}
                onChange={e => setName(e.target.value)}
                className="h-11 rounded-xl bg-[#FDFBF8] border-border/40 text-[13px] placeholder:text-[#B5B0AA] focus-visible:border-primary/40 focus-visible:ring-primary/10"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 block">
                Wallet Address
              </label>
              <Input
                placeholder="0x..."
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="h-11 rounded-xl bg-[#FDFBF8] border-border/40 font-mono text-[12px] placeholder:text-[#B5B0AA] focus-visible:border-primary/40 focus-visible:ring-primary/10"
              />
            </div>
          </div>

          <div className="px-5 pb-5 flex items-center gap-2.5">
            <Button
              variant="outline"
              className="flex-1 h-11 rounded-xl text-[13px] border-border/40"
              onClick={resetForm}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 h-11 rounded-xl text-[13px] font-semibold bg-primary hover:bg-primary/85 text-white"
              onClick={modalState === 'add' ? handleAdd : handleEdit}
              disabled={isSubmitting || !name.trim() || !address.trim()}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : modalState === 'add' ? (
                <>
                  <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                  Add Contact
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 mr-1.5" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={modalState === 'delete'} onOpenChange={() => resetForm()}>
        <DialogContent className="max-w-[320px] p-0 gap-0 overflow-hidden rounded-2xl">
          <DialogTitle className="sr-only">Delete Contact</DialogTitle>
          <DialogDescription className="sr-only">Confirm contact deletion</DialogDescription>

          <div className="relative px-6 pt-8 pb-5 text-center">
            <div className="absolute inset-0 bg-gradient-to-b from-red-500/[0.04] to-transparent pointer-events-none" />

            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-7 h-7 text-red-500" />
              </div>

              <h3 className="text-[15px] font-semibold text-[#2D3436] mb-1.5">Delete Contact?</h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                <span className="font-semibold text-[#2D3436]">{selectedContact?.name}</span> will
                be permanently removed from your contacts.
              </p>
            </div>
          </div>

          {/* Contact preview card */}
          {selectedContact && (
            <div className="mx-5 mb-5">
              <div className="bg-[#FDFBF8] rounded-xl border border-border/30 px-4 py-3 flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${getAvatarColor(selectedContact.name).bg}14` }}
                >
                  <span
                    className="text-[13px] font-bold"
                    style={{ color: getAvatarColor(selectedContact.name).bg }}
                  >
                    {selectedContact.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#2D3436] truncate">
                    {selectedContact.name}
                  </p>
                  <p className="text-[11px] text-[#9B9590] font-mono truncate">
                    {formatAddress(selectedContact.address, 6)}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="px-5 pb-5 flex items-center gap-2.5">
            <Button
              variant="outline"
              className="flex-1 h-11 rounded-xl text-[13px] border-border/40"
              onClick={resetForm}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 h-11 rounded-xl text-[13px] font-semibold bg-red-500 hover:bg-red-600 text-white"
              onClick={handleDelete}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Delete
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
