import { createFileRoute } from '@tanstack/react-router';
import { useState, type ReactElement } from 'react';
import { Plus, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import {
  StablecoinCard,
  StablecoinEmptyState,
  CreateStablecoinModal,
  ImportStablecoinModal,
} from '@/components/stablecoins';
import { useStablecoins } from '@/hooks/useStablecoins';

export const Route = createFileRoute('/portal/tip20-studio/')({
  component: Tip20StudioIndexPage,
});

function Tip20StudioIndexPage(): ReactElement {
  const { stablecoins, isLoading, refresh } = useStablecoins();
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
        title="TIP20 Studio"
        action={
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImportModal(true)}
              className="h-8 px-3"
            >
              <Download className="h-4 w-4" />
              Import
            </Button>
            <Button size="sm" onClick={() => setShowCreateModal(true)} className="h-8 px-3">
              <Plus className="h-4 w-4" />
              Create
            </Button>
          </div>
        }
      />

      {/* Tokens List */}
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
                        <div className="h-4 w-24 bg-muted rounded" />
                        <div className="h-4 w-12 bg-muted rounded" />
                      </div>
                      <div className="h-3 w-32 bg-muted rounded" />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="h-4 w-16 bg-muted rounded mb-1" />
                      <div className="h-3 w-10 bg-muted rounded" />
                    </div>
                    <div className="w-4 h-4 bg-muted rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : stablecoins.length === 0 ? (
          <StablecoinEmptyState onCreate={() => setShowCreateModal(true)} />
        ) : (
          <div className="divide-y divide-[rgba(0,0,0,0.03)]">
            {stablecoins.map(coin => (
              <StablecoinCard key={coin.id} coin={coin} />
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <CreateStablecoinModal
        isOpen={showCreateModal}
        onSuccess={refresh}
        onClose={() => setShowCreateModal(false)}
      />

      {/* Import Modal */}
      <ImportStablecoinModal
        isOpen={showImportModal}
        onSuccess={refresh}
        onClose={() => setShowImportModal(false)}
      />
    </div>
  );
}
