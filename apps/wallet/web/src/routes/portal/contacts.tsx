import { type ReactElement, useState, useEffect, useCallback } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, Trash2, Copy, Check, Search, Loader2, X, ExternalLink } from 'lucide-react';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@temporium/shared-ui';
import { apiGet, apiPost, apiDelete } from '@/lib/api-client';
import { formatAddress, copyToClipboard, isValidAddress } from '@/lib/utils';
import { TIMING, LINKS } from '@/lib/constants';
import type { Contact } from '@/types';

export const Route = createFileRoute('/portal/contacts')({
  component: ContactsPage,
});

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] as const } },
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] as const },
  },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
};

function ContactsPage(): ReactElement {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Add dialog state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadContacts = useCallback(async (): Promise<void> => {
    try {
      const data = await apiGet<Contact[]>('/v1/contacts');
      setContacts(data);
    } catch (err) {
      toast.error('Failed to load contacts', {
        description: (err as Error).message,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const handleCopyAddress = useCallback(async (contact: Contact): Promise<void> => {
    const success = await copyToClipboard(contact.address);
    if (success) {
      setCopiedId(contact.id);
      toast.success('Address copied');
      setTimeout(() => setCopiedId(null), TIMING.COPY_FEEDBACK_MS);
    } else {
      toast.error('Failed to copy address');
    }
  }, []);

  const handleAdd = useCallback(async (): Promise<void> => {
    const trimmedName = newName.trim();
    const trimmedAddress = newAddress.trim();

    if (!trimmedName) {
      toast.error('Name is required');
      return;
    }

    if (!isValidAddress(trimmedAddress)) {
      toast.error('Invalid address', {
        description: 'Please enter a valid 0x address (42 characters).',
      });
      return;
    }

    setIsAdding(true);
    try {
      const contact = await apiPost<Contact>('/v1/contacts', {
        name: trimmedName,
        address: trimmedAddress,
      });
      setContacts(prev => [contact, ...prev]);
      setNewName('');
      setNewAddress('');
      setIsAddOpen(false);
      toast.success('Contact added', {
        description: `${trimmedName} has been saved.`,
      });
    } catch (err) {
      toast.error('Failed to add contact', {
        description: (err as Error).message,
      });
    } finally {
      setIsAdding(false);
    }
  }, [newName, newAddress]);

  const handleDelete = useCallback(async (): Promise<void> => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      await apiDelete<void>(`/v1/contacts/${deleteTarget.id}`);
      setContacts(prev => prev.filter(c => c.id !== deleteTarget.id));
      toast.success('Contact removed', {
        description: `${deleteTarget.name} has been deleted.`,
      });
      setDeleteTarget(null);
    } catch (err) {
      toast.error('Failed to delete contact', {
        description: (err as Error).message,
      });
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget]);

  const filteredContacts = contacts.filter(contact => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      contact.name.toLowerCase().includes(query) || contact.address.toLowerCase().includes(query)
    );
  });

  const resetAddForm = useCallback((): void => {
    setNewName('');
    setNewAddress('');
  }, []);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#2D3436] tracking-tight">Contacts</h1>
          <p className="text-[14px] text-[#6B6560] mt-1">
            Manage your saved addresses for quick transfers.
          </p>
        </div>
        <Button
          onClick={() => setIsAddOpen(true)}
          className="h-10 px-5 rounded-xl text-[13px] font-semibold bg-[#E07A5F] hover:bg-[#D06A4F] text-white"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Contact
        </Button>
      </motion.div>

      {/* Search */}
      <motion.div variants={itemVariants}>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B5B0AA]" />
          <Input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name or address..."
            className="pl-10 pr-4 bg-white text-[14px]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#EDE9E3] flex items-center justify-center hover:bg-[#DDD8D1] transition-colors"
            >
              <X className="w-3 h-3 text-[#6B6560]" />
            </button>
          )}
        </div>
      </motion.div>

      {/* Contact List */}
      <motion.div variants={itemVariants}>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[#B5B0AA] mb-3" />
            <p className="text-[14px] text-[#9B9590]">Loading contacts...</p>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#EDE9E3] bg-white p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#F5F2ED] flex items-center justify-center mx-auto mb-4">
              <Users className="w-7 h-7 text-[#B5B0AA]" />
            </div>
            <h3 className="text-[16px] font-semibold text-[#2D3436]">
              {searchQuery ? 'No contacts found' : 'No contacts yet'}
            </h3>
            <p className="text-[13px] text-[#9B9590] mt-1.5 max-w-sm mx-auto leading-relaxed">
              {searchQuery
                ? 'Try adjusting your search query.'
                : 'Add a contact to get started with quick transfers.'}
            </p>
            {!searchQuery && (
              <Button
                onClick={() => setIsAddOpen(true)}
                variant="outline"
                className="mt-5 h-10 px-6 rounded-xl text-[13px] font-semibold border-[#EDE9E3] gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Contact
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {filteredContacts.map(contact => (
                <motion.div
                  key={contact.id}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  layout
                  className="rounded-2xl border border-[#EDE9E3] bg-white p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-[#E07A5F]/10 flex items-center justify-center shrink-0">
                        <span className="text-[15px] font-bold text-[#E07A5F]">
                          {contact.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-[#2D3436] truncate">
                          {contact.name}
                        </p>
                        <button
                          onClick={() => handleCopyAddress(contact)}
                          className="flex items-center gap-1.5 group cursor-pointer"
                        >
                          <p className="text-[13px] font-mono text-[#9B9590] group-hover:text-[#6B6560] transition-colors truncate">
                            {formatAddress(contact.address, 6)}
                          </p>
                          {copiedId === contact.id ? (
                            <Check className="w-3 h-3 text-[#6B8F71] shrink-0" />
                          ) : (
                            <Copy className="w-3 h-3 text-[#B5B0AA] group-hover:text-[#6B6560] shrink-0 transition-colors" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <a
                        href={`${LINKS.explorer}/address/${contact.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-[#B5B0AA] hover:text-[#E07A5F] hover:bg-[#E07A5F]/6 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(contact)}
                        className="w-9 h-9 rounded-lg text-[#B5B0AA] hover:text-red-500 hover:bg-red-50 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* Add Contact Dialog */}
      <Dialog
        open={isAddOpen}
        onOpenChange={open => {
          setIsAddOpen(open);
          if (!open) resetAddForm();
        }}
      >
        <DialogContent className="p-0">
          <div className="p-6 pb-0">
            <DialogTitle className="text-[18px] font-bold text-[#2D3436]">Add Contact</DialogTitle>
            <DialogDescription className="text-[13px] text-[#9B9590] mt-1">
              Save an address for quick access when sending tokens.
            </DialogDescription>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label
                htmlFor="contact-name"
                className="block text-[12px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2"
              >
                Name
              </label>
              <Input
                id="contact-name"
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Alice"
                maxLength={50}
                className="px-3.5 bg-white text-[14px]"
              />
            </div>

            <div>
              <label
                htmlFor="contact-address"
                className="block text-[12px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2"
              >
                Address
              </label>
              <Input
                id="contact-address"
                type="text"
                value={newAddress}
                onChange={e => setNewAddress(e.target.value)}
                placeholder="0x..."
                className="h-11 px-3.5 bg-white text-[14px] font-mono"
              />
              {newAddress && !isValidAddress(newAddress) && (
                <p className="text-[12px] text-red-500 mt-1.5">
                  Enter a valid 0x address (42 characters).
                </p>
              )}
            </div>
          </div>

          <div className="p-6 pt-0 flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setIsAddOpen(false);
                resetAddForm();
              }}
              className="flex-1 h-11 rounded-xl text-[13px] font-semibold border-[#EDE9E3] text-[#6B6560]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={isAdding || !newName.trim() || !isValidAddress(newAddress.trim())}
              isLoading={isAdding}
              className="flex-1 h-11 rounded-xl text-[13px] font-semibold bg-[#E07A5F] hover:bg-[#D06A4F] text-white"
            >
              {!isAdding && <Plus className="w-4 h-4 mr-1" />}
              {isAdding ? undefined : 'Add Contact'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={open => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="p-0">
          <div className="p-6 pb-0">
            <DialogTitle className="text-[18px] font-bold text-[#2D3436]">
              Delete Contact
            </DialogTitle>
            <DialogDescription className="text-[13px] text-[#9B9590] mt-1">
              Are you sure you want to remove{' '}
              <span className="font-semibold text-[#2D3436]">{deleteTarget?.name}</span>? This
              action cannot be undone.
            </DialogDescription>
          </div>

          <div className="p-6 flex gap-3">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
              className="flex-1 h-11 rounded-xl text-[13px] font-semibold border-[#EDE9E3] text-[#6B6560]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
              isLoading={isDeleting}
              className="flex-1 h-11 rounded-xl text-[13px] font-semibold bg-red-500 hover:bg-red-600 text-white"
            >
              {!isDeleting && <Trash2 className="w-4 h-4 mr-1" />}
              {isDeleting ? undefined : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
