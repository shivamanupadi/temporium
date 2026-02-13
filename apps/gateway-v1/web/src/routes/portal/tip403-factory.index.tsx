import { createFileRoute } from '@tanstack/react-router';
import { useState, type ReactElement } from 'react';
import { motion } from 'framer-motion';
import { Plus, Download, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  PolicyCard,
  PolicyEmptyState,
  CreatePolicyModal,
  ImportPolicyModal,
} from '@/components/policies';
import { usePolicies } from '@/hooks/usePolicies';

export const Route = createFileRoute('/portal/tip403-factory/')({
  component: Tip403FactoryIndexPage,
});

function Tip403FactoryIndexPage(): ReactElement {
  const { policies, isLoading, refresh } = usePolicies();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async (): Promise<void> => {
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-[#2D3436] tracking-tight">TIP403 Factory</h1>
          <p className="text-[14px] text-[#6B6560] mt-1">Create and manage transfer policies</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isLoading || isRefreshing}
            className="h-10 px-5 rounded-xl text-[13px] font-medium border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowImportModal(true)}
            className="h-10 px-5 rounded-xl text-[13px] font-medium border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            <span className="hidden sm:inline">Import</span>
          </Button>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="h-10 px-5 rounded-xl text-[13px] font-semibold bg-[#2D3436] hover:bg-[#3D4446] text-white"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Create
          </Button>
        </div>
      </motion.div>

      {/* Policies List */}
      {isLoading ? (
        <div className="bg-white border border-[#EDE9E3] rounded-2xl shadow-sm p-12 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#9B9590] mx-auto" />
        </div>
      ) : policies.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-dashed border-[#EDE9E3] bg-white p-12 text-center"
        >
          <PolicyEmptyState onCreate={() => setShowCreateModal(true)} />
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
              className={index !== policies.length - 1 ? 'border-b border-[#EDE9E3]/50' : ''}
            >
              <PolicyCard policy={policy} />
            </div>
          ))}
        </motion.div>
      )}

      {/* Create Modal */}
      <CreatePolicyModal
        isOpen={showCreateModal}
        onSuccess={refresh}
        onClose={() => setShowCreateModal(false)}
      />

      {/* Import Modal */}
      <ImportPolicyModal
        isOpen={showImportModal}
        onSuccess={refresh}
        onClose={() => setShowImportModal(false)}
      />
    </div>
  );
}
