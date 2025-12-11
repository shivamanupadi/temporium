import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Plus, Search, User, Pencil, Trash2, X, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { useContacts, type Contact } from '@/hooks/useContacts'
import { formatAddress, isValidAddress } from '@/lib/utils'
import { getExplorerAddressUrl } from '@/lib/tempo-client'
import type { Address } from 'viem'

export const Route = createFileRoute('/portal/contacts')({
  component: ContactsPage,
})

type ModalState = 'add' | 'edit' | 'delete' | null

function ContactsPage() {
  const navigate = useNavigate()
  const { contacts, isLoading, addContact, editContact, removeContact } = useContacts()

  const [searchQuery, setSearchQuery] = useState('')
  const [modalState, setModalState] = useState<ModalState>(null)
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.address.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const resetForm = () => {
    setName('')
    setAddress('')
    setSelectedContact(null)
    setModalState(null)
  }

  const handleOpenAdd = () => {
    resetForm()
    setModalState('add')
  }

  const handleOpenEdit = (contact: Contact) => {
    setSelectedContact(contact)
    setName(contact.name)
    setAddress(contact.address)
    setModalState('edit')
  }

  const handleOpenDelete = (contact: Contact) => {
    setSelectedContact(contact)
    setModalState('delete')
  }

  const handleAdd = async () => {
    if (!name.trim() || !address.trim()) {
      toast.error('Please fill in all fields')
      return
    }
    if (!isValidAddress(address)) {
      toast.error('Invalid address')
      return
    }

    setIsSubmitting(true)
    try {
      await addContact(name.trim(), address as Address)
      toast.success('Contact added')
      resetForm()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add contact'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = async () => {
    if (!selectedContact || !name.trim() || !address.trim()) {
      toast.error('Please fill in all fields')
      return
    }
    if (!isValidAddress(address)) {
      toast.error('Invalid address')
      return
    }

    setIsSubmitting(true)
    try {
      await editContact(selectedContact.id, { name: name.trim(), address: address as Address })
      toast.success('Contact updated')
      resetForm()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update contact'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedContact) return

    setIsSubmitting(true)
    try {
      await removeContact(selectedContact.id)
      toast.success('Contact deleted')
      resetForm()
    } catch (error) {
      toast.error('Failed to delete contact')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate({ to: '/portal/dashboard' })}
            className="p-1.5 -ml-1.5 rounded-md hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <h1 className="text-[15px] font-medium text-foreground">Contacts</h1>
        </div>
        <Button size="sm" onClick={handleOpenAdd} className="h-8 px-3">
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search contacts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-10"
        />
      </div>

      {/* Contacts List */}
      <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)] overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
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
                    <p className="text-[13px] font-medium text-foreground truncate">{contact.name}</p>
                    <button
                      onClick={() => window.open(getExplorerAddressUrl(contact.address), '_blank')}
                      className="text-[11px] text-muted-foreground hover:text-primary font-mono transition-colors"
                    >
                      {formatAddress(contact.address, 6)}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1">
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
                  onChange={(e) => setName(e.target.value)}
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
                  onChange={(e) => setAddress(e.target.value)}
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
              Are you sure you want to delete <strong>{selectedContact?.name}</strong>? This action cannot be undone.
            </p>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-10" onClick={resetForm}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1 h-10"
                onClick={handleDelete}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
