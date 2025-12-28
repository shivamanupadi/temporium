import { createFileRoute } from '@tanstack/react-router';
import { useState, type ReactElement } from 'react';
import { Plus, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
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
    <div className="max-w-2xl">
      <PageHeader
        title="TIP403 Factory"
        action={
          <div className="flex gap-1.5 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading || isRefreshing}
              className="h-8 px-2 sm:px-3"
            >
              <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline ml-1.5">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImportModal(true)}
              className="h-8 px-2 sm:px-3"
            >
              <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline ml-1.5">Import</span>
            </Button>
            <Button size="sm" onClick={() => setShowCreateModal(true)} className="h-8 px-2 sm:px-3">
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline ml-1.5">Create</span>
            </Button>
          </div>
        }
      />

      {/* Policies List */}
      <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)] overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-[rgba(0,0,0,0.03)]">
            {[1, 2, 3].map(i => (
              <div key={i} className="p-4 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted" />
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="h-4 w-20 bg-muted rounded" />
                        <div className="h-4 w-16 bg-muted rounded" />
                      </div>
                      <div className="h-3 w-28 bg-muted rounded" />
                    </div>
                  </div>
                  <div className="w-4 h-4 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : policies.length === 0 ? (
          <PolicyEmptyState onCreate={() => setShowCreateModal(true)} />
        ) : (
          <div className="divide-y divide-[rgba(0,0,0,0.03)]">
            {policies.map(policy => (
              <PolicyCard key={policy.id} policy={policy} />
            ))}
          </div>
        )}
      </div>

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
