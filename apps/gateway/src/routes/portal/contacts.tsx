import { createFileRoute } from '@tanstack/react-router';
import { useState, type ReactElement } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  User,
  Copy,
  Check,
  Pencil,
  Trash2,
  ExternalLink,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useContacts, type Contact } from '@/hooks/useContacts';
import { formatAddress, isValidAddress } from '@/lib/utils';
import { getExplorerAddressUrl } from '@/lib/tempo-client';
import type { Address } from 'viem';

export const Route = createFileRoute('/portal/contacts')({
  component: ContactsPage,
});

type ModalState = 'add' | 'edit' | 'delete' | null;

function ContactsPage(): ReactElement {
  const { contacts, isLoading, addContact, editContact, removeContact, refresh } = useContacts();

  const [searchQuery, setSearchQuery] = useState('');
  const [modalState, setModalState] = useState<ModalState>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async (): Promise<void> => {
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCopy = (contact: Contact): void => {
    navigator.clipboard.writeText(contact.address);
    setCopiedId(contact.id);
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
    // Check for duplicate name
    const duplicateName = contacts.find(c => c.name.toLowerCase() === name.trim().toLowerCase());
    if (duplicateName) {
      toast.error('Contact with this name already exists');
      return;
    }
    // Check for duplicate address
    const duplicateAddress = contacts.find(c => c.address.toLowerCase() === address.toLowerCase());
    if (duplicateAddress) {
      toast.error('Contact with this address already exists');
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
    // Check for duplicate name (excluding current contact)
    const duplicateName = contacts.find(
      c => c.id !== selectedContact.id && c.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (duplicateName) {
      toast.error('Contact with this name already exists');
      return;
    }
    // Check for duplicate address (excluding current contact)
    const duplicateAddress = contacts.find(
      c => c.id !== selectedContact.id && c.address.toLowerCase() === address.toLowerCase()
    );
    if (duplicateAddress) {
      toast.error('Contact with this address already exists');
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
    } catch (error) {
      toast.error('Failed to delete contact');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Contacts</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading || isRefreshing}
            className="h-8 px-3"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button size="sm" onClick={handleOpenAdd} className="h-8 px-3">
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search contacts..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-9 h-10"
        />
      </div>

      {/* Contacts List */}
      <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)] overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-[rgba(0,0,0,0.03)]">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center justify-between px-4 py-3 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-muted" />
                  <div>
                    <div className="h-4 w-24 bg-muted rounded mb-1.5" />
                    <div className="h-3 w-32 bg-muted rounded" />
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-8 h-8 bg-muted rounded-md" />
                  <div className="w-8 h-8 bg-muted rounded-md" />
                  <div className="w-8 h-8 bg-muted rounded-md" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <User className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-[14px] font-medium text-foreground mb-1">
              {searchQuery ? 'No contacts found' : 'No contacts yet'}
            </p>
            <p className="text-[13px] text-muted-foreground mb-4">
              {searchQuery ? 'Try a different search' : 'Add contacts for quick payments'}
            </p>
            {!searchQuery && (
              <Button variant="outline" size="sm" onClick={handleOpenAdd}>
                <Plus className="h-4 w-4" />
                Add Contact
              </Button>
            )}
          </div>
        ) : (
          <AnimatePresence>
            {filteredContacts.map((contact, index) => (
              <motion.div
                key={contact.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ delay: index * 0.03 }}
                className={`flex items-center justify-between px-4 py-3 ${
                  index < filteredContacts.length - 1 ? 'shadow-[0_1px_0_0_rgba(0,0,0,0.03)]' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-[13px] font-semibold text-primary">
                      {contact.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-foreground truncate">
                      {contact.name}
                    </p>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {formatAddress(contact.address, 6)}
                      </span>
                      <button
                        onClick={() =>
                          window.open(getExplorerAddressUrl(contact.address), '_blank')
                        }
                        className="p-0.5 rounded hover:bg-muted transition-colors"
                      >
                        <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleCopy(contact)}
                    className="p-2 rounded-md hover:bg-muted transition-colors"
                  >
                    {copiedId === contact.id ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                  <button
                    onClick={() => handleOpenEdit(contact)}
                    className="p-2 rounded-md hover:bg-muted transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => handleOpenDelete(contact)}
                    className="p-2 rounded-md hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={modalState === 'add' || modalState === 'edit'} onOpenChange={() => resetForm()}>
        <DialogContent className="sm:max-w-sm p-0 overflow-hidden">
          <div className="p-5">
            <DialogTitle className="text-[15px] font-semibold mb-4">
              {modalState === 'add' ? 'Add Contact' : 'Edit Contact'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {modalState === 'add' ? 'Add a new contact' : 'Edit contact details'}
            </DialogDescription>

            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Name
                </label>
                <Input
                  placeholder="e.g., Alice, Bob..."
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="h-10"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Address
                </label>
                <Input
                  placeholder="0x..."
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="h-10 font-mono text-[13px]"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button variant="outline" className="flex-1 h-10" onClick={resetForm}>
                Cancel
              </Button>
              <Button
                className="flex-1 h-10"
                onClick={modalState === 'add' ? handleAdd : handleEdit}
                disabled={isSubmitting || !name.trim() || !address.trim()}
              >
                {isSubmitting ? 'Saving...' : modalState === 'add' ? 'Add Contact' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={modalState === 'delete'} onOpenChange={() => resetForm()}>
        <DialogContent className="sm:max-w-sm p-0 overflow-hidden">
          <div className="p-5 text-center">
            <DialogTitle className="sr-only">Delete Contact</DialogTitle>
            <DialogDescription className="sr-only">Confirm contact deletion</DialogDescription>

            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="h-6 w-6 text-red-500" />
            </div>

            <p className="text-[15px] font-semibold text-foreground mb-1">Delete Contact?</p>
            <p className="text-[13px] text-muted-foreground mb-6">
              Are you sure you want to delete <strong>{selectedContact?.name}</strong>? This action
              cannot be undone.
            </p>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 h-10"
                onClick={resetForm}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1 h-10"
                onClick={handleDelete}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting
                  </>
                ) : (
                  'Delete'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
