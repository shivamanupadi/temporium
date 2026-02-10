import { type ReactElement, useState, useEffect, useCallback } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import {
  Shield,
  Plus,
  Trash2,
  Loader2,
  Copy,
  Check,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@temporium/shared-ui';
import { useTempo } from '@/hooks/useTempo';
import { apiGet, apiPost, apiDelete } from '@/lib/api-client';
import { formatAddress, copyToClipboard } from '@/lib/utils';
import type { Policy } from '@/types';

export const Route = createFileRoute('/portal/tip403-factory')({
  component: Tip403FactoryPage,
});

function Tip403FactoryPage(): ReactElement {
  const { isConnected } = useTempo();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form state
  const [policyName, setPolicyName] = useState('');

  const loadPolicies = useCallback(async () => {
    try {
      const data = await apiGet<Policy[]>('/v1/policies');
      setPolicies(data);
    } catch {
      // API might not be available yet
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isConnected) loadPolicies();
  }, [isConnected, loadPolicies]);

  const handleCreate = async (): Promise<void> => {
    if (!policyName.trim()) {
      toast.error('Policy name is required');
      return;
    }

    setCreating(true);
    try {
      const policy = await apiPost<Policy>('/v1/policies', {
        name: policyName.trim(),
        rules: [],
      });
      setPolicies(prev => [policy, ...prev]);
      setShowCreateModal(false);
      setPolicyName('');
      toast.success('Policy created');
    } catch (err) {
      toast.error('Failed to create policy', { description: (err as Error).message });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    try {
      await apiDelete<void>(`/v1/policies/${id}`);
      setPolicies(prev => prev.filter(p => p.id !== id));
      toast.success('Policy deleted');
    } catch (err) {
      toast.error('Failed to delete policy', { description: (err as Error).message });
    }
  };

  const handleCopy = async (text: string, id: string): Promise<void> => {
    await copyToClipboard(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#9B72CF]/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-[#9B72CF]" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[#2D3436]">TIP403 Factory</h1>
            <p className="text-[13px] text-[#6B6560]">Create and manage transaction policies</p>
          </div>
        </div>

        <Button
          onClick={() => setShowCreateModal(true)}
          className="h-9 px-4 rounded-xl text-[13px] font-semibold bg-[#9B72CF] hover:bg-[#8B62BF] text-white"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          New Policy
        </Button>
      </motion.div>

      {/* Content */}
      {loading ? (
        <div className="bg-white border border-[#EDE9E3] rounded-2xl shadow-sm p-12 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#9B9590] mx-auto" />
        </div>
      ) : policies.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-[#EDE9E3] rounded-2xl shadow-sm"
        >
          <div className="px-6 py-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#9B72CF]/8 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-7 h-7 text-[#9B72CF]" />
            </div>
            <h2 className="text-[15px] font-semibold text-[#2D3436] mb-1.5">No Policies Yet</h2>
            <p className="text-[13px] text-[#6B6560] max-w-[280px] mx-auto leading-relaxed mb-4">
              TIP-403 policies define rules and constraints for token transactions.
            </p>
            <Button
              onClick={() => setShowCreateModal(true)}
              variant="outline"
              className="h-9 px-4 rounded-xl text-[13px] font-semibold border-[#EDE9E3]"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Create Policy
            </Button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-[#EDE9E3] rounded-2xl shadow-sm overflow-hidden"
        >
          {policies.map((policy, index) => (
            <div
              key={policy.id}
              className={`px-6 py-4 flex items-center gap-4 hover:bg-[#FDFBF8] transition-colors ${
                index !== policies.length - 1 ? 'border-b border-[#EDE9E3]/50' : ''
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-[#9B72CF]/8 flex items-center justify-center shrink-0">
                <Shield className="w-4.5 h-4.5 text-[#9B72CF]" />
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-[14px] font-semibold text-[#2D3436] truncate">{policy.name}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-[#9B9590]">
                    {policy.rules.length} rule{policy.rules.length !== 1 ? 's' : ''}
                  </span>
                  {policy.address && (
                    <button
                      onClick={() => handleCopy(policy.address!, policy.id)}
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-[#6B6560] hover:text-[#2D3436] transition-colors"
                    >
                      {formatAddress(policy.address, 4)}
                      {copiedId === policy.id ? (
                        <Check className="w-2.5 h-2.5 text-[#5B9A6F]" />
                      ) : (
                        <Copy className="w-2.5 h-2.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleDelete(policy.id)}
                className="w-8 h-8 rounded-lg border border-[#EDE9E3] hover:border-red-200 hover:bg-red-50 flex items-center justify-center transition-all group"
              >
                <Trash2 className="w-3.5 h-3.5 text-[#B5B0AA] group-hover:text-red-500 transition-colors" />
              </button>
            </div>
          ))}
        </motion.div>
      )}

      {/* Create Policy Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-[380px] p-0 gap-0 overflow-hidden rounded-2xl">
          <DialogTitle className="sr-only">Create Policy</DialogTitle>
          <DialogDescription className="sr-only">Create a new TIP-403 transaction policy</DialogDescription>

          <div className="px-6 pt-6 pb-4">
            <div className="w-14 h-14 rounded-2xl bg-[#9B72CF]/10 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-7 h-7 text-[#9B72CF]" />
            </div>
            <h3 className="text-[16px] font-semibold text-[#2D3436] text-center mb-1">New Policy</h3>
            <p className="text-[13px] text-[#6B6560] text-center mb-4">
              Create a TIP-403 transaction policy
            </p>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Policy name"
                value={policyName}
                onChange={e => setPolicyName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[#EDE9E3] bg-[#FDFBF8] text-[14px] text-[#2D3436] placeholder:text-[#B5B0AA] focus:border-[#9B72CF]/40 transition-colors"
              />
            </div>
          </div>

          <div className="px-5 pb-5 flex items-center gap-2.5">
            <Button
              variant="outline"
              className="flex-1 h-11 rounded-xl text-[13px] border-[#EDE9E3]"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 h-11 rounded-xl text-[13px] font-semibold bg-[#9B72CF] hover:bg-[#8B62BF] text-white"
              onClick={handleCreate}
              disabled={creating || !policyName.trim()}
            >
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
              ) : (
                <Plus className="w-4 h-4 mr-1.5" />
              )}
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
